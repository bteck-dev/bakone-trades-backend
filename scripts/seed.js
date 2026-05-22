require("dotenv/config");

const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[seed] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const products = [
  {
    name: "FX Killer PV4.0 Pro",
    version: "4.0 Pro",
    slug: "fx-killer-pv4-pro",
    description:
      "Analyzes real-time market data using price action, spread, volatility, RSI, Bollinger Bands, and Moving Averages to identify low-risk, high-probability trade entries and exits automatically.",
    features: [
      "Real-time technical analysis",
      "Smart entry & exit detection",
      "Works on 20+ markets",
      "RSI, Bollinger Bands & Moving Averages",
    ],
    price: 30.0,
    is_visible: true,
  },
  {
    name: "Poverty Scalper EA",
    version: "2.0+",
    slug: "poverty-scalper-ea",
    description:
      "An automated Expert Advisor designed to identify high-probability market opportunities using trend analysis, price action, and smart risk management.",
    features: [
      "Trend analysis engine",
      "Price action recognition",
      "Built-in risk management",
      "High-probability setups only",
    ],
    price: 21.0,
    is_visible: true,
  },
];

const seedProducts = async () => {
  const { error } = await supabase
    .from("products")
    .upsert(products, { onConflict: "slug" });

  if (error) {
    throw new Error(`Failed to seed products: ${error.message}`);
  }

  console.log(`[seed] Seeded ${products.length} products`);
};

const seedAdmin = async () => {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.log("[seed] Skipped admin seed: ADMIN_EMAIL or ADMIN_PASSWORD is missing");
    return;
  }

  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const { error } = await supabase
    .from("admins")
    .upsert(
      {
        email: process.env.ADMIN_EMAIL,
        password,
      },
      { onConflict: "email" }
    );

  if (error) {
    throw new Error(`Failed to seed admin: ${error.message}`);
  }

  console.log(`[seed] Seeded admin ${process.env.ADMIN_EMAIL}`);
};

const main = async () => {
  try {
    await seedProducts();
    await seedAdmin();
    console.log("[seed] Done");
  } catch (err) {
    console.error("[seed] Failed");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
};

main();
