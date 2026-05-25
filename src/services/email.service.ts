import { config } from "../config/env";
import { Order } from "../modules/orders/orders.model";
import { messagesService } from "../modules/messages/messages.service";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const emailShell = (title: string, content: string): string => `
  <div style="margin:0;padding:0;background:#f4f7f4;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px">
      <div style="background:#0f0f0f;border-radius:18px 18px 0 0;padding:28px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:.2px">Bakone <span style="color:#f7c948">Trades</span></h1>
        <p style="margin:8px 0 0;color:#9ca3af;font-size:14px">Automated forex trading bots and license support</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 18px 18px;padding:30px">
        <h2 style="margin:0 0 18px;color:#111827;font-size:24px">${title}</h2>
        ${content}
        <div style="margin-top:30px;padding-top:18px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;line-height:1.6">
          <p style="margin:0">Need help? Reply to this email or contact Bakone Trades support.</p>
          <p style="margin:6px 0 0"><a href="mailto:${config.gmail.user}" style="color:#16a34a">${config.gmail.user}</a></p>
        </div>
      </div>
    </div>
  </div>
`;

const robotraderDownloadHtml = (): string => {
  if (!config.robotrader.appDownloadUrl) {
    return "Download the RoboTrader app using the link provided by Bakone Trades support.";
  }

  return `<a href="${config.robotrader.appDownloadUrl}" style="color:#16a34a;font-weight:bold">Download the RoboTrader app here</a>`;
};

const robotraderSetupStepsHtml = (): string => `
  <ol style="padding-left:20px;line-height:1.8;color:#374151">
    <li><strong>Download the RoboTrader app.</strong><br/>Use this link on your Android phone: ${robotraderDownloadHtml()}.</li>
    <li><strong>Add your license key.</strong><br/>Open the app and paste the license key exactly as it appears in your email.</li>
    <li><strong>Connect your trading server.</strong><br/>Sign in with the broker or trading server details that you normally use for trading.</li>
    <li><strong>Allow all symbols.</strong><br/>Give the app permission to see the markets available on your account so the robot can work correctly.</li>
  </ol>
`;

export class EmailService {
  async sendAdminNewOrderAlert(order: Order): Promise<void> {
    await messagesService.sendEmail({
      order_id: order.order_id,
      to: config.gmail.user,
      subject: `NEW ORDER - ${order.product_name} - Action Required`,
      html: emailShell("New Paid Order - Deliver License Key", `
        <h2>New Paid Order - Deliver License Key</h2>
        <table style="border-collapse:collapse;width:100%;font-family:Arial">
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Order ID</strong></td><td style="padding:8px;border:1px solid #ddd">${order.order_id}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Customer</strong></td><td style="padding:8px;border:1px solid #ddd">${order.customer_name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Email</strong></td><td style="padding:8px;border:1px solid #ddd">${order.customer_email}</td></tr>
          ${order.customer_phone ? `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Phone</strong></td><td style="padding:8px;border:1px solid #ddd">${order.customer_phone}</td></tr>` : ""}
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Product</strong></td><td style="padding:8px;border:1px solid #ddd">${order.product_name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Amount Paid</strong></td><td style="padding:8px;border:1px solid #ddd">${order.currency} ${order.amount}</td></tr>
        </table>
        <br/>
        <h3>Next Steps:</h3>
        <ol>
          <li>Generate a license key for <strong>${order.product_name}</strong>.</li>
          <li>Send the key to the customer by email from the admin dashboard.</li>
          <li>Log into your admin dashboard and mark the order as delivered.</li>
        </ol>
      `),
    });
  }

  async sendPaymentConfirmation(order: Order): Promise<void> {
    await messagesService.sendEmail({
      order_id: order.order_id,
      to: order.customer_email,
      subject: `Payment Confirmed - ${order.product_name} - Bakone Trades`,
      html: emailShell("Payment Confirmed", `
        <p style="margin:0 0 14px;line-height:1.7;color:#374151">Hi <strong>${escapeHtml(order.customer_name)}</strong>,</p>
        <p style="margin:0 0 14px;line-height:1.7;color:#374151">
          Thank you. Your payment for <strong>${escapeHtml(order.product_name)}</strong> has been confirmed.
        </p>
        <div style="margin:20px 0;padding:16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px">
          <p style="margin:0;color:#166534;font-weight:bold">Your license key will be sent to this email address.</p>
          <p style="margin:8px 0 0;color:#166534;font-size:14px">Order reference: <strong>${escapeHtml(order.order_id)}</strong></p>
        </div>
        <h3 style="margin:24px 0 10px;color:#111827">What to do after you receive your license key</h3>
        ${robotraderSetupStepsHtml()}
        <p style="margin:18px 0 0;color:#6b7280;font-size:14px;line-height:1.7">
          RoboTrader is a separate app used to connect your license to your trading setup. Bakone Trades provides your paid license and support for getting started.
        </p>
      `),
    });
  }

  async sendContactMessage(input: { name: string; email: string; message: string }): Promise<void> {
    await messagesService.sendEmail({
      to: config.admin.email || config.gmail.user,
      subject: `Website Contact - ${input.name}`,
      html: emailShell("New Website Contact Message", `
        <table style="border-collapse:collapse;width:100%">
          <tr>
            <td style="padding:10px;border:1px solid #e5e7eb;font-weight:bold">Name</td>
            <td style="padding:10px;border:1px solid #e5e7eb">${escapeHtml(input.name)}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #e5e7eb;font-weight:bold">Email</td>
            <td style="padding:10px;border:1px solid #e5e7eb"><a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></td>
          </tr>
        </table>
        <div style="margin-top:18px;padding:16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb">
          <div style="font-weight:bold;margin-bottom:8px">Message</div>
          <div style="white-space:pre-wrap;line-height:1.7;color:#374151">${escapeHtml(input.message)}</div>
        </div>
      `),
      text: `New website contact message\n\nName: ${input.name}\nEmail: ${input.email}\n\n${input.message}`,
    });
  }
}

export const emailService = new EmailService();
