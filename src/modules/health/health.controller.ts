import { Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { sendError, sendSuccess } from "../../utils/apiResponse";

const getDatabaseErrorDetails = (err: unknown): Record<string, unknown> => {
  if (err instanceof Error) {
    return { message: err.message };
  }

  if (err && typeof err === "object") {
    const error = err as Record<string, unknown>;

    return {
      message: typeof error.message === "string" ? error.message : "Database check failed",
      check: error.check,
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
  }

  return { message: typeof err === "string" ? err : "Database check failed" };
};

const getJwtPayload = (token: string): Record<string, unknown> | null => {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalizedPayload, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const verifyServiceRoleKey = (key: string): void => {
  const payload = getJwtPayload(key);

  if (!payload) {
    return;
  }

  if (payload.role !== "service_role") {
    throw {
      message: "SUPABASE_SERVICE_ROLE_KEY must have role=service_role",
      check: "service_role_key",
      details: `Received role=${String(payload.role ?? "missing")}`,
    };
  }
};

export class HealthController {
  async check(req: Request, res: Response): Promise<void> {
    const start = Date.now();
    const checks: Record<string, any> = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    };

    // Check Supabase connectivity
    try {
      if (!process.env.SUPABASE_URL) {
        throw new Error("SUPABASE_URL is missing");
      }

      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
      }

      verifyServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

      const { error } = await supabase.from("products").select("id").limit(1);

      if (error) {
        throw error;
      }

      const { error: serviceRoleError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      if (serviceRoleError) {
        throw {
          ...serviceRoleError,
          message: `SUPABASE_SERVICE_ROLE_KEY check failed: ${serviceRoleError.message}`,
          check: "service_role_key",
        };
      }

      checks.database = {
        status: "ok",
        table: "products",
        service_role_key: "ok",
        latency_ms: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorDetails = getDatabaseErrorDetails(err);

      console.error("[Health Check] Supabase database check failed", {
        table: "products",
        latency_ms: Date.now() - start,
        ...errorDetails,
      });

      checks.database = {
        status: "error",
        table: "products",
        latency_ms: Date.now() - start,
        ...errorDetails,
      };
      checks.status = "degraded";
    }

    const statusCode = checks.status === "ok" ? 200 : 503;
    if (checks.status === "ok") {
      sendSuccess(res, checks, { message: "Health check passed", statusCode });
      return;
    }

    sendError(res, "Health check failed", {
      statusCode,
      code: "HEALTH_CHECK_FAILED",
      data: checks,
    });
  }

  async ping(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { pong: true }, { message: "Pong" });
  }
}

export const healthController = new HealthController();
