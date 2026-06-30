import { Router } from "express";
import { paymentsController } from "./payments.controller";

const router = Router();

router.post("/checkout", (req, res) => paymentsController.initiateCheckout(req, res));
router.get("/checkout/redirect", (req, res) => paymentsController.redirectToPayPal(req, res));
router.get("/return/:orderId", (req, res) => paymentsController.handleReturn(req, res));
router.get("/cancel/:orderId", (req, res) => paymentsController.handleCancel(req, res));

export default router;
