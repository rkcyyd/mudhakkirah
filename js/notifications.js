/**
 * notifications.js — جدولة تنبيهات المهام (محليًا، أثناء فتح التطبيق/الويدجت)
 * ------------------------------------------------------------------
 * لا يوجد خادم خلفي حاليًا، لذا هذه التنبيهات تعمل ما دام التطبيق أو
 * الويدجت مفتوحًا في نافذة/تبويب (حتى لو في الخلفية). لتنبيهات تصل
 * حتى مع إغلاق التطبيق بالكامل نحتاج خدمة push من خادم — ميزة قادمة
 * محتملة إن رغب المستخدم بها.
 */
import { store } from "./store.js";
import { fromISODate } from "./dates.js";

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
const TICK_MS = 20_000;
const DEFAULT_TIME = "09:00";

let timer = null;

export function startScheduler() {
  if (timer) return;
  tick();
  timer = setInterval(tick, TICK_MS);
}

export function stopScheduler() {
  clearInterval(timer);
  timer = null;
}

function dueDateTime(task) {
  const d = fromISODate(task.date);
  const [h, m] = (task.time || DEFAULT_TIME).split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

function tick() {
  const settings = store.getSettings();
  if (!settings.notificationsEnabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const now = Date.now();
  for (const task of store.getTasks()) {
    if (task.done || !Array.isArray(task.reminders) || !task.reminders.length) continue;
    const due = dueDateTime(task).getTime();
    const type = store.getType(task.typeId);

    for (const rule of task.reminders) {
      const offsetMs = (rule.amount || 0) * (UNIT_MS[rule.unit] || UNIT_MS.hours);
      const triggerAt = due - offsetMs;
      const firedAt = task.remindersFired?.[rule.id];

      if (!rule.repeatEvery) {
        if (firedAt) continue;
        if (now >= triggerAt && now < due + UNIT_MS.days) {
          fire(task, type, rule);
          store.markReminderFired(task.id, rule.id, new Date(now).toISOString());
        }
      } else {
        if (now < triggerAt || now >= due) continue;
        const stepMs = (rule.repeatEvery.amount || 1) * (UNIT_MS[rule.repeatEvery.unit] || UNIT_MS.hours);
        const last = firedAt ? new Date(firedAt).getTime() : 0;
        if (now - last >= stepMs) {
          fire(task, type, rule);
          store.markReminderFired(task.id, rule.id, new Date(now).toISOString());
        }
      }
    }
  }
}

async function fire(task, type, rule) {
  const body = [type?.label, task.time].filter(Boolean).join(" · ");
  const options = {
    body,
    tag: `mudh-${task.id}-${rule.id}`,
    icon: "./assets/icon.png",
    badge: "./assets/icon.png",
    dir: "rtl",
    lang: "ar",
  };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) reg.showNotification(task.title, options);
    else new Notification(task.title, options);
  } catch {
    try { new Notification(task.title, options); } catch {}
  }
}

/** يطلب إذن الإشعارات من المتصفح. يعيد true إذا مُنح. */
export async function requestPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export function permissionState() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}
