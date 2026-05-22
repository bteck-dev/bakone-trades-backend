import { config } from "../config/env";
import { Order } from "../modules/orders/orders.model";
import { messagesService } from "../modules/messages/messages.service";

export class EmailService {
  async sendAdminNewOrderAlert(order: Order): Promise<void> {
    const whatsappLink = order.customer_phone
      ? `https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hi ${order.customer_name}! Your ${order.product_name} license key is ready:`
        )}`
      : null;

    await messagesService.sendEmail({
      order_id: order.order_id,
      to: config.gmail.user,
      subject: `NEW ORDER - ${order.product_name} - Action Required`,
      html: `
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
          <li>Send the key to the customer via WhatsApp or Email.</li>
          ${whatsappLink ? `<li><a href="${whatsappLink}" style="background:#25D366;color:white;padding:10px 20px;border-radius:5px;text-decoration:none">Open WhatsApp Chat</a></li>` : ""}
          <li>Log into your admin dashboard and mark the order as delivered.</li>
        </ol>
      `,
    });
  }

  async sendPaymentConfirmation(order: Order): Promise<void> {
    await messagesService.sendEmail({
      order_id: order.order_id,
      to: order.customer_email,
      subject: `Payment Confirmed - ${order.product_name} - Bakone Trades`,
      html: `
        <div style="font-family:Arial;max-width:600px;margin:auto">
          <div style="background:#0F0F0F;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0">Bakone Trades</h1>
            <p style="color:#aaa">Automate your trades. Grow your wealth.</p>
          </div>
          <div style="padding:32px">
            <p>Hi <strong>${order.customer_name}</strong>,</p>
            <p>Your payment for <strong>${order.product_name}</strong> has been confirmed.</p>
            <p><strong>Your license key will be delivered shortly</strong> via WhatsApp or Email.</p>
            <p>Order Reference: <strong>${order.order_id}</strong></p>
            <hr/>
            <p>Questions? Contact us:</p>
            <p><a href="mailto:${config.gmail.user}">${config.gmail.user}</a></p>
            <p><a href="https://wa.me/${config.admin.whatsapp.replace(/\D/g, "")}">WhatsApp: ${config.admin.whatsapp}</a></p>
          </div>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
