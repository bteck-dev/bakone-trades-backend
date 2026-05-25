import nodemailer from "nodemailer";
import { supabase } from "../../config/supabase";
import { config } from "../../config/env";
import logger from "../../config/logger";
import { AUDIT_ACTIONS, DELIVERY_METHOD } from "../../constants";
import { auditService } from "../audit";
import { ordersService } from "../orders";
import { ConversationThread, MessageLog, PrepareWhatsAppDto, SendEmailDto, SendWhatsAppDto } from "./messages.model";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: config.gmail.user, pass: config.gmail.appPassword },
});

const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const normalizePhone = (phone: string): string => phone.replace(/\D/g, "");

const getErrorDetails = (err: unknown): Record<string, unknown> => {
  if (!(err instanceof Error)) return { message: String(err) };
  const smtpError = err as Error & {
    code?: string;
    command?: string;
    response?: string;
    responseCode?: number;
  };
  return {
    message: smtpError.message,
    code: smtpError.code,
    command: smtpError.command,
    response: smtpError.response,
    responseCode: smtpError.responseCode,
    stack: smtpError.stack,
  };
};

export class MessagesService {
  private async markOrderDeliveredAfterMessage(params: {
    orderId?: string | null;
    adminId?: string | null;
    method: "email" | "whatsapp";
    messageId?: string | null;
  }): Promise<void> {
    if (!params.orderId || !params.adminId) return;

    try {
      const order = await ordersService.markDelivered(params.orderId, params.adminId, {
        delivery_method: params.method === "email" ? DELIVERY_METHOD.EMAIL : DELIVERY_METHOD.WHATSAPP,
        delivery_notes: `Automatically marked delivered after successful ${params.method} message${params.messageId ? ` (${params.messageId})` : ""}.`,
      });

      await auditService.log({
        action: AUDIT_ACTIONS.KEY_MARKED_DELIVERED,
        admin_id: params.adminId,
        entity_type: "order",
        entity_id: order.order_id,
        description: `License key automatically marked delivered for order ${order.order_id} after ${params.method} message`,
        metadata: {
          customer_email: order.customer_email,
          product: order.product_name,
          delivery_method: params.method,
          message_id: params.messageId || null,
        },
      });
    } catch (err) {
      logger.warn("[Messages] Could not auto-mark order delivered after message", {
        order_id: params.orderId,
        method: params.method,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getThreads(filters: { status?: string; order_id?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("conversation_threads")
      .select("*", { count: "exact" })
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.order_id) query = query.eq("order_id", filters.order_id);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      threads: data as ConversationThread[],
      pagination: { total: count || 0, page, limit, pages: Math.ceil((count || 0) / limit) },
    };
  }

  private async findOrCreateThread(params: {
    thread_id?: string;
    order_id?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    customer_name?: string | null;
    subject?: string | null;
  }): Promise<ConversationThread> {
    if (params.thread_id) {
      const { data, error } = await supabase.from("conversation_threads").select("*").eq("id", params.thread_id).single();
      if (error || !data) throw new Error("Conversation thread not found");
      return data as ConversationThread;
    }

    if (params.order_id) {
      const { data } = await supabase.from("conversation_threads").select("*").eq("order_id", params.order_id).limit(1).single();
      if (data) return data as ConversationThread;
    }

    const { data, error } = await supabase
      .from("conversation_threads")
      .insert({
        order_id: params.order_id || null,
        customer_email: params.customer_email || null,
        customer_phone: params.customer_phone || null,
        customer_name: params.customer_name || null,
        subject: params.subject || null,
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ConversationThread;
  }

  async getAll(filters: { order_id?: string; channel?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("message_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.order_id) query = query.eq("order_id", filters.order_id);
    if (filters.channel) query = query.eq("channel", filters.channel);
    if (filters.status) query = query.eq("status", filters.status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      messages: data as MessageLog[],
      pagination: { total: count || 0, page, limit, pages: Math.ceil((count || 0) / limit) },
    };
  }

  private async createLog(log: Partial<MessageLog>): Promise<MessageLog> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("message_logs")
      .insert({
        direction: "outbound",
        ...log,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (log.thread_id) {
      await supabase
        .from("conversation_threads")
        .update({ last_message_at: now, updated_at: now })
        .eq("id", log.thread_id);
    }

    return data as MessageLog;
  }

  async sendEmail(dto: SendEmailDto, sentBy?: string): Promise<MessageLog> {
    const text = dto.text || stripHtml(dto.html);
    const thread = await this.findOrCreateThread({
      thread_id: dto.thread_id,
      order_id: dto.order_id,
      customer_email: dto.to,
      subject: dto.subject,
    });

    try {
      logger.info("[Email] Sending email", {
        to: dto.to,
        order_id: dto.order_id || null,
        thread_id: thread.id,
        subject: dto.subject,
        gmail_user: config.gmail.user || "(missing)",
        has_gmail_app_password: Boolean(config.gmail.appPassword),
      });

      await transporter.verify();

      const info = await transporter.sendMail({
        from: `"Bakone Trades" <${config.gmail.user}>`,
        to: dto.to,
        subject: dto.subject,
        text,
        html: dto.html,
      });

      logger.info("[Email] Email sent", {
        to: dto.to,
        order_id: dto.order_id || null,
        thread_id: thread.id,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });

      const log = await this.createLog({
        thread_id: thread.id,
        order_id: dto.order_id || null,
        channel: "email",
        recipient: dto.to,
        sender: config.gmail.user,
        subject: dto.subject,
        body_text: text,
        body_html: dto.html,
        status: "sent",
        provider_message_id: info.messageId,
        provider_response: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
        sent_by: sentBy || null,
        sent_at: new Date().toISOString(),
      });

      await this.markOrderDeliveredAfterMessage({
        orderId: dto.order_id,
        adminId: sentBy,
        method: "email",
        messageId: log.id,
      });

      return log;
    } catch (err) {
      const details = getErrorDetails(err);
      logger.error("[Email] Send failed", {
        to: dto.to,
        order_id: dto.order_id || null,
        thread_id: thread.id,
        subject: dto.subject,
        gmail_user: config.gmail.user || "(missing)",
        has_gmail_app_password: Boolean(config.gmail.appPassword),
        error: details,
      });

      return await this.createLog({
        thread_id: thread.id,
        order_id: dto.order_id || null,
        channel: "email",
        recipient: dto.to,
        sender: config.gmail.user,
        subject: dto.subject,
        body_text: text,
        body_html: dto.html,
        status: "failed",
        error_message: err instanceof Error ? err.message : "Failed to send email",
        provider_response: details,
        sent_by: sentBy || null,
      });
    }
  }

  async prepareWhatsApp(dto: PrepareWhatsAppDto, sentBy?: string): Promise<{ message: MessageLog; whatsappUrl: string }> {
    const phone = normalizePhone(dto.to);
    if (!phone) throw new Error("A valid WhatsApp phone number is required");
    const thread = await this.findOrCreateThread({
      thread_id: dto.thread_id,
      order_id: dto.order_id,
      customer_phone: phone,
    });

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(dto.message)}`;
    const message = await this.createLog({
      thread_id: thread.id,
      order_id: dto.order_id || null,
      channel: "whatsapp",
      recipient: phone,
      sender: config.admin.whatsapp,
      body_text: dto.message,
      status: "prepared",
      provider_response: {
        note: "Prepared wa.me link. The system cannot confirm delivery unless WhatsApp Cloud API is configured.",
        whatsappUrl,
      },
      sent_by: sentBy || null,
    });

    await this.markOrderDeliveredAfterMessage({
      orderId: dto.order_id,
      adminId: sentBy,
      method: "whatsapp",
      messageId: message.id,
    });

    return { message, whatsappUrl };
  }

  async sendWhatsApp(dto: SendWhatsAppDto, sentBy?: string): Promise<MessageLog> {
    const phone = normalizePhone(dto.to);
    if (!phone) throw new Error("A valid WhatsApp phone number is required");

    if (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) {
      const prepared = await this.prepareWhatsApp(dto, sentBy);
      return prepared.message;
    }

    const thread = await this.findOrCreateThread({
      thread_id: dto.thread_id,
      order_id: dto.order_id,
      customer_phone: phone,
    });

    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.whatsapp.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: "text",
            text: {
              preview_url: true,
              body: dto.message,
            },
          }),
        }
      );
      const result = await response.json() as any;

      if (!response.ok) {
        throw new Error(result?.error?.message || "WhatsApp Cloud API send failed");
      }

      const log = await this.createLog({
        thread_id: thread.id,
        order_id: dto.order_id || null,
        channel: "whatsapp",
        direction: "outbound",
        recipient: phone,
        sender: config.whatsapp.phoneNumberId,
        body_text: dto.message,
        status: "sent",
        provider_message_id: result.messages?.[0]?.id || null,
        provider_response: result,
        sent_by: sentBy || null,
        sent_at: new Date().toISOString(),
      });

      await this.markOrderDeliveredAfterMessage({
        orderId: dto.order_id,
        adminId: sentBy,
        method: "whatsapp",
        messageId: log.id,
      });

      return log;
    } catch (err) {
      return await this.createLog({
        thread_id: thread.id,
        order_id: dto.order_id || null,
        channel: "whatsapp",
        direction: "outbound",
        recipient: phone,
        sender: config.whatsapp.phoneNumberId,
        body_text: dto.message,
        status: "failed",
        error_message: err instanceof Error ? err.message : "Failed to send WhatsApp message",
        sent_by: sentBy || null,
      });
    }
  }

  async recordInboundWhatsApp(payload: any): Promise<MessageLog[]> {
    const entries = payload?.entry || [];
    const logs: MessageLog[] = [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        for (const status of value.statuses || []) {
          const statusUpdate: Record<string, unknown> = {
            provider_status: status.status,
            provider_timestamp: status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : null,
            provider_response: status,
          };

          if (status.status === "delivered" || status.status === "read" || status.status === "failed") {
            statusUpdate.status = status.status;
          }

          await supabase
            .from("message_logs")
            .update(statusUpdate)
            .eq("provider_message_id", status.id);
        }

        for (const message of value.messages || []) {
          const phone = normalizePhone(message.from || "");
          const text = message.text?.body || `[${message.type || "message"}]`;
          const contact = value.contacts?.find((item: any) => item.wa_id === message.from);
          const thread = await this.findOrCreateThread({
            customer_phone: phone,
            customer_name: contact?.profile?.name || null,
            subject: "WhatsApp conversation",
          });

          const log = await this.createLog({
            thread_id: thread.id,
            channel: "whatsapp",
            direction: "inbound",
            recipient: config.whatsapp.phoneNumberId || config.admin.whatsapp,
            sender: phone,
            body_text: text,
            status: "received",
            provider_message_id: message.id,
            provider_response: message,
            provider_timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : null,
          });
          logs.push(log);
        }
      }
    }

    return logs;
  }
}

export const messagesService = new MessagesService();
