import request from "supertest";
import app from "../../../server";
import { authService } from "../auth.service";
import { auditService } from "../../audit";

jest.mock("../auth.service");
jest.mock("../../audit");

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockAudit = auditService as jest.Mocked<typeof auditService>;

describe("Auth Module — /api/auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAudit.log = jest.fn().mockResolvedValue(undefined);
  });

  describe("POST /login", () => {
    it("returns token on valid credentials", async () => {
      mockAuth.login = jest.fn().mockResolvedValue({
        token: "mock-jwt", admin: { id: "admin-1", email: "bakonetrades@gmail.com" },
      });
      const res = await request(app).post("/api/auth/login").send({ email: "bakonetrades@gmail.com", password: "admin123" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe("mock-jwt");
    });
    it("returns 400 when fields missing", async () => {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).toBe(400);
    });
    it("returns 401 for wrong password", async () => {
      mockAuth.login = jest.fn().mockRejectedValue(new Error("Invalid credentials"));
      const res = await request(app).post("/api/auth/login").send({ email: "x@x.com", password: "wrong" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /me", () => {
    it("returns 401 without Bearer token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });
});
