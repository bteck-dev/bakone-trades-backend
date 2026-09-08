import { Router } from "express";
import { paymentsController } from "./payments.controller";

const router = Router();

router.post("/checkout", (req, res) => paymentsController.initiateCheckout(req, res));
router.get("/checkout/redirect", (req, res) => paymentsController.redirectToCheckout(req, res));
router.post("/webhook", (req, res) => paymentsController.webhook(req, res));
router.get("/return/:orderId", (req, res) => paymentsController.handleReturn(req, res));
router.get("/cancel/:orderId", (req, res) => paymentsController.handleCancel(req, res));

export default router;
