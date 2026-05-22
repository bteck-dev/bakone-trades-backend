require("dotenv/config");

const { createClient } = require("@supabase/supabase-js");

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[messages:test] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const main = async () => {
  const now = new Date().toISOString();

  const { data: thread, error: threadError } = await supabase
    .from("conversation_threads")
    .insert({
      customer_email: "test@example.com",
      customer_phone: "27821234567",
      customer_name: "Messaging Test",
      subject: "Messaging system test",
      status: "open",
      last_message_at: now,
    })
    .select()
    .single();

  if (threadError) {
    console.error("[messages:test] Could not create conversation thread.");
    console.error(threadError.message);
    console.error("[messages:test] Run SUPABASE_SCHEMA.sql in Supabase SQL Editor first.");
    process.exit(1);
  }

  const { data: message, error: messageError } = await supabase
    .from("message_logs")
    .insert({
      thread_id: thread.id,
      channel: "whatsapp",
      direction: "outbound",
      recipient: "27821234567",
      sender: process.env.ADMIN_WHATSAPP || null,
      body_text: "Test WhatsApp message prepared by Bakone Trades system.",
      status: "prepared",
      provider_response: {
        source: "npm run test:messaging",
      },
    })
    .select()
    .single();

  if (messageError) {
    console.error("[messages:test] Could not create message log.");
    console.error(messageError.message);
    process.exit(1);
  }

  console.log("[messages:test] Messaging tables are working.");
  console.log(`[messages:test] Thread ID: ${thread.id}`);
  console.log(`[messages:test] Message ID: ${message.id}`);
};

main();
