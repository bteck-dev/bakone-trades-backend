# Bakone Trades Backend Deployment

This backend is an Express API and should be deployed separately from the Vite frontend.

## Required Environment

Use `.env.example` as the template for your hosting provider.

Important production values:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
JWT_SECRET=replace-with-a-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
PAYFAST_MODE=production
PAYFAST_NOTIFY_URL=https://your-backend-domain.com/api/payments/notify
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=Bakone Trades <support@your-domain.com>
```

`CORS_ORIGINS` can contain multiple domains separated by commas.

Email is sent with Resend over HTTPS instead of Gmail SMTP. This is more reliable on Render because production hosts may block or slow outbound SMTP ports, causing Gmail/Nodemailer connection timeouts.

## Commands

```bash
npm install
npm run build
npm start
```

## Database

Run `SUPABASE_SCHEMA.sql` in Supabase SQL Editor before production traffic.

If you use CLI migration:

```bash
npm run migrate
npm run seed
```

## Health Check

After deployment:

```text
GET https://your-backend-domain.com/api/health
```

The response should report `status: ok` and `database.status: ok`.

## PayFast

For real ITN payment notifications, `PAYFAST_NOTIFY_URL` must be public HTTPS. Localhost will not work for PayFast server callbacks.
