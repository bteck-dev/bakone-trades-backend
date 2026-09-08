import { Request, Response } from "express";
import { ordersService } from "./orders.service";
import { auditService } from "../audit";
import { AUDIT_ACTIONS } from "../../constants";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { emailService } from "../../services/email.service";

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

  async confirmPayment(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const existingOrder = await ordersService.getByOrderId(req.params.orderId);

      if (existingOrder.payment_status === "paid") {
        sendSuccess(res, { order: existingOrder }, { message: "Payment already confirmed" });
        return;
      }

      const paymentReference = req.body?.payment_reference || `IKHOKHA-MANUAL-${existingOrder.order_id}`;
      const order = await ordersService.markAsPaid(req.params.orderId, paymentReference);

      await auditService.log({
        action: AUDIT_ACTIONS.ORDER_PAID,
        admin_id: admin.id,
        entity_type: "order",
        entity_id: order.order_id,
        description: `Payment manually confirmed for order ${order.order_id}`,
        metadata: {
          payment_reference: paymentReference,
          payment_provider: "ikhokha",
          confirmation_source: "admin_hosted_link",
        },
        ip_address: req.ip,
      });

      await emailService.sendPaymentConfirmation(order);
      await emailService.sendAdminNewOrderAlert(order);

      sendSuccess(res, { order }, { message: "Payment confirmed and confirmation email sent" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to confirm payment", { statusCode: 400 });
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
