import { Router } from "express";
import { customersController } from "./customers.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();
router.get("/", authMiddleware, (req, res) => customersController.getAll(req, res));
router.get("/:email/orders", authMiddleware, (req, res) => customersController.getOrders(req, res));
export default router;
