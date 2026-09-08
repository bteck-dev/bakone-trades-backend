# Bakone Trades Backend Deployment

Set every production variable shown in `.env.example` in the backend hosting provider. In particular, use the production URLs and real iKhokha credentials:

```env
IKHOKHA_APP_ID=your-production-application-id
IKHOKHA_APP_SECRET=your-production-application-secret
IKHOKHA_MODE=live
IKHOKHA_API_URL=https://api.ikhokha.com
IKHOKHA_REQUESTER_URL=https://your-frontend-domain.com
IKHOKHA_CALLBACK_URL=https://api.bakonetrades.com/api/payments/webhook
IKHOKHA_SUCCESS_URL=https://your-frontend-domain.com/success
IKHOKHA_FAILURE_URL=https://your-frontend-domain.com/shop?failed=1
IKHOKHA_CANCEL_URL=https://your-frontend-domain.com/shop?cancelled=1
IKHOKHA_ZAR_PER_USD=18.00
```

`IKHOKHA_CALLBACK_URL` must be publicly reachable over HTTPS. Do not expose `IKHOKHA_APP_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

## Automatic migrations

In GitHub repository settings, create environments named `local` and `production`. Add a separate `SUPABASE_DB_URL` secret to each environment:

- Non-`main` pushes apply pending migrations to `local`.
- Pushes to `main` apply pending migrations to `production`.
- The workflow can also be run manually.

Use Supabase's direct or session-pooler PostgreSQL connection string. Transaction-pooler URLs may not support migration operations reliably.

## Deploy commands

```bash
npm ci
npm run build
npm start
```

After deployment, verify `GET https://your-backend-domain.com/api/health` and complete one low-value real checkout before opening sales.
