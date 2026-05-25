import { Request, Response } from "express";
import crypto from "crypto";
import { paymentsService } from "./payments.service";
import { ordersService } from "../orders";
import { auditService } from "../audit";
import { AUDIT_ACTIONS } from "../../constants";
import { emailService } from "../../services/email.service";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { config } from "../../config/env";

type CheckoutInput = {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  product_id?: string;
};

const appendQuery = (url: string, params: Record<string, string>): string => {
  const target = new URL(url);

  Object.entries(params).forEach(([key, value]) => {
    target.searchParams.set(key, value);
  });

  return target.toString();
};

export class PaymentsController {
  private createReturnToken(orderId: string, action: "return" | "cancel"): string {
    return crypto
      .createHmac("sha256", process.env.JWT_SECRET || "fallback-secret")
      .update(`${action}:${orderId}`)
      .digest("hex");
  }

  private isValidReturnToken(orderId: string, action: "return" | "cancel", token: unknown): boolean {
    return typeof token === "string" && token === this.createReturnToken(orderId, action);
  }

  private getBaseUrl(req: Request): string {
    return `${req.protocol}://${req.get("host")}`;
  }

  private async createCheckout(input: CheckoutInput, req: Request) {
    const { customer_name, customer_email, customer_phone, product_id } = input;

    if (!customer_name || !customer_email || !product_id) {
      throw new Error("customer_name, customer_email, and product_id are required");
    }

    const order = await ordersService.createPendingOrder({
      customer_name,
      customer_email,
      customer_phone,
      product_id,
    });

    const returnUrl = appendQuery(`${this.getBaseUrl(req)}/api/payments/return/${encodeURIComponent(order.order_id)}`, {
      verify: this.createReturnToken(order.order_id, "return"),
    });
    const cancelUrl = appendQuery(`${this.getBaseUrl(req)}/api/payments/cancel/${encodeURIComponent(order.order_id)}`, {
      verify: this.createReturnToken(order.order_id, "cancel"),
    });

    const checkout = await paymentsService.createCheckout({
      orderId: order.order_id,
      productName: order.product_name,
      amount: Number(order.amount),
      currency: order.currency || config.paypal.currency,
      returnUrl,
      cancelUrl,
    });

    await auditService.log({
      action: AUDIT_ACTIONS.ORDER_CREATED,
      entity_type: "order",
      entity_id: order.order_id,
      description: `PayPal checkout initiated for ${customer_email} - ${order.product_name}`,
      metadata: { paypal_order_id: checkout.paypalOrderId },
      ip_address: req.ip,
    });

    return { order, checkout };
  }

  async initiateCheckout(req: Request, res: Response): Promise<void> {
    try {
      const { order, checkout } = await this.createCheckout(req.body, req);
      sendSuccess(res, {
        orderId: order.order_id,
        paypal: checkout,
        approvalUrl: checkout.approvalUrl,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      const statusCode = message.includes("required") ? 400 : 500;
      sendError(res, message, { statusCode });
    }
  }

  async redirectToPayPal(req: Request, res: Response): Promise<void> {
    try {
      const { checkout } = await this.createCheckout(req.query as CheckoutInput, req);
      res.redirect(302, checkout.approvalUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      const statusCode = message.includes("required") ? 400 : 500;
      sendError(res, message, { statusCode });
    }
  }

  async handleReturn(req: Request, res: Response): Promise<void> {
    const orderId = req.params.orderId;

    try {
      if (!this.isValidReturnToken(orderId, "return", req.query.verify)) {
        throw new Error("Invalid payment return token");
      }

      const paypalOrderId = String(req.query.token || "");
      if (!paypalOrderId) {
        throw new Error("Missing PayPal order token");
      }

      let order = await ordersService.getByOrderId(orderId);

      if (order.payment_status !== "paid") {
        const capture = await paymentsService.captureOrder(paypalOrderId);

        if (capture.status !== "COMPLETED") {
          order = await ordersService.markAsFailed(orderId, capture.captureId);
          throw new Error(`PayPal payment was not completed: ${capture.status}`);
        }

        order = await ordersService.markAsPaid(orderId, capture.captureId);
        await auditService.log({
          action: AUDIT_ACTIONS.ORDER_PAID,
          entity_type: "order",
          entity_id: order.order_id,
          description: `PayPal payment captured for order ${order.order_id} - ${order.customer_email}`,
          metadata: { paypal_order_id: paypalOrderId, paypal_capture_id: capture.captureId },
          ip_address: req.ip,
        });
        await emailService.sendPaymentConfirmation(order);
        await emailService.sendAdminNewOrderAlert(order);
      }

      res.redirect(302, appendQuery(config.paypal.returnUrl, {
        ref: order.order_id,
        status: order.payment_status,
      }));
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to process payment return");
    }
  }

  async handleCancel(req: Request, res: Response): Promise<void> {
    const orderId = req.params.orderId;

    try {
      let order = await ordersService.getByOrderId(orderId);

      if (order.payment_status !== "paid") {
        if (!this.isValidReturnToken(orderId, "cancel", req.query.verify)) {
          throw new Error("Invalid payment cancel token");
        }

        order = await ordersService.markAsCancelled(orderId);
        await auditService.log({
          action: AUDIT_ACTIONS.ORDER_CANCELLED,
          entity_type: "order",
          entity_id: order.order_id,
          description: `PayPal checkout cancelled for ${order.order_id}`,
          metadata: { source: "paypal_cancel" },
          ip_address: req.ip,
        });
      }

      res.redirect(302, appendQuery(config.paypal.cancelUrl, {
        ref: order.order_id,
        cancelled: "1",
        status: order.payment_status,
      }));
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to process payment cancellation");
    }
  }
}

export const paymentsController = new PaymentsController();
