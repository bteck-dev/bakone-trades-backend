import { Request, Response } from "express";
import { productsService } from "./products.service";
import { auditService } from "../audit";
import { AUDIT_ACTIONS } from "../../constants";
import { sendError, sendSuccess } from "../../utils/apiResponse";

export class ProductsController {
  async getAll(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, { products: await productsService.getAll() }); }
    catch { sendError(res, "Failed to fetch products"); }
  }
  async getAllAdmin(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, { products: await productsService.getAllAdmin() }); }
    catch { sendError(res, "Failed to fetch products"); }
  }
  async getBySlug(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, { product: await productsService.getBySlug(req.params.slug) }); }
    catch { sendError(res, "Product not found", { statusCode: 404 }); }
  }
  async create(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const product = await productsService.create(req.body);
      await auditService.log({
        action: AUDIT_ACTIONS.PRODUCT_CREATED,
        admin_id: admin.id, entity_type: "product", entity_id: product.id,
        description: `Product "${product.name}" created`, metadata: req.body, ip_address: req.ip,
      });
      sendSuccess(res, { product }, { statusCode: 201, message: "Product created" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to create product");
    }
  }
  async update(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const product = await productsService.update(req.params.id, req.body);
      await auditService.log({
        action: req.body.is_visible !== undefined ? AUDIT_ACTIONS.PRODUCT_VISIBILITY_CHANGED : AUDIT_ACTIONS.PRODUCT_UPDATED,
        admin_id: admin.id, entity_type: "product", entity_id: req.params.id,
        description: `Product "${product.name}" updated`, metadata: req.body, ip_address: req.ip,
      });
      sendSuccess(res, { product }, { message: "Product updated" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to update");
    }
  }
  async remove(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const product = await productsService.remove(req.params.id);
      await auditService.log({
        action: AUDIT_ACTIONS.PRODUCT_REMOVED,
        admin_id: admin.id, entity_type: "product", entity_id: req.params.id,
        description: `Product "${product.name}" removed from storefront`, metadata: { is_visible: false }, ip_address: req.ip,
      });
      sendSuccess(res, { product }, { message: "Product removed from storefront" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to remove product");
    }
  }
}
export const productsController = new ProductsController();
