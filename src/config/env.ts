import dotenv from "dotenv";
dotenv.config();

const parseOrigins = (value?: string): string[] => {
  if (!value) return [];
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
};

const isProduction = process.env.NODE_ENV === "production";
const paypalMode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
const isPaypalProduction = paypalMode === "production" || paypalMode === "live";
const isPaypalMock = !isProduction && paypalMode === "mock";
const requiredProductionEnv = [
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
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
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    mode: isPaypalMock ? "mock" : isPaypalProduction ? "production" : "sandbox",
    apiUrl: isPaypalProduction ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
    returnUrl: process.env.PAYPAL_RETURN_URL || process.env.FRONTEND_URL || "",
    cancelUrl: process.env.PAYPAL_CANCEL_URL || process.env.FRONTEND_URL || "",
    currency: process.env.PAYPAL_CURRENCY || "USD",
  },
  email: {
    from: process.env.EMAIL_FROM || "",
    resendApiKey: process.env.RESEND_API_KEY || "",
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
