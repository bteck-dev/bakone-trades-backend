import { Router } from "express";
import { messagesController } from "./messages.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

router.get("/whatsapp/webhook", (req, res) => messagesController.verifyWhatsAppWebhook(req, res));
router.post("/whatsapp/webhook", (req, res) => messagesController.receiveWhatsAppWebhook(req, res));
router.post("/contact", (req, res) => messagesController.sendContactMessage(req, res));
router.get("/threads", authMiddleware, (req, res) => messagesController.getThreads(req, res));
router.get("/", authMiddleware, (req, res) => messagesController.getAll(req, res));
router.post("/email", authMiddleware, (req, res) => messagesController.sendEmail(req, res));

export default router;
