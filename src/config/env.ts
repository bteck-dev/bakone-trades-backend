import dotenv from "dotenv";
dotenv.config();

const parseOrigins = (value?: string): string[] => {
  if (!value) return [];
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
};

const isProduction = process.env.NODE_ENV === "production";
const requiredProductionEnv = [
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_NOTIFY_URL",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
];

if (isProduction) {
  const missing = requiredProductionEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`[env] Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (process.env.JWT_SECRET === "fallback-secret") {
    throw new Error("[env] JWT_SECRET must be changed in production.");
  }
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000"),
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  payfast: {
    merchantId: process.env.PAYFAST_MERCHANT_ID || "",
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || "",
    passphrase: process.env.PAYFAST_PASSPHRASE || "",
    mode: process.env.PAYFAST_MODE || "sandbox",
    url:
      process.env.PAYFAST_MODE === "production"
        ? "https://www.payfast.co.za/eng/process"
        : "https://sandbox.payfast.co.za/eng/process",
    returnUrl: process.env.PAYFAST_RETURN_URL || "",
    cancelUrl: process.env.PAYFAST_CANCEL_URL || "",
    notifyUrl: process.env.PAYFAST_NOTIFY_URL || "",
    usdToZarRate: Number(process.env.PAYFAST_USD_TO_ZAR_RATE || "18.50"),
  },
  gmail: {
    user: process.env.GMAIL_USER || "",
    appPassword: process.env.GMAIL_APP_PASSWORD || "",
  },
  robotrader: {
    appDownloadUrl:
      process.env.ROBOTRADER_APP_DOWNLOAD_URL ||
      "https://robotrader.take-profit-signals.co.za/info/downloads/RoboTrader5.apk",
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v20.0",
  },
  admin: {
    email: process.env.ADMIN_EMAIL || "",
    password: process.env.ADMIN_PASSWORD || "",
    whatsapp: process.env.ADMIN_WHATSAPP || "",
  },
};
