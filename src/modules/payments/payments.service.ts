import crypto from "crypto";
import { config } from "../../config/env";

interface PayFastData { [key: string]: string; }

const PAYFAST_SIGNATURE_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "payment_method",
];

const payFastEncode = (value: string): string =>
  encodeURIComponent(value.trim())
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");

const cleanValue = (value: string): string => value.trim();

const isLocalUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const convertUsdToZar = (usdAmount: number): number => {
  const rate = config.payfast.usdToZarRate;

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("PAYFAST_USD_TO_ZAR_RATE must be a positive number");
  }

  return Math.round(usdAmount * rate * 100) / 100;
};

export class PaymentsService {
  getSignatureString(data: PayFastData): string {
    const query = PAYFAST_SIGNATURE_FIELD_ORDER
      .filter((k) => k !== "signature" && data[k] !== undefined && data[k] !== "")
      .map((k) => `${k}=${payFastEncode(data[k])}`)
      .join("&");
    const passphrase = config.payfast.passphrase.trim();
    return passphrase ? `${query}&passphrase=${payFastEncode(passphrase)}` : query;
  }

  generateSignature(data: PayFastData): string {
    return crypto.createHash("md5").update(this.getSignatureString(data)).digest("hex");
  }

  buildCheckoutPayload(params: {
    customerName: string;
    customerEmail: string;
    productName: string;
    amount: number;
    orderId: string;
    returnUrl?: string;
    cancelUrl?: string;
  }) {
    const zarAmount = convertUsdToZar(params.amount);
    const data: PayFastData = {
      merchant_id: cleanValue(config.payfast.merchantId),
      merchant_key: cleanValue(config.payfast.merchantKey),
      return_url: cleanValue(params.returnUrl || config.payfast.returnUrl),
      cancel_url: cleanValue(params.cancelUrl || config.payfast.cancelUrl),
      name_first: cleanValue(params.customerName.split(" ")[0]),
      name_last: cleanValue(params.customerName.split(" ").slice(1).join(" ") || ""),
      email_address: cleanValue(params.customerEmail),
      cell_number: "",
      m_payment_id: cleanValue(params.orderId),
      amount: zarAmount.toFixed(2),
      item_name: cleanValue(params.productName),
      item_description: cleanValue(params.productName),
      custom_str1: `USD ${params.amount.toFixed(2)}`,
      custom_str2: `USD_ZAR ${config.payfast.usdToZarRate}`,
    };

    if (config.payfast.notifyUrl && !isLocalUrl(config.payfast.notifyUrl)) {
      data.notify_url = cleanValue(config.payfast.notifyUrl);
    }

    data.signature = this.generateSignature(data);
    return { data, actionUrl: config.payfast.url };
  }

  verifyITN(rawBody: Buffer): { valid: boolean; data?: PayFastData; reason?: string } {
    const params = new URLSearchParams(rawBody.toString());
    const pfData: PayFastData = {};
    params.forEach((v, k) => { pfData[k] = v; });

    const received = pfData.signature;
    const { signature, ...rest } = pfData;
    const calculated = this.generateSignature(rest);

    if (received !== calculated) return { valid: false, reason: "Signature mismatch" };
    return { valid: true, data: pfData };
  }
}
export const paymentsService = new PaymentsService();
