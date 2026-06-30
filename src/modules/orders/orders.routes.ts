import { Router } from "express";
import { ordersController } from "./orders.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();
router.get("/", authMiddleware, (req, res) => ordersController.getAll(req, res));
router.get("/pending-delivery", authMiddleware, (req, res) => ordersController.getPendingDeliveries(req, res));
router.get("/export/csv", authMiddleware, (req, res) => ordersController.exportCSV(req, res));
router.get("/:orderId", authMiddleware, (req, res) => ordersController.getOne(req, res));
router.patch("/:orderId/confirm-payment", authMiddleware, (req, res) => ordersController.confirmPayment(req, res));
router.patch("/:orderId/deliver", authMiddleware, (req, res) => ordersController.markDelivered(req, res));
export default router;