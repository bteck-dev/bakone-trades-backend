# Bakone Trades Backend API

TypeScript, Express, Supabase, iKhokha, and Resend backend for the Bakone bot store.

## Payment flow

1. `POST /api/payments/checkout` creates a pending order and a unique iKhokha payment link.
2. The customer completes payment on iKhokha.
3. `POST /api/payments/webhook` verifies iKhokha's HMAC signature and confirms the order.
4. The success return also checks payment status directly with iKhokha as a fallback.
5. Confirmation emails are sent once; repeated callbacks are safe.

The product catalog remains priced in USD. `IKHOKHA_ZAR_PER_USD` converts that price to the ZAR amount charged and stored on the order. Keep this rate current.

## Setup

Copy `.env.example` to `.env`, supply the real values, then run:

```bash
npm install
npm run build
npm test
npm run dev
```

The iKhokha callback defaults to `https://api.bakonetrades.com/api/payments/webhook`; `IKHOKHA_CALLBACK_URL` can override it. Generate the Application ID and Application Secret in iKhokha Merchant Dashboard under **Integrations > Payment API**.

## Database setup

For the existing production database, open Supabase SQL Editor and run `IKHOKHA_MIGRATION.sql` once. For a brand-new empty database, run `SUPABASE_SCHEMA.sql` instead. Database changes are not executed automatically during GitHub pushes.

## Main endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/products` | Visible products |
| POST | `/api/payments/checkout` | Create iKhokha checkout |
| POST | `/api/payments/webhook` | Signed iKhokha callback |
| GET | `/api/payments/return/:orderId` | Verify and finalize payment return |
| GET | `/api/orders` | Admin order list |

## Checkout request

```bash
curl -X POST http://localhost:5000/api/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"John Dube","customer_email":"john@example.com","customer_phone":"+27821234567","product_id":"YOUR_PRODUCT_UUID"}'
```

Redirect the browser to the returned `paymentLink`.
