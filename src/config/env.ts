import dotenv from "dotenv";
dotenv.config();

const parseOrigins = (value?: string): string[] => {
  if (!value) return [];
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
};

const isProduction = process.env.NODE_ENV === "production";
const ikhokhaMode = (process.env.IKHOKHA_MODE || "live").toLowerCase();
const requiredProductionEnv = [
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "IKHOKHA_APP_ID",
  "IKHOKHA_APP_SECRET",
  "IKHOKHA_ZAR_PER_USD",
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

const zarPerUsd = Number(process.env.IKHOKHA_ZAR_PER_USD || "18");
if (!Number.isFinite(zarPerUsd) || zarPerUsd <= 0) {
  throw new Error("[env] IKHOKHA_ZAR_PER_USD must be a positive number.");
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
  ikhokha: {
    appId: process.env.IKHOKHA_APP_ID || "",
    appSecret: process.env.IKHOKHA_APP_SECRET || "",
    mode: ikhokhaMode,
    apiUrl: (process.env.IKHOKHA_API_URL || "https://api.ikhokha.com").replace(/\/$/, ""),
    requesterUrl: process.env.IKHOKHA_REQUESTER_URL || process.env.FRONTEND_URL || "https://bakonetrades.com",
    callbackUrl: process.env.IKHOKHA_CALLBACK_URL || "https://api.bakonetrades.com/api/payments/webhook",
    successUrl: process.env.IKHOKHA_SUCCESS_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/success`,
    failureUrl: process.env.IKHOKHA_FAILURE_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/shop?failed=1`,
    cancelUrl: process.env.IKHOKHA_CANCEL_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/shop?cancelled=1`,
    currency: "ZAR",
    zarPerUsd,
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
