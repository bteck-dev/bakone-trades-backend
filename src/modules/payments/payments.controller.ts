import { Request, Response } from "express";
import crypto from "crypto";
import { paymentsService, IkhokhaWebhook } from "./payments.service";
import { ordersService } from "../orders";
import { auditService } from "../audit";
import { AUDIT_ACTIONS } from "../../constants";
import { emailService } from "../../services/email.service";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { config } from "../../config/env";

type CheckoutInput = { customer_name?: string; customer_email?: string; customer_phone?: string; product_id?: string };

const appendQuery = (url: string, params: Record<string, string>): string => {
  const target = new URL(url);
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  return target.toString();
};

export class PaymentsController {
  private token(orderId: string, action: "return" | "cancel"): string {
    return crypto.createHmac("sha256", config.jwt.secret).update(`${action}:${orderId}`).digest("hex");
  }

  private validToken(orderId: string, action: "return" | "cancel", value: unknown): boolean {
    if (typeof value !== "string") return false;
    const expected = this.token(orderId, action);
    return value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  }

  private baseUrl(req: Request): string {
    return config.ikhokha.callbackUrl
      ? new URL(config.ikhokha.callbackUrl).origin
      : `${req.protocol}://${req.get("host")}`;
  }

  private async createCheckout(input: CheckoutInput, req: Request) {
    const { customer_name, customer_email, customer_phone, product_id } = input;
    if (!customer_name?.trim() || !customer_email?.trim() || !product_id?.trim()) {
      throw new Error("customer_name, customer_email, and product_id are required");
    }

    const order = await ordersService.createPendingOrder({ customer_name: customer_name.trim(), customer_email: customer_email.trim(), customer_phone, product_id, payment_method: "card" });
    const baseUrl = this.baseUrl(req);
    const callbackUrl = config.ikhokha.callbackUrl || `${baseUrl}/api/payments/webhook`;
    const zarAmount = Math.round(Number(order.amount) * config.ikhokha.zarPerUsd * 100) / 100;
    if (!Number.isFinite(zarAmount) || zarAmount <= 0) throw new Error("Invalid iKhokha ZAR conversion configuration");
    const checkout = await paymentsService.createCheckout({
      orderId: order.order_id, productName: order.product_name, amount: zarAmount, callbackUrl,
      successUrl: `${baseUrl}/api/payments/return/${order.order_id}?verify=${this.token(order.order_id, "return")}`,
      failureUrl: `${baseUrl}/api/payments/cancel/${order.order_id}?verify=${this.token(order.order_id, "cancel")}&failed=1`,
      cancelUrl: `${baseUrl}/api/payments/cancel/${order.order_id}?verify=${this.token(order.order_id, "cancel")}`,
    });
    await ordersService.setPaymentDetails(order.order_id, checkout.paymentId, zarAmount, config.ikhokha.currency);
    await auditService.log({ action: AUDIT_ACTIONS.ORDER_CREATED, entity_type: "order", entity_id: order.order_id,
      description: `iKhokha checkout started for ${order.customer_email} - ${order.product_name}`,
      metadata: { payment_provider: "ikhokha", payment_id: checkout.paymentId }, ip_address: req.ip });
    return { order, ...checkout };
  }

  async initiateCheckout(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.createCheckout(req.body, req);
      sendSuccess(res, { orderId: result.order.order_id, paymentId: result.paymentId, paymentLink: result.paymentUrl, approvalUrl: result.paymentUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      sendError(res, message, { statusCode: message.includes("required") ? 400 : 502 });
    }
  }

  async redirectToCheckout(req: Request, res: Response): Promise<void> {
    try { res.redirect(302, (await this.createCheckout(req.query as CheckoutInput, req)).paymentUrl); }
    catch (err: unknown) { sendError(res, err instanceof Error ? err.message : "Checkout failed", { statusCode: 400 }); }
  }

  private async completePaidOrder(orderId: string, paymentId: string, req: Request): Promise<void> {
    const existing = await ordersService.getByOrderId(orderId);
    if (existing.payment_status === "paid") return;
    const order = await ordersService.markAsPaid(orderId, paymentId);
    await auditService.log({ action: AUDIT_ACTIONS.ORDER_PAID, entity_type: "order", entity_id: order.order_id,
      description: `iKhokha payment confirmed for order ${order.order_id}`, metadata: { payment_provider: "ikhokha", payment_id: paymentId }, ip_address: req.ip });
    await emailService.sendPaymentConfirmation(order);
    await emailService.sendAdminNewOrderAlert(order);
  }

  async webhook(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as IkhokhaWebhook;
      const callbackPath = new URL(config.ikhokha.callbackUrl || `${this.baseUrl(req)}/api/payments/webhook`).pathname;
      if (!paymentsService.verifyWebhook(callbackPath, body, req.headers["ik-appid"], req.headers["ik-sign"])) {
        sendError(res, "Invalid iKhokha webhook signature", { statusCode: 403 }); return;
      }
      if (!body.externalTransactionID || !body.paylinkID || body.responseCode !== "00") {
        sendError(res, "Invalid iKhokha webhook payload", { statusCode: 400 }); return;
      }
      if (body.status === "SUCCESS") await this.completePaidOrder(body.externalTransactionID, body.paylinkID, req);
      else if (body.status === "FAILURE") await ordersService.markAsFailed(body.externalTransactionID, body.paylinkID);
      res.sendStatus(200);
    } catch (err: unknown) { sendError(res, err instanceof Error ? err.message : "Webhook processing failed"); }
  }

  async handleReturn(req: Request, res: Response): Promise<void> {
    const orderId = req.params.orderId;
    try {
      if (!this.validToken(orderId, "return", req.query.verify)) throw new Error("Invalid payment return token");
      const status = await paymentsService.getStatus(orderId);
      if (status.status === "PAID") await this.completePaidOrder(orderId, status.paylinkID, req);
      const order = await ordersService.getByOrderId(orderId);
      res.redirect(302, appendQuery(config.ikhokha.successUrl, { ref: order.order_id, status: order.payment_status }));
    } catch (err: unknown) { sendError(res, err instanceof Error ? err.message : "Failed to verify payment"); }
  }

  async handleCancel(req: Request, res: Response): Promise<void> {
    const orderId = req.params.orderId;
    try {
      if (!this.validToken(orderId, "cancel", req.query.verify)) throw new Error("Invalid payment cancel token");
      const current = await ordersService.getByOrderId(orderId);
      if (current.payment_status !== "paid") await ordersService.markAsCancelled(orderId);
      const target = req.query.failed === "1" ? config.ikhokha.failureUrl : config.ikhokha.cancelUrl;
      res.redirect(302, appendQuery(target, { ref: orderId, status: req.query.failed === "1" ? "failed" : "cancelled" }));
    } catch (err: unknown) { sendError(res, err instanceof Error ? err.message : "Failed to cancel payment"); }
  }
}

export const paymentsController = new PaymentsController();
