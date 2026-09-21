/**
 * mudhakkirah-push — Cloudflare Worker
 * ------------------------------------------------------------------
 * خدمة خلفية صغيرة تُرسل تنبيهات Web Push حتى لو تطبيق رزنامة مقفول
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

function isValidKeyHash(h) {
  return typeof h === "string" && /^[a-f0-9]{64}$/i.test(h);
}

/* فهرس الأجهزة: نقرأه بـ get (حدّه ١٠٠ ألف/يوم) بدل list (حدّه المجاني ١٠٠٠/يوم فقط) */
const INDEX_KEY = "index:devices";

async function readIndex(env) {
  const raw = await env.MUDH_KV.get(INDEX_KEY);
  if (raw) { try { return JSON.parse(raw); } catch {} }
  // ترحيل لمرة واحدة: أنشئ الفهرس من list قديم إن لم يوجد
  const tokens = [];
  let cursor;
  do {
    const page = await env.MUDH_KV.list({ prefix: "device:", cursor });
    cursor = page.cursor;
    for (const k of page.keys) tokens.push(k.name.slice("device:".length));
  } while (cursor);
  await env.MUDH_KV.put(INDEX_KEY, JSON.stringify(tokens));
  return tokens;
}

async function writeIndexIfChanged(env, before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    await env.MUDH_KV.put(INDEX_KEY, JSON.stringify(after));
  }
}

const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024; // 2MB يكفي بسهولة لمهام شخصية

async function handleDataPush(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  const { keyHash, snapshot } = body || {};
  if (!isValidKeyHash(keyHash)) return json({ error: "invalid keyHash" }, 400, cors);
  if (!snapshot || typeof snapshot !== "object") return json({ error: "invalid snapshot" }, 400, cors);

  const serialized = JSON.stringify(snapshot);
  if (serialized.length > MAX_SNAPSHOT_BYTES) return json({ error: "snapshot too large" }, 413, cors);

  // لا نكتب إن لم يتغيّر شيء (الكتابة محدودة بـ ١٠٠٠/يوم بالخطة المجانية)
  const existing = await env.MUDH_KV.get(`data:${keyHash}`);
  if (existing !== serialized) {
    await env.MUDH_KV.put(`data:${keyHash}`, serialized, {
      expirationTtl: 60 * 60 * 24 * 180, // ٦ أشهر بلا مزامنة قبل التنظيف التلقائي
    });
  }
  return json({ ok: true }, 200, cors);
}

async function handleDataPull(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  const { keyHash } = body || {};
  if (!isValidKeyHash(keyHash)) return json({ error: "invalid keyHash" }, 400, cors);

  const raw = await env.MUDH_KV.get(`data:${keyHash}`);
  if (!raw) return json({ error: "not found" }, 404, cors);
  return new Response(`{"snapshot":${raw}}`, { status: 200, headers: { ...JSON_HEADERS, ...cors } });
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
  const key = `device:${deviceToken}`;
  const prevRaw = await env.MUDH_KV.get(key);
  let same = false;
  if (prevRaw) {
    try {
      const prev = JSON.parse(prevRaw);
      same = JSON.stringify({ ...prev, updatedAt: 0 }) === JSON.stringify({ ...record, updatedAt: 0 });
    } catch {}
  }
  if (!same) {
    await env.MUDH_KV.put(key, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 45, // ينظّف نفسه تلقائيًا لو توقّف الجهاز عن المزامنة ٤٥ يومًا
    });
  }
  const idx = await readIndex(env);
  if (!idx.includes(deviceToken)) await writeIndexIfChanged(env, idx, [...idx, deviceToken]);
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
  const idx = await readIndex(env);
  await writeIndexIfChanged(env, idx, idx.filter((t) => t !== deviceToken));
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
  let sent = 0, expiredDevices = 0;

  const index = await readIndex(env); // get واحد — لا list
  const alive = [];

  for (const token of index) {
    const keyName = `device:${token}`;
    const raw = await env.MUDH_KV.get(keyName);
    if (!raw) continue; // انتهت صلاحيته — يسقط من الفهرس
    alive.push(token);
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
      await env.MUDH_KV.delete(keyName);
      alive.pop();
      continue;
    }
    if (changed) {
      record.reminders = stillValid;
      await env.MUDH_KV.put(keyName, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 45 });
    }
  }

  await writeIndexIfChanged(env, index, alive);
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
    if (url.pathname === "/data/push" && request.method === "POST") return handleDataPush(request, env, cors);
    if (url.pathname === "/data/pull" && request.method === "POST") return handleDataPull(request, env, cors);
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
