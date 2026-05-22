import { Request, Response } from "express";
import { ordersService } from "./orders.service";
import { auditService } from "../audit";
import { AUDIT_ACTIONS } from "../../constants";
import { sendError, sendSuccess } from "../../utils/apiResponse";

export class OrdersController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await ordersService.getAll({
        search: req.query.search as string,
        status: req.query.status as string,
        keyStatus: req.query.key_status as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      sendSuccess(res, { orders: result.orders }, { meta: { pagination: result.pagination } });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to fetch orders");
    }
  }

  async getOne(req: Request, res: Response): Promise<void> {
    try {
      sendSuccess(res, { order: await ordersService.getByOrderId(req.params.orderId) });
    } catch {
      sendError(res, "Order not found", { statusCode: 404 });
    }
  }

  async getPendingDeliveries(req: Request, res: Response): Promise<void> {
    try {
      sendSuccess(res, { orders: await ordersService.getPendingDeliveries() });
    } catch (err: unknown) {
      sendError(res, "Failed to fetch pending deliveries");
    }
  }

  async markDelivered(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const { delivery_method, delivery_notes } = req.body;
      if (!delivery_method) { sendError(res, "delivery_method is required", { statusCode: 400 }); return; }

      const order = await ordersService.markDelivered(req.params.orderId, admin.id, { delivery_method, delivery_notes });
      await auditService.log({
        action: AUDIT_ACTIONS.KEY_MARKED_DELIVERED,
        admin_id: admin.id, entity_type: "order", entity_id: order.order_id,
        description: `License key delivered for order ${order.order_id} via ${delivery_method}`,
        metadata: { customer_email: order.customer_email, product: order.product_name, delivery_method },
        ip_address: req.ip,
      });
      sendSuccess(res, { order }, { message: "Order marked as delivered" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to mark delivered", { statusCode: 400 });
    }
  }

  async exportCSV(req: Request, res: Response): Promise<void> {
    try {
      const csv = await ordersService.exportCSV();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=bakone-orders.csv");
      res.send(csv);
    } catch {
      sendError(res, "Failed to export");
    }
  }
}

export const ordersController = new OrdersController();
