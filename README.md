# Bakone Trades Backend API

TypeScript, Express, Supabase, Docker, PayPal, and Resend.

Keys are generated manually on RoboTrader, then delivered to customers by WhatsApp or email from the admin workflow.

## Main Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/health/ping` | Quick ping |
| GET | `/api/products` | Visible products |
| GET | `/api/products/:slug` | Product by slug |
| POST | `/api/payments/checkout` | Create PayPal checkout and return approval URL |
| GET | `/api/payments/checkout/redirect` | Create checkout and redirect customer to PayPal |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/me` | Current admin |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/products/admin/all` | All products |
| PUT | `/api/products/:id` | Update product |
| GET | `/api/orders` | Orders |
| GET | `/api/orders/pending-delivery` | Paid orders awaiting key delivery |
| GET | `/api/orders/export/csv` | Export orders CSV |
| GET | `/api/orders/:orderId` | Single order |
| PATCH | `/api/orders/:orderId/deliver` | Mark key delivered |
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET | `/api/audit` | Audit logs |

## Payment Flow

1. Customer submits checkout details.
2. Backend creates a pending order in Supabase.
3. Backend creates a PayPal order with `intent: CAPTURE`.
4. Customer approves payment on PayPal.
5. PayPal redirects to `/api/payments/return/:orderId`.
6. Backend captures the PayPal order, marks the order paid, and sends confirmation/admin emails.
7. Admin manually generates and delivers the RoboTrader license key.

## Environment

Create `.env` locally or add these values in your hosting provider:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
JWT_SECRET=replace-with-a-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key

PAYPAL_CLIENT_ID=your-client-id
PAYPAL_CLIENT_SECRET=your-client-secret
PAYPAL_MODE=live
PAYPAL_RETURN_URL=https://your-frontend-domain.com/success
PAYPAL_CANCEL_URL=https://your-frontend-domain.com/shop?cancelled=1
PAYPAL_CURRENCY=USD

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=Bakone Trades <support@your-domain.com>

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-admin-password
ADMIN_WHATSAPP=+27000000000
```

Use `PAYPAL_MODE=mock` for local checkout without external PayPal credentials. Use `PAYPAL_MODE=sandbox` with sandbox credentials to test PayPal itself, and `PAYPAL_MODE=live` with live credentials for real payments.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
npm test
```

## Database

Run `SUPABASE_SCHEMA.sql` in the Supabase SQL Editor before production traffic.

## Checkout Test

```bash
curl -X POST http://localhost:5000/api/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"John Dube","customer_email":"john@example.com","customer_phone":"+27821234567","product_id":"YOUR_PRODUCT_UUID"}'
```

Open the returned `approvalUrl` to approve the payment with PayPal.