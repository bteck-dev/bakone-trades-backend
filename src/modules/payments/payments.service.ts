import { config } from "../../config/env";

type PayPalLink = {
  href: string;
  rel: string;
  method?: string;
};

type PayPalOrderResponse = {
  id: string;
  status: string;
  links?: PayPalLink[];
};

type PayPalCaptureResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
      }>;
    };
  }>;
};

const cleanValue = (value: string): string => value.trim();

export class PaymentsService {
  private accessToken?: { value: string; expiresAt: number };

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }

    if (!config.paypal.clientId || !config.paypal.clientSecret) {
      throw new Error("PayPal credentials are not configured");
    }

    const credentials = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64");
    const response = await fetch(`${config.paypal.apiUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const body = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };

    if (!response.ok || !body.access_token) {
      throw new Error(body.error_description || "Could not authenticate with PayPal");
    }

    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + ((body.expires_in || 300) * 1000),
    };

    return body.access_token;
  }

  private async requestPayPal<T>(path: string, init: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.paypal.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    const body = await response.json().catch(() => ({})) as T & { message?: string; details?: Array<{ issue?: string; description?: string }> };

    if (!response.ok) {
      const detail = body.details?.[0]?.description || body.details?.[0]?.issue || body.message;
      throw new Error(detail || "PayPal request failed");
    }

    return body as T;
  }

  async createCheckout(params: {
    orderId: string;
    productName: string;
    amount: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ paypalOrderId: string; approvalUrl: string; status: string }> {
    if (config.paypal.mode === "mock") {
      const paypalOrderId = `MOCK-${cleanValue(params.orderId)}`;
      return {
        paypalOrderId,
        approvalUrl: `${params.returnUrl}&token=${encodeURIComponent(paypalOrderId)}`,
        status: "CREATED",
      };
    }

    const currency = cleanValue(params.currency || config.paypal.currency).toUpperCase();
    const order = await this.requestPayPal<PayPalOrderResponse>("/v2/checkout/orders", {
      method: "POST",
      headers: {
        "PayPal-Request-Id": cleanValue(params.orderId),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: cleanValue(params.orderId),
          description: cleanValue(params.productName),
          amount: {
            currency_code: currency,
            value: params.amount.toFixed(2),
          },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Bakone Trades",
              landing_page: "LOGIN",
              user_action: "PAY_NOW",
              return_url: params.returnUrl,
              cancel_url: params.cancelUrl,
            },
          },
        },
      }),
    });

    const approvalUrl = order.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;

    if (!order.id || !approvalUrl) {
      throw new Error("PayPal did not return an approval URL");
    }

    return { paypalOrderId: order.id, approvalUrl, status: order.status };
  }

  async captureOrder(paypalOrderId: string): Promise<{ paypalOrderId: string; captureId: string; status: string }> {
    if (config.paypal.mode === "mock") {
      return {
        paypalOrderId,
        captureId: `MOCK-CAPTURE-${paypalOrderId.replace(/^MOCK-/, "")}`,
        status: "COMPLETED",
      };
    }

    const capture = await this.requestPayPal<PayPalCaptureResponse>(
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      { method: "POST", body: "{}" }
    );
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || capture.id;

    return {
      paypalOrderId: capture.id,
      captureId,
      status: capture.status,
    };
  }
}

export const paymentsService = new PaymentsService();
