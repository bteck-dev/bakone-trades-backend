import { Request, Response } from "express";
import crypto from "crypto";
import { paymentsService } from "./payments.service";
import { ordersService } from "../orders";
import { productsService } from "../products";
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

  private async createHostedLinkCheckout(input: CheckoutInput, req: Request) {
    const { customer_name, customer_email, customer_phone, product_id } = input;

    if (!customer_name || !customer_email || !product_id) {
      throw new Error("customer_name, customer_email, and product_id are required");
    }

    const product = await productsService.getById(product_id);
    const paymentLink = product.payment_link?.trim();

    if (!paymentLink) {
      throw new Error("No payment link is configured for this product");
    }

    const order = await ordersService.createPendingOrder({
      customer_name,
      customer_email,
      customer_phone,
      product_id,
      payment_method: "paypal",
    });

    await auditService.log({
      action: AUDIT_ACTIONS.ORDER_CREATED,
      entity_type: "order",
      entity_id: order.order_id,
      description: `Hosted PayPal checkout started for ${customer_email} - ${order.product_name}`,
      metadata: {
        payment_provider: "paypal",
        payment_method: "hosted_link",
        payment_link: paymentLink,
      },
      ip_address: req.ip,
    });

    return { order, paymentLink };
  }

  async initiateCheckout(req: Request, res: Response): Promise<void> {
    try {
      const { order, paymentLink } = await this.createHostedLinkCheckout(req.body, req);
      sendSuccess(res, {
        orderId: order.order_id,
        paymentLink,
        approvalUrl: paymentLink,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      const statusCode = message.includes("required") || message.includes("No payment link") ? 400 : 500;
      sendError(res, message, { statusCode });
    }
  }

  async redirectToPayPal(req: Request, res: Response): Promise<void> {
    try {
      const { paymentLink } = await this.createHostedLinkCheckout(req.query as CheckoutInput, req);
      res.redirect(302, paymentLink);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      const statusCode = message.includes("required") || message.includes("No payment link") ? 400 : 500;
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