export type MessageChannel = "email" | "whatsapp";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "draft" | "prepared" | "sent" | "delivered" | "read" | "received" | "failed";

export interface ConversationThread {
  id: string;
  order_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  subject?: string | null;
  status: "open" | "closed";
  last_message_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface MessageLog {
  id: string;
  thread_id?: string | null;
  order_id?: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  recipient: string;
  sender?: string | null;
  subject?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  status: MessageStatus;
  provider_message_id?: string | null;
  provider_response?: Record<string, unknown> | null;
  error_message?: string | null;
  provider_status?: string | null;
  provider_timestamp?: string | null;
  sent_by?: string | null;
  sent_at?: string | null;
  created_at: string;
}

export interface SendEmailDto {
  thread_id?: string;
  order_id?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface PrepareWhatsAppDto {
  thread_id?: string;
  order_id?: string;
  to: string;
  message: string;
}

export interface SendWhatsAppDto extends PrepareWhatsAppDto {}
