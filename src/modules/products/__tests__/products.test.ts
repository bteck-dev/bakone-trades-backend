import request from "supertest";
import app from "../../../server";
import { productsService } from "../products.service";
import { mockProducts } from "../../../__mocks__/supabase.mock";

jest.mock("../products.service");
jest.mock("../../audit");

const mockSvc = productsService as jest.Mocked<typeof productsService>;

describe("Products Module — /api/products", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GET / returns all visible products", async () => {
    mockSvc.getAll = jest.fn().mockResolvedValue(mockProducts);
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products).toHaveLength(2);
    expect(res.body.data.products[0].price).toBe(30);
    expect(res.body.data.products[1].price).toBe(21);
  });

  it("GET /:slug returns product by slug", async () => {
    mockSvc.getBySlug = jest.fn().mockResolvedValue(mockProducts[0]);
    const res = await request(app).get("/api/products/fx-killer-pv4-pro");
    expect(res.status).toBe(200);
    expect(res.body.data.product.slug).toBe("fx-killer-pv4-pro");
  });

  it("GET /:slug returns 404 for unknown slug", async () => {
    mockSvc.getBySlug = jest.fn().mockRejectedValue(new Error("Not found"));
    const res = await request(app).get("/api/products/does-not-exist");
    expect(res.status).toBe(404);
  });
});
