import supabase from "../../config/supabase";
import { config } from "../../config/env";
import { HealthStatus, ServiceStatus } from "./health.model";

export class HealthService {
  async getHealth(): Promise<HealthStatus> {
    const dbStatus = await this.checkDatabase();
    const paypalStatus = await this.checkPayPal();
    const emailStatus = this.checkEmail();

    const allOk = [dbStatus, paypalStatus, emailStatus].every((s) => s.status === "ok");
    const anyDown = [dbStatus, paypalStatus, emailStatus].some((s) => s.status === "down");

    return {
      status: allOk ? "ok" : anyDown ? "down" : "degraded",
      version: process.env.npm_package_version ?? "1.0.0",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        database: dbStatus,
        email: emailStatus,
        paypal: paypalStatus,
      },
    };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const { error } = await supabase.from("products").select("id").limit(1);
      if (error) throw error;
      return { status: "ok", latency_ms: Date.now() - start };
    } catch (err: any) {
      return { status: "down", message: err.message };
    }
  }

  private async checkPayPal(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const res = await fetch(config.paypal.apiUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      return {
        status: res.ok || res.status < 500 ? "ok" : "down",
        latency_ms: Date.now() - start,
      };
    } catch {
      return { status: "down", message: "PayPal unreachable" };
    }
  }

  private checkEmail(): ServiceStatus {
    const configured = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    return {
      status: configured ? "ok" : "down",
      message: configured ? undefined : "Resend email credentials not configured",
    };
  }
}

export const healthService = new HealthService();
