import crypto from "crypto";
import { config } from "../../config/env";

type CreatePaymentResponse = { responseCode: string; message?: string; paylinkUrl?: string; paylinkID?: string };
export type IkhokhaPaymentStatus = { paylinkID: string; status: string; amount?: number; externalTransactionID?: string };
export type IkhokhaWebhook = { paylinkID: string; status: string; externalTransactionID: string; responseCode: string; text?: unknown };

const jsStringEscape = (value: string): string =>
  value.replace(/[\\"']/g, "\\$&").replace(/\u0000/g, "\\0");

export class PaymentsService {
  private sign(path: string, body = ""): string {
    return crypto.createHmac("sha256", config.ikhokha.appSecret.trim())
      .update(jsStringEscape(path + body)).digest("hex");
  }

  private assertConfigured(): void {
    if (!config.ikhokha.appId || !config.ikhokha.appSecret) throw new Error("iKhokha credentials are not configured");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    const body = typeof init.body === "string" ? init.body : "";
    const response = await fetch(`${config.ikhokha.apiUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", "IK-APPID": config.ikhokha.appId.trim(), "IK-SIGN": this.sign(path, body), ...(init.headers || {}) },
    });
    const payload = await response.json().catch(() => ({})) as T & { message?: string };
    if (!response.ok) throw new Error(payload.message || `iKhokha request failed (${response.status})`);
    return payload;
  }

  async createCheckout(params: { orderId: string; productName: string; amount: number; callbackUrl: string; successUrl: string; failureUrl: string; cancelUrl: string }): Promise<{ paymentId: string; paymentUrl: string }> {
    const body = JSON.stringify({
      entityID: config.ikhokha.appId.trim(), externalEntityID: params.orderId,
      amount: Math.round(params.amount * 100), currency: config.ikhokha.currency,
      requesterUrl: config.ikhokha.requesterUrl, description: params.productName,
      paymentReference: params.orderId, mode: config.ikhokha.mode, externalTransactionID: params.orderId,
      urls: { callbackUrl: params.callbackUrl, successPageUrl: params.successUrl, failurePageUrl: params.failureUrl, cancelUrl: params.cancelUrl },
    });
    const result = await this.request<CreatePaymentResponse>("/public-api/v1/api/payment", { method: "POST", body });
    if (result.responseCode !== "00" || !result.paylinkID || !result.paylinkUrl) throw new Error(result.message || "iKhokha did not create a payment link");
    return { paymentId: result.paylinkID, paymentUrl: result.paylinkUrl };
  }

  async getStatus(orderId: string): Promise<IkhokhaPaymentStatus> {
    return this.request<IkhokhaPaymentStatus>(`/public-api/v1/api/getStatus/external?externalReference=${encodeURIComponent(orderId)}`);
  }

  verifyWebhook(path: string, body: IkhokhaWebhook, appId: unknown, signature: unknown): boolean {
    if (typeof appId !== "string" || typeof signature !== "string" || appId !== config.ikhokha.appId) return false;
    const normalized = { ...body };
    delete normalized.text;
    const expected = this.sign(path, JSON.stringify(normalized));
    const received = signature.toLowerCase();
    return expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  }
}

export const paymentsService = new PaymentsService();
