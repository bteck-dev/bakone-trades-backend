import supabase from "../../config/supabase";
import { HealthStatus, ServiceStatus } from "./health.model";

export class HealthService {
  async getHealth(): Promise<HealthStatus> {
    const dbStatus = await this.checkDatabase();
    const payfastStatus = await this.checkPayfast();
    const emailStatus = this.checkEmail();

    const allOk = [dbStatus, payfastStatus, emailStatus].every((s) => s.status === "ok");
    const anyDown = [dbStatus, payfastStatus, emailStatus].some((s) => s.status === "down");

    return {
      status: allOk ? "ok" : anyDown ? "down" : "degraded",
      version: process.env.npm_package_version ?? "1.0.0",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        database: dbStatus,
        email: emailStatus,
        payfast: payfastStatus,
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

  private async checkPayfast(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const isSandbox = process.env.PAYFAST_MODE === "sandbox";
      const url = isSandbox
        ? "https://sandbox.payfast.co.za"
        : "https://www.payfast.co.za";
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      return {
        status: res.ok || res.status < 500 ? "ok" : "down",
        latency_ms: Date.now() - start,
      };
    } catch {
      return { status: "down", message: "PayFast unreachable" };
    }
  }

  private checkEmail(): ServiceStatus {
    const configured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
    return {
      status: configured ? "ok" : "down",
      message: configured ? undefined : "Gmail credentials not configured",
    };
  }
}

export const healthService = new HealthService();
