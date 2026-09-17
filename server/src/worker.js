/**
 * mudhakkirah-push — Cloudflare Worker
 * ------------------------------------------------------------------
 * خدمة خلفية صغيرة تُرسل تنبيهات Web Push حتى لو تطبيق مذكّرتي مقفول
 * تمامًا على الجهاز. كل جهاز (متصفح) يُسجّل نفسه برمز عشوائي (deviceToken)
 * لا يُخمَّن، ويرسل قائمة تذكيراته (مع وقت الإطلاق المحسوب مسبقًا من
 * العميل). الـ cron هنا يفحص كل دقيقة ويرسل أي تنبيه حان وقته.
 *
 * لا يوجد تسجيل دخول — الحماية الوحيدة هي أن deviceToken عشوائي طويل
 * لا يمكن تخمينه، وأن CORS مقصور على أصل الموقع فقط.
 */

import webpush from "web-push";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function corsHeaders(env, origin) {
  const allow = origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function isValidToken(t) {
  return typeof t === "string" && /^[a-f0-9-]{20,60}$/i.test(t);
}

async function handleSync(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  const { deviceToken, subscription, reminders, deviceLabel } = body || {};
  if (!isValidToken(deviceToken)) return json({ error: "invalid deviceToken" }, 400, cors);
  if (!subscription || !subscription.endpoint) return json({ error: "invalid subscription" }, 400, cors);
  if (!Array.isArray(reminders)) return json({ error: "reminders must be an array" }, 400, cors);

  const record = {
    subscription,
    deviceLabel: deviceLabel || "",
    reminders: reminders.slice(0, 500), // حد أعلى بسيط لمنع تضخّم غير معقول
    updatedAt: Date.now(),
  };
  await env.MUDH_KV.put(`device:${deviceToken}`, JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 45, // ينظّف نفسه تلقائيًا لو توقّف الجهاز عن المزامنة ٤٥ يومًا
  });
  return json({ ok: true }, 200, cors);
}

async function handleUnsync(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  const { deviceToken } = body || {};
  if (!isValidToken(deviceToken)) return json({ error: "invalid deviceToken" }, 400, cors);
  await env.MUDH_KV.delete(`device:${deviceToken}`);
  return json({ ok: true }, 200, cors);
}

async function handleTestPush(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  const { deviceToken } = body || {};
  if (!isValidToken(deviceToken)) return json({ error: "invalid deviceToken" }, 400, cors);
  const raw = await env.MUDH_KV.get(`device:${deviceToken}`);
  if (!raw) return json({ error: "device not found" }, 404, cors);
  const record = JSON.parse(raw);
  const result = await sendPush(env, record.subscription, {
    title: "تجربة تنبيه 🔔",
    body: "لو تشوف هذا فالنظام يشتغل تمام.",
    tag: "mudh-test",
  });
  return json({ ok: result.ok, status: result.status }, 200, cors);
}

async function sendPush(env, subscription, payload) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  try {
    const res = await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600 });
    return { ok: true, status: res.statusCode };
  } catch (err) {
    return { ok: false, status: err.statusCode || 0, message: String(err) };
  }
}

/** يفحص كل الأجهزة المخزَّنة ويرسل أي تذكير حان وقته. */
async function runDueScan(env) {
  const now = Date.now();
  let cursor;
  let sent = 0, expiredDevices = 0;

  do {
    const page = await env.MUDH_KV.list({ prefix: "device:", cursor });
    cursor = page.cursor;

    for (const key of page.keys) {
      const raw = await env.MUDH_KV.get(key.name);
      if (!raw) continue;
      let record;
      try { record = JSON.parse(raw); } catch { continue; }

      let changed = false;
      const stillValid = [];

      for (const r of record.reminders || []) {
        // r: { id, taskId, title, body, triggerAt, stopAt, repeatEveryMs, lastFired, done }
        if (r.done) continue;
        if (now < r.triggerAt) { stillValid.push(r); continue; }
        if (r.stopAt && now >= r.stopAt && !r.repeatEveryMs) { continue; } // فات وقته ولم يتكرر — يُهمَل

        const due = !r.lastFired || (r.repeatEveryMs && now - r.lastFired >= r.repeatEveryMs);
        if (due && (!r.stopAt || now < r.stopAt || !r.repeatEveryMs)) {
          const result = await sendPush(env, record.subscription, {
            title: r.title,
            body: r.body || "",
            tag: `mudh-${r.taskId}-${r.id}`,
          });
          sent++;
          if (result.status === 404 || result.status === 410) {
            // الاشتراك لم يعد صالحًا (المستخدم أزال الإذن أو أعاد تثبيت التطبيق)
            expiredDevices++;
            record._expired = true;
            break;
          }
          r.lastFired = now;
          changed = true;
          if (!r.repeatEveryMs) continue; // غير متكرر: لا نعيده للقائمة
        }
        if (!r.stopAt || now < r.stopAt) stillValid.push(r);
      }

      if (record._expired) {
        await env.MUDH_KV.delete(key.name);
        continue;
      }
      if (changed) {
        record.reminders = stillValid;
        await env.MUDH_KV.put(key.name, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 45 });
      }
    }
  } while (cursor);

  return { sent, expiredDevices };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/health") return json({ ok: true }, 200, cors);
    if (url.pathname === "/sync" && request.method === "POST") return handleSync(request, env, cors);
    if (url.pathname === "/sync" && request.method === "DELETE") return handleUnsync(request, env, cors);
    if (url.pathname === "/test-push" && request.method === "POST") return handleTestPush(request, env, cors);
    if (url.pathname === "/run-now" && request.method === "POST") {
      const result = await runDueScan(env);
      return json(result, 200, cors);
    }

    return json({ error: "not found" }, 404, cors);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDueScan(env));
  },
};
