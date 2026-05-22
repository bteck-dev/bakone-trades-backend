import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../../server";
import { auditService } from "../audit.service";
import { mockAuditLogs } from "../../../__mocks__/supabase.mock";

jest.mock("../audit.service");

const mockSvc = auditService as jest.Mocked<typeof auditService>;
const token = jwt.sign({ id: "admin-1", email: "bakonetrades@gmail.com" }, process.env.JWT_SECRET!);

describe("Audit Module — /api/audit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GET / returns 401 without token", async () => {
    const res = await request(app).get("/api/audit");
    expect(res.status).toBe(401);
  });

  it("GET / returns audit logs", async () => {
    mockSvc.getAll = jest.fn().mockResolvedValue({ logs: mockAuditLogs, pagination: { total: 2, page: 1, limit: 20, pages: 1 } });
    const res = await request(app).get("/api/audit").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.logs).toHaveLength(2);
    expect(res.body.data.logs[0].action).toBe("ADMIN_LOGIN");
    expect(res.body.meta.pagination.total).toBe(2);
  });
});
