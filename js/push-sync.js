/**
 * push-sync.js — مزامنة التذكيرات مع خدمة الإشعارات الخلفية (Cloudflare Worker)
 * ------------------------------------------------------------------
 * هذا هو المسار "الحقيقي": يعمل حتى لو التطبيق مقفول تمامًا على الجهاز،
 * لأن خادمًا خارجيًا (لا هذا المتصفح) هو من يراقب المواعيد ويرسل.
 * يكمل نظام js/notifications.js (المحلي) لا يلغيه — المحلي أسرع/فوري
 * أثناء فتح التطبيق، وهذا يضمن الوصول حتى بعد إغلاقه.
 */
import { store } from "./store.js";

export const PUSH_SERVER_URL = "https://mudhakkirah-push.k12345aled.workers.dev";
const VAPID_PUBLIC_KEY = "BASArqGCZqxxme86NCQWr_29TWRgiVm3jKERJjhi1HsLEhKZQU3MY8cQN6ShH_YRbVj-VgBbMyFIuekMwTvoEY4";

const DEVICE_TOKEN_KEY = "mudh_device_token";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function getDeviceToken() {
  let t = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(DEVICE_TOKEN_KEY, t);
  }
  return t;
}

/** يبني قائمة التذكيرات بأوقات إطلاق مطلقة (ms) جاهزة للخادم. */
function buildReminderPayload() {
  const out = [];
  const DAY = 86_400_000, HOUR = 3_600_000, MIN = 60_000;
  const unitMs = { minutes: MIN, hours: HOUR, days: DAY };

  for (const task of store.getTasks()) {
    if (task.done || !Array.isArray(task.reminders)) continue;
    const type = store.getType(task.typeId);
    const [h, m] = (task.time || "09:00").split(":").map(Number);
    const due = new Date(task.date + "T00:00:00");
    due.setHours(h, m, 0, 0);
    const dueAt = due.getTime();

    for (const rule of task.reminders) {
      const offset = (rule.amount || 0) * (unitMs[rule.unit] || HOUR);
      out.push({
        id: rule.id,
        taskId: task.id,
        title: task.title,
        body: [type?.label, task.time].filter(Boolean).join(" · "),
        triggerAt: dueAt - offset,
        stopAt: dueAt,
        repeatEveryMs: rule.repeatEvery
          ? (rule.repeatEvery.amount || 1) * (unitMs[rule.repeatEvery.unit] || HOUR)
          : null,
      });
    }
  }
  return out;
}

/** يشترك في Web Push ويزامن قائمة التذكيرات الحالية مع الخادم. */
export async function syncPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  if (Notification.permission !== "granted") return { ok: false, reason: "no-permission" };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const res = await fetch(`${PUSH_SERVER_URL}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceToken: getDeviceToken(),
        subscription: sub.toJSON(),
        reminders: buildReminderPayload(),
        deviceLabel: navigator.userAgent.slice(0, 80),
      }),
    });
    if (!res.ok) return { ok: false, reason: "server-error" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "exception", error: String(e) };
  }
}

/** يوقف المزامنة ويحذف بيانات هذا الجهاز من الخادم. */
export async function unsyncPush() {
  try {
    await fetch(`${PUSH_SERVER_URL}/sync`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceToken: getDeviceToken() }),
    });
  } catch {}
}

/** يطلب من الخادم إرسال تنبيه تجريبي فورًا لهذا الجهاز. */
export async function sendTestPush() {
  try {
    const res = await fetch(`${PUSH_SERVER_URL}/test-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceToken: getDeviceToken() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let debounceTimer = null;
/** يجدول مزامنة (بتأخير بسيط لتجميع عدّة تغييرات متتالية). */
export function scheduleSync() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (store.getSettings().notificationsEnabled) syncPush();
  }, 3000);
}
