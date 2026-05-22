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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
    if (typeof token !== "string") {
      return false;
    }

    return token === this.createReturnToken(orderId, action);
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

    const { data, actionUrl } = paymentsService.buildCheckoutPayload({
      customerName: customer_name,
      customerEmail: customer_email,
      productName: order.product_name,
      amount: order.amount,
      orderId: order.order_id,
      returnUrl: appendQuery(`${this.getBaseUrl(req)}/api/payments/return/${encodeURIComponent(order.order_id)}`, {
        token: this.createReturnToken(order.order_id, "return"),
      }),
      cancelUrl: appendQuery(`${this.getBaseUrl(req)}/api/payments/cancel/${encodeURIComponent(order.order_id)}`, {
        token: this.createReturnToken(order.order_id, "cancel"),
      }),
    });

    await auditService.log({
      action: AUDIT_ACTIONS.ORDER_CREATED,
      entity_type: "order",
      entity_id: order.order_id,
      description: `Checkout initiated for ${customer_email} - ${order.product_name}`,
      ip_address: req.ip,
    });

    return { order, data, actionUrl };
  }

  private renderPayFastForm(
    actionUrl: string,
    data: Record<string, string>,
    nonce: string,
    debug = false
  ): string {
    const inputs = Object.entries(data)
      .filter(([, value]) => value !== "")
      .map(
        ([key, value]) =>
          `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}" />`
      )
      .join("\n");
    const debugRows = Object.entries(data)
      .filter(([, value]) => value !== "")
      .map(
        ([key, value]) =>
          `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`
      )
      .join("\n");
    const signatureString = paymentsService.getSignatureString(data);
    const autoSubmitScript = debug
      ? ""
      : `<script nonce="${escapeHtml(nonce)}">
      document.getElementById("payfast-form").submit();
    </script>`;
    const debugContent = debug
      ? `<h1>PayFast Debug</h1>
    <p>Review the fields below, then submit the form manually.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      ${debugRows}
    </table>
    <h2>Signature String</h2>
    <pre>${escapeHtml(signatureString)}</pre>
    <p><button type="submit">Submit to PayFast</button></p>`
      : "";

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting to PayFast</title>
  </head>
  <body>
    <form id="payfast-form" method="post" enctype="application/x-www-form-urlencoded" accept-charset="UTF-8" action="${escapeHtml(actionUrl)}">
      ${inputs}
      ${debugContent}
      <noscript>
        <button type="submit">Continue to PayFast</button>
      </noscript>
    </form>
    ${autoSubmitScript}
  </body>
</html>`;
  }

  async initiateCheckout(req: Request, res: Response): Promise<void> {
    try {
      const { order, data, actionUrl } = await this.createCheckout(req.body, req);
      sendSuccess(res, { orderId: order.order_id, payfast: { actionUrl, data } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      const statusCode = message.includes("required") ? 400 : 500;
      sendError(res, message, { statusCode });
    }
  }

  async redirectToPayFast(req: Request, res: Response): Promise<void> {
    try {
      const { data, actionUrl } = await this.createCheckout(req.query as CheckoutInput, req);
      const nonce = crypto.randomBytes(16).toString("base64");
      const debug = req.query.debug === "1" || req.query.debug === "true";
      res
        .status(200)
        .setHeader(
          "Content-Security-Policy",
          `default-src 'self'; base-uri 'self'; form-action https://sandbox.payfast.co.za https://www.payfast.co.za; script-src 'self' 'nonce-${nonce}'`
        )
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(this.renderPayFastForm(actionUrl, data, nonce, debug));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      const statusCode = message.includes("required") ? 400 : 500;
      sendError(res, message, { statusCode });
    }
  }

  async handleReturn(req: Request, res: Response): Promise<void> {
    const orderId = req.params.orderId;

    try {
      let order = await ordersService.getByOrderId(orderId);

      if (config.payfast.mode !== "production" && order.payment_status !== "paid") {
        if (!this.isValidReturnToken(orderId, "return", req.query.token)) {
          throw new Error("Invalid payment return token");
        }

        order = await ordersService.markAsPaid(orderId, `sandbox-return-${orderId}`);
        await auditService.log({
          action: AUDIT_ACTIONS.ORDER_PAID,
          entity_type: "order",
          entity_id: order.order_id,
          description: `Payment marked paid from sandbox browser return for ${order.order_id}`,
          metadata: { source: "browser_return", mode: config.payfast.mode },
          ip_address: req.ip,
        });
        await emailService.sendPaymentConfirmation(order);
        await emailService.sendAdminNewOrderAlert(order);
      }

      res.redirect(302, appendQuery(config.payfast.returnUrl, {
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
        if (!this.isValidReturnToken(orderId, "cancel", req.query.token)) {
          throw new Error("Invalid payment cancel token");
        }

        order = await ordersService.markAsCancelled(orderId);
        await auditService.log({
          action: AUDIT_ACTIONS.ORDER_CANCELLED,
          entity_type: "order",
          entity_id: order.order_id,
          description: `Payment cancelled from PayFast browser return for ${order.order_id}`,
          metadata: { source: "browser_cancel", mode: config.payfast.mode },
          ip_address: req.ip,
        });
      }

      res.redirect(302, appendQuery(config.payfast.cancelUrl, {
        ref: order.order_id,
        cancelled: "1",
        status: order.payment_status,
      }));
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to process payment cancellation");
    }
  }

  async handleITN(req: Request, res: Response): Promise<void> {
    res.status(200).send("OK");
    try {
      await auditService.log({
        action: AUDIT_ACTIONS.PAYFAST_ITN_RECEIVED,
        description: "PayFast ITN received",
        ip_address: req.ip,
      });
      const { valid, data, reason } = paymentsService.verifyITN(req.body as Buffer);
      if (!valid || !data) {
        await auditService.log({
          action: AUDIT_ACTIONS.PAYFAST_ITN_INVALID,
          description: `ITN invalid: ${reason}`,
          ip_address: req.ip,
        });
        return;
      }
      await auditService.log({
        action: AUDIT_ACTIONS.PAYFAST_ITN_VERIFIED,
        description: `ITN verified for order ${data.m_payment_id}`,
      });
      if (data.payment_status === "COMPLETE") {
        const order = await ordersService.markAsPaid(data.m_payment_id, data.pf_payment_id);
        await auditService.log({
          action: AUDIT_ACTIONS.ORDER_PAID,
          entity_type: "order",
          entity_id: order.order_id,
          description: `Payment confirmed for order ${order.order_id} - ${order.customer_email}`,
          metadata: { amount: order.amount, product: order.product_name },
        });
        await emailService.sendPaymentConfirmation(order);
        await emailService.sendAdminNewOrderAlert(order);
        return;
      }

      const order = await ordersService.markAsFailed(data.m_payment_id, data.pf_payment_id);
      await auditService.log({
        action: AUDIT_ACTIONS.ORDER_FAILED,
        entity_type: "order",
        entity_id: order.order_id,
        description: `Payment failed for order ${order.order_id}`,
        metadata: { payment_status: data.payment_status, pf_payment_id: data.pf_payment_id },
      });
    } catch (err) {
      console.error("[PayFast ITN] Error:", err);
    }
  }
}

export const paymentsController = new PaymentsController();
