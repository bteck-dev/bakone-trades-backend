import request from "supertest";
import app from "../../../server";

const mockLimit = jest.fn();
const mockListUsers = jest.fn();

const createFakeSupabaseJwt = (role: string) => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");

  return `${header}.${payload}.signature`;
};

jest.mock("../../../config/supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ limit: (...args: unknown[]) => mockLimit(...args) }),
    }),
    auth: {
      admin: {
        listUsers: (...args: unknown[]) => mockListUsers(...args),
      },
    },
  },
}));

describe("Health Module - /api/health", () => {
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = createFakeSupabaseJwt("service_role");
    mockLimit.mockClear();
    mockListUsers.mockClear();
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    jest.restoreAllMocks();
  });

  it("GET / returns 200 with status ok when database check succeeds", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.database.status).toBe("ok");
    expect(res.body.data.database.service_role_key).toBe("ok");
    expect(res.body.data).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET / returns 200 when an opaque service key is accepted by Supabase Admin", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_example_key";

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.database.service_role_key).toBe("ok");
    expect(mockLimit).toHaveBeenCalled();
    expect(mockListUsers).toHaveBeenCalledWith({ page: 1, perPage: 1 });
  });

  it("GET / returns 503 when database check fails", async () => {
    mockLimit.mockResolvedValueOnce({
      data: null,
      error: new Error("Database connection failed"),
    });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe("degraded");
    expect(res.body.data.database.status).toBe("error");
    expect(res.body.data.database.message).toBe("Database connection failed");
    expect(console.error).toHaveBeenCalledWith(
      "[Health Check] Supabase database check failed",
      expect.objectContaining({ message: "Database connection failed" })
    );
  });

  it("GET / returns 503 when service role key check fails", async () => {
    mockListUsers.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Invalid API key",
        status: 401,
      },
    });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe("degraded");
    expect(res.body.data.database.status).toBe("error");
    expect(res.body.data.database.check).toBe("service_role_key");
    expect(res.body.data.database.message).toBe("SUPABASE_SERVICE_ROLE_KEY check failed: Invalid API key");
    expect(console.error).toHaveBeenCalledWith(
      "[Health Check] Supabase database check failed",
      expect.objectContaining({
        check: "service_role_key",
        message: "SUPABASE_SERVICE_ROLE_KEY check failed: Invalid API key",
      })
    );
  });

  it("GET / returns 503 when SUPABASE_SERVICE_ROLE_KEY is an anon key", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = createFakeSupabaseJwt("anon");

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe("degraded");
    expect(res.body.data.database.status).toBe("error");
    expect(res.body.data.database.check).toBe("service_role_key");
    expect(res.body.data.database.message).toBe("SUPABASE_SERVICE_ROLE_KEY must have role=service_role");
    expect(res.body.data.database.details).toBe("Received role=anon");
    expect(mockLimit).not.toHaveBeenCalled();
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("GET / returns Supabase error details when database returns a plain object error", async () => {
    mockLimit.mockResolvedValueOnce({
      data: null,
      error: {
        message: "relation public.products does not exist",
        code: "42P01",
        details: null,
        hint: "Check that the products table exists in Supabase.",
      },
    });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.data.database.message).toBe("relation public.products does not exist");
    expect(res.body.data.database.code).toBe("42P01");
    expect(res.body.data.database.table).toBe("products");
  });

  it("GET /ping returns pong", async () => {
    const res = await request(app).get("/api/health/ping");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pong).toBe(true);
  });
});
