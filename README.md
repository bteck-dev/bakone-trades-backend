# Bakone Trades — Backend API

**TypeScript · Express · Supabase · Docker · PayFast**

> Keys are generated manually on RoboTrader then delivered to customers via WhatsApp or Email by the admin.

---

## Project Structure

```
src/
├── config/
│   ├── env.ts              # All env vars in one typed object
│   ├── supabase.ts         # Supabase client
│   └── jest.setup.ts       # Test env vars
├── constants/
│   └── index.ts            # Enums: ORDER_STATUS, KEY_STATUS, AUDIT_ACTIONS
├── middleware/
│   └── auth.ts             # JWT auth middleware
├── services/
│   └── email.service.ts    # Nodemailer — admin alerts + customer confirmations
├── __mocks__/
│   └── supabase.mock.ts    # Shared mock data for tests
└── modules/
    ├── audit/              # Tracks all admin actions + system events
    │   ├── audit.model.ts
    │   ├── audit.service.ts
    │   ├── audit.controller.ts
    │   ├── audit.routes.ts
    │   ├── index.ts
    │   └── __tests__/audit.test.ts
    ├── auth/               # Admin login + JWT
    ├── products/           # Product CRUD (public read, admin write)
    ├── orders/             # Payment orders + manual delivery tracking
    ├── licenses/           # Delivery notes (no keys stored — RoboTrader handles that)
    ├── customers/          # Customer list derived from orders
    ├── dashboard/          # Stats + charts for admin dashboard
    ├── health/             # Health check endpoint
    └── payments/           # PayFast checkout + ITN webhook
```

---

## API Endpoints

### Public (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Full health check with DB status |
| GET | /api/health/ping | Quick ping |
| GET | /api/products | Get visible products |
| GET | /api/products/:slug | Get product by slug |
| POST | /api/payments/checkout | Initiate PayFast checkout |
| POST | /api/payments/notify | PayFast ITN webhook |

### Admin (Bearer token required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current admin |
| POST | /api/auth/change-password | Change password |
| GET | /api/products/admin/all | All products including hidden |
| PUT | /api/products/:id | Update product |
| GET | /api/orders | All orders (search, filter, paginate) |
| GET | /api/orders/pending-delivery | Paid orders awaiting key delivery |
| GET | /api/orders/export/csv | Export CSV |
| GET | /api/orders/:orderId | Single order |
| PATCH | /api/orders/:orderId/deliver | Mark order as key delivered |
| GET | /api/licenses/stock | Delivery status per product |
| GET | /api/licenses/notes | Delivery notes |
| POST | /api/licenses/notes | Add delivery note |
| GET | /api/customers | All customers |
| GET | /api/customers/:email/orders | Customer order history |
| GET | /api/dashboard/stats | Dashboard metrics + chart |
| GET | /api/audit | Audit log trail |

---

## Manual Key Delivery Flow

```
Customer fills checkout form (name, email, phone, product)
            ↓
POST /api/payments/checkout
  → Creates pending order in Supabase
  → Returns PayFast form data
            ↓
Customer pays on PayFast
            ↓
PayFast calls POST /api/payments/notify (ITN webhook)
  → Verifies PayFast signature
  → Marks order as PAID in DB
  → Emails admin: "New order — action required"
  → Email includes one-click WhatsApp link to customer
            ↓
ADMIN (manual steps):
  1. Go to https://take-profit-signals.co.za/users/z6LanYGeZ5/eas
  2. Generate license key for the purchased product
  3. Send key to customer via WhatsApp or Email
  4. Go to Admin Dashboard → Orders → Pending Delivery
  5. Click "Mark as Delivered" → select whatsapp/email → save
            ↓
Audit log records the delivery with admin ID + timestamp
```

---

## Setup & Run

### 1 — Install dependencies
```bash
npm install
```

### 2 — Copy and fill environment variables
```bash
cp .env.example .env
# Fill in all values
```

### 3 — Set up Supabase
1. Create a project at supabase.com (free)
2. Go to SQL Editor → paste contents of `SUPABASE_SCHEMA.sql` → Run
3. Copy your Project URL and Service Role Key into `.env`
4. Seed your admin: run this in Supabase SQL Editor:
```sql
insert into admins (email, password)
values ('bakonetrades@gmail.com', '$2a$12$YOUR_BCRYPT_HASH_HERE');
```
Generate hash: `node -e "const b=require('bcryptjs');b.hash('yourpassword',12).then(console.log)"`

### 4 — Run in development
```bash
npm run dev
```

### 5 — Run tests
```bash
npm test                  # Run all tests
npm run test:coverage     # With coverage report
npm run test:watch        # Watch mode
```

### 6 — Build for production
```bash
npm run build
npm start
```

---

## Docker Deployment

### Local Docker
```bash
docker build -t bakone-trades-api .
docker run -p 5000:5000 --env-file .env bakone-trades-api
```

### Docker Compose
```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### Deploy to Render with Docker
1. Push to GitHub
2. Render → New Web Service → Docker
3. Add all env vars from `.env.example`
4. Deploy

---

## Testing Endpoints (with curl)

### Health
```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/ping
```

### Products (public)
```bash
curl http://localhost:5000/api/products
curl http://localhost:5000/api/products/fx-killer-pv4-pro
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bakonetrades@gmail.com","password":"yourpassword"}'
# Copy the token from the response
TOKEN="paste-token-here"
```

### Dashboard
```bash
curl http://localhost:5000/api/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Orders
```bash
# All orders
curl "http://localhost:5000/api/orders" -H "Authorization: Bearer $TOKEN"

# Pending delivery only
curl "http://localhost:5000/api/orders/pending-delivery" -H "Authorization: Bearer $TOKEN"

# Mark delivered
curl -X PATCH http://localhost:5000/api/orders/BT-ABC123/deliver \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delivery_method":"whatsapp","delivery_notes":"Sent on WhatsApp"}'

# Export CSV
curl "http://localhost:5000/api/orders/export/csv" \
  -H "Authorization: Bearer $TOKEN" -o orders.csv
```

### Checkout (simulate frontend)
```bash
curl -X POST http://localhost:5000/api/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"John Dube","customer_email":"john@example.com","customer_phone":"+27821234567","product_id":"YOUR_PRODUCT_UUID"}'
```

### Audit Logs
```bash
curl "http://localhost:5000/api/audit?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Filter by action
curl "http://localhost:5000/api/audit?action=ORDER_PAID" \
  -H "Authorization: Bearer $TOKEN"
```

### License stock status
```bash
curl "http://localhost:5000/api/licenses/stock" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Gmail App Password Setup
1. Google Account → Security → 2-Step Verification (enable)
2. Security → App Passwords → Select app: Mail → Generate
3. Copy the 16-character password → paste as `GMAIL_APP_PASSWORD` in `.env`
