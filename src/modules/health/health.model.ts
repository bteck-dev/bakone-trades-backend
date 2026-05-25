// ─── health.model.ts ───────────────────────────────────────
export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    email: ServiceStatus;
    paypal: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: "ok" | "down";
  latency_ms?: number;
  message?: string;
}
