import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ALERT_EMAIL = Deno.env.get("ALERT_EMAIL") || "";
const ALERT_WEBHOOK_URL = Deno.env.get("ALERT_WEBHOOK_URL") || "";
const ALERT_SECRET = Deno.env.get("ALERT_SECRET") || "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Optional shared-secret check (when configured)
  if (ALERT_SECRET) {
    const provided = req.headers.get("x-alert-secret") || "";
    if (provided !== ALERT_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const subject = `[CollegeCart SECURITY] ${payload.event || "suspicious activity"}`;
  const bodyText = JSON.stringify(payload, null, 2);

  console.log("SECURITY ALERT:", subject, bodyText);

  const tasks: Promise<unknown>[] = [];

  // 1. Email via Resend
  if (RESEND_API_KEY && ALERT_EMAIL) {
    tasks.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "CollegeCart Security <security@collegecarts.in>",
          to: [ALERT_EMAIL],
          subject,
          text: `CollegeCart security alert\n\n${bodyText}`,
        }),
      }).then(async (r) => {
        if (!r.ok) console.error("resend failed", r.status, await r.text());
      }).catch((e) => console.error("resend error", e)),
    );
  }

  // 2. Webhook (Slack/Discord/Zapier/etc.)
  if (ALERT_WEBHOOK_URL) {
    tasks.push(
      fetch(ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${subject}\n\`\`\`${bodyText}\`\`\`` }),
      }).then(async (r) => {
        if (!r.ok) console.error("webhook failed", r.status, await r.text());
      }).catch((e) => console.error("webhook error", e)),
    );
  }

  await Promise.allSettled(tasks);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});