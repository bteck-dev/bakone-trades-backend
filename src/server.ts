import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config/env";
import { sendError } from "./utils/apiResponse";

// Module routes
import { authRoutes } from "./modules/auth";
import { productsRoutes } from "./modules/products";
import { ordersRoutes } from "./modules/orders";
import { licensesRoutes } from "./modules/licenses";
import { customersRoutes } from "./modules/customers";
import { dashboardRoutes } from "./modules/dashboard";
import { healthRoutes } from "./modules/health";
import { paymentsRoutes } from "./modules/payments";
import { auditRoutes } from "./modules/audit";
import { messagesRoutes } from "./modules/messages";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

// ── Security ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
}));

// ── Body Parsers ────────────────────────────────────────────
// PayFast ITN needs raw body
app.use("/api/payments/notify", express.raw({ type: "*/*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/licenses", licensesRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/messages", messagesRoutes);

// ── 404 ─────────────────────────────────────────────────────
app.use((_req, res) => sendError(res, "Route not found", { statusCode: 404, code: "ROUTE_NOT_FOUND" }));

// ── Error Handler ───────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Unhandled Error]", err);
  sendError(res, "Internal server error", { statusCode: 500, code: "INTERNAL_SERVER_ERROR" });
});

// ── Start ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`✅ Bakone Trades API running on port ${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
  });
}

export default app;
