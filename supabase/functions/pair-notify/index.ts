// Pocket Pair: sends a push notification to the other person.
// Called by database triggers (pair_status act change, new pair_events row) through pg_net.
// Keys and the shared secret live in public.pair_config, which only the service role can read.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const LABEL: Record<string, Record<string, string>> = {
  rocky: {
    idle: "Home", projects: "Working on a project", vr: "Playing Quest 2", studying: "Studying at home", studyuni: "Studying at uni",
    cooking: "Cooking", eating: "Eating", groceries: "Getting groceries", sleeping: "Sleeping",
    toilet: "On the toilet", shower: "Showering", school: "At LUT", transport: "On the bus",
  },
  her: {
    idle: "Home", lab: "In the lab", vr: "Playing Quest 2", studying: "Studying at home", studyuni: "Studying at uni",
    cooking: "Cooking", eating: "Eating", groceries: "Getting groceries", sleeping: "Sleeping",
    toilet: "On the toilet", shower: "Showering", uni: "At Metropolia", transport: "On the bus",
  },
};

let vapidReady = false;
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const { data: cfg, error: cfgErr } = await sb.from("pair_config")
    .select("notify_secret, vapid_public, vapid_private, vapid_subject").eq("id", 1).single();
  if (cfgErr || !cfg) return json({ error: "config missing" }, 500);
  if (!cfg.notify_secret || req.headers.get("x-pair-secret") !== cfg.notify_secret) return json({ error: "unauthorized" }, 401);
  if (!vapidReady) { webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private); vapidReady = true; }

  const ev = await req.json() as { kind: string; from: string; to: string; act?: string; secs?: number };
  if (!["rocky", "her"].includes(ev.to) || !["rocky", "her"].includes(ev.from)) return json({ error: "bad event" }, 400);

  // No push while the other person has the app open: they already see it live.
  const { data: st } = await sb.from("pair_status").select("visible_until").eq("who", ev.to).single();
  if (st?.visible_until && new Date(st.visible_until).getTime() > Date.now()) return json({ skipped: "app open" });

  const { data: mem } = await sb.from("pair_members").select("who, name");
  const raw = mem?.find((m) => m.who === ev.from)?.name || (ev.from === "rocky" ? "ROCKY" : "HAZEL");
  const name = raw.charAt(0) + raw.slice(1).toLowerCase();

  let body = "", tag = ev.kind, col = "want_notes";
  if (ev.kind === "status") { body = "Now: " + (LABEL[ev.from][ev.act ?? ""] ?? ev.act); col = "want_status"; }
  else if (ev.kind === "love") { body = "sent you a heart ♥"; col = "want_love"; }
  else if (ev.kind === "voice") { body = "sent you a voice note" + (ev.secs ? ` (${ev.secs} s)` : ""); tag = "note"; }
  else if (ev.kind === "art") { body = "sent you pixel art"; tag = "note"; }
  else return json({ error: "bad kind" }, 400);

  const { data: subs } = await sb.from("pair_push_subs").select("endpoint, p256dh, auth").eq("who", ev.to).eq(col, true);
  const payload = JSON.stringify({ title: name, body: body.charAt(0).toUpperCase() + body.slice(1), tag, url: "./" });
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
        { TTL: 6 * 3600, urgency: ev.kind === "status" ? "normal" : "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("pair_push_subs").delete().eq("endpoint", s.endpoint); // phone unsubscribed
      else console.error("push failed", code, (e as Error).message);
    }
  }
  return json({ sent });
});
