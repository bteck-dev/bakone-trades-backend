import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../../server";
import { ordersService } from "../orders.service";
import { mockOrders } from "../../../__mocks__/supabase.mock";
import { auditService } from "../../audit";

jest.mock("../orders.service");
jest.mock("../../audit");

const mockSvc = ordersService as jest.Mocked<typeof ordersService>;
const mockAudit = auditService as jest.Mocked<typeof auditService>;
const token = jwt.sign({ id: "admin-1", email: "bakonetrades@gmail.com" }, process.env.JWT_SECRET!);

describe("Orders Module — /api/orders", () => {
  beforeEach(() => { jest.clearAllMocks(); mockAudit.log = jest.fn().mockResolvedValue(undefined); });

  it("GET / requires auth", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  it("GET / returns paginated orders", async () => {
    mockSvc.getAll = jest.fn().mockResolvedValue({ orders: mockOrders, pagination: { total: 2, page: 1, limit: 20, pages: 1 } });
    const res = await request(app).get("/api/orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders).toHaveLength(2);
    expect(res.body.meta.pagination.total).toBe(2);
  });

  it("GET /pending-delivery returns only undelivered paid orders", async () => {
    mockSvc.getPendingDeliveries = jest.fn().mockResolvedValue([mockOrders[0]]);
    const res = await request(app).get("/api/orders/pending-delivery").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.orders[0].key_status).toBe("pending_delivery");
  });

  it("PATCH /:id/deliver marks order delivered", async () => {
    mockSvc.markDelivered = jest.fn().mockResolvedValue({ ...mockOrders[0], key_status: "delivered", delivery_method: "whatsapp" });
    const res = await request(app)
      .patch("/api/orders/BT-ABC123/deliver")
      .set("Authorization", `Bearer ${token}`)
      .send({ delivery_method: "whatsapp", delivery_notes: "Sent!" });
    expect(res.status).toBe(200);
    expect(res.body.data.order.key_status).toBe("delivered");
  });

  it("PATCH /:id/deliver returns 400 if delivery_method missing", async () => {
    const res = await request(app)
      .patch("/api/orders/BT-ABC123/deliver")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
