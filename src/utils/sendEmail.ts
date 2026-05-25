import { Resend } from "resend";
import { config } from "../config/env";
import logger from "../config/logger";

const resend = new Resend(config.email.resendApiKey);

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailInput) {
  if (!config.email.resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!config.email.from) {
    throw new Error("EMAIL_FROM is not configured");
  }

  try {
    // Resend uses HTTPS instead of SMTP. That avoids Gmail SMTP connection timeouts
    // on Render, where outbound SMTP ports can be blocked or slow in production.
    return await resend.emails.send({
      from: config.email.from,
      to,
      subject,
      html,
      text,
      replyTo,
    });
  } catch (err) {
    logger.error("[Email] Resend API send failed", {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
