# Bakone Trades Backend Deployment

This backend is an Express API and should be deployed separately from the Vite frontend.

## Required Environment

Use your local `.env` values as the template for your hosting provider.

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
JWT_SECRET=replace-with-a-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key

PAYPAL_CLIENT_ID=your-live-client-id
PAYPAL_CLIENT_SECRET=your-live-client-secret
PAYPAL_MODE=live
PAYPAL_RETURN_URL=https://your-frontend-domain.com/success
PAYPAL_CANCEL_URL=https://your-frontend-domain.com/shop?cancelled=1
PAYPAL_CURRENCY=USD

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=Bakone Trades <support@your-domain.com>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-admin-password
```

`CORS_ORIGINS` can contain multiple domains separated by commas.

## Commands

```bash
npm install
npm run build
npm start
```

## Database

Run `SUPABASE_SCHEMA.sql` in Supabase SQL Editor before production traffic.

## Health Check

```text
GET https://your-backend-domain.com/api/health
```

The response should report `status: ok` and `database.status: ok`.

## PayPal

For local development, `PAYPAL_MODE=mock` runs checkout without external PayPal credentials. For live checkout, use live PayPal REST API credentials and public HTTPS frontend return/cancel URLs. Use `PAYPAL_MODE=sandbox` only with sandbox credentials.
