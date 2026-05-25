import { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import logger from "../../config/logger";
import { messagesService } from "./messages.service";
import { emailService } from "../../services/email.service";

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export class MessagesController {
  async getThreads(req: Request, res: Response): Promise<void> {
    try {
      const result = await messagesService.getThreads({
        status: req.query.status as string,
        order_id: req.query.order_id as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      sendSuccess(res, { threads: result.threads }, { meta: { pagination: result.pagination } });
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Failed to fetch conversation threads");
    }
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await messagesService.getAll({
        order_id: req.query.order_id as string,
        channel: req.query.channel as string,
        status: req.query.status as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      sendSuccess(res, { messages: result.messages }, { meta: { pagination: result.pagination } });
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Failed to fetch messages");
    }
  }

  async sendEmail(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const { thread_id, order_id, to, subject, html, text } = req.body;
      if (!to || !subject || !html) {
        sendError(res, "to, subject, and html are required", { statusCode: 400 });
        return;
      }

      const message = await messagesService.sendEmail({ thread_id, order_id, to, subject, html, text }, admin?.id);
      if (message.status !== "sent") {
        logger.error("[Email] API returning failure", {
          to,
          order_id: order_id || null,
          thread_id: thread_id || null,
          message_log_id: message.id,
          error_message: message.error_message,
          provider_response: message.provider_response,
        });
      }
      sendSuccess(res, { message }, {
        statusCode: message.status === "sent" ? 200 : 500,
        message: message.status === "sent" ? "Email sent" : "Email failed",
      });
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Failed to send email");
    }
  }

  async sendContactMessage(req: Request, res: Response): Promise<void> {
    try {
      const name = String(req.body.name || "").trim();
      const email = String(req.body.email || "").trim();
      const message = String(req.body.message || "").trim();

      if (!name || !email || !message) {
        sendError(res, "Name, email, and message are required", { statusCode: 400 });
        return;
      }

      if (name.length > 100 || email.length > 255 || message.length > 2000) {
        sendError(res, "Your message is too long. Please shorten it and try again.", { statusCode: 400 });
        return;
      }

      if (!isValidEmail(email)) {
        sendError(res, "Please enter a valid email address", { statusCode: 400 });
        return;
      }

      await emailService.sendContactMessage({ name, email, message });
      sendSuccess(res, { sent: true }, { message: "Message sent" });
    } catch (err) {
      logger.error("[Contact] Failed to send contact message", {
        error: err instanceof Error ? err.message : String(err),
      });
      sendError(res, "Could not send your message. Please try again or email us directly.");
    }
  }

  async prepareWhatsApp(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const { thread_id, order_id, to, message } = req.body;
      if (!to || !message) {
        sendError(res, "to and message are required", { statusCode: 400 });
        return;
      }

      const result = await messagesService.prepareWhatsApp({ thread_id, order_id, to, message }, admin?.id);
      sendSuccess(res, result, { message: "WhatsApp message prepared" });
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Failed to prepare WhatsApp message");
    }
  }

  async sendWhatsApp(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const { thread_id, order_id, to, message } = req.body;
      if (!to || !message) {
        sendError(res, "to and message are required", { statusCode: 400 });
        return;
      }

      const log = await messagesService.sendWhatsApp({ thread_id, order_id, to, message }, admin?.id);
      sendSuccess(res, { message: log }, {
        statusCode: log.status === "failed" ? 500 : 200,
        message: log.status === "failed" ? "WhatsApp message failed" : "WhatsApp message sent",
      });
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : "Failed to send WhatsApp message");
    }
  }

  verifyWhatsAppWebhook(req: Request, res: Response): void {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }

    res.sendStatus(403);
  }

  async receiveWhatsAppWebhook(req: Request, res: Response): Promise<void> {
    res.sendStatus(200);

    try {
      await messagesService.recordInboundWhatsApp(req.body);
    } catch (err) {
      console.error("[WhatsApp Webhook] Failed to record message", err);
    }
  }
}

export const messagesController = new MessagesController();
