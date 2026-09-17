/**
 * app.js — نقطة البداية: التوجيه (router)، القائمة، الوضع الليلي
 */
import { store } from "./store.js";
import { iconHTML } from "./icons.js";
import { renderCalendar } from "./views/calendar.js";
import { renderTasks } from "./views/tasks.js";
import { renderTypes } from "./views/types.js";
import { renderHabits } from "./views/habits.js";
import { renderNotes } from "./views/notes.js";
import { renderSettings } from "./views/settings.js";
import { renderWidget } from "./views/widget.js";
import { startScheduler } from "./notifications.js";
import { showLockScreen, isUnlockedThisSession } from "./lock.js";
import { syncPush, scheduleSync } from "./push-sync.js";
import { scheduleSyncPush, startSyncLoop } from "./sync.js";

const routes = {
  calendar: renderCalendar,
  tasks: renderTasks,
  types: renderTypes,
  habits: renderHabits,
  notes: renderNotes,
  settings: renderSettings,
  widget: renderWidget,
};

const viewEl = document.getElementById("view");
const manifestLink = document.getElementById("manifestLink");
let currentCleanup = null;

/* ----------------------- الأيقونات الثابتة ----------------------- */
document.getElementById("menuToggle").innerHTML = iconHTML("menu", 20);
document.querySelectorAll(".nav-link").forEach((a) => {
  const slot = a.querySelector(".nav-icon");
  if (slot) slot.innerHTML = iconHTML(a.dataset.icon, 18);
});

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [name, ...rest] = raw.split("/");
  return { name: routes[name] ? name : "calendar", params: rest };
}

function render() {
  const { name, params } = parseHash();

  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch {}
  }
  currentCleanup = null;

  viewEl.innerHTML = "";
  const cleanup = routes[name](viewEl, params);
  if (typeof cleanup === "function") currentCleanup = cleanup;

  document.querySelectorAll(".nav-link").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === name);
  });
  closeNav();
  viewEl.scrollTo(0, 0);

  // في وضع الويدجت نبدّل ملف الـ manifest حتى يصير "إضافة إلى الشاشة الرئيسية"
  // تثبيتًا مستقلًا يفتح مباشرة على الويدجت (اسم وأيقونة خاصّان به).
  manifestLink.href = name === "widget" ? "./manifest-widget.webmanifest" : "./manifest.webmanifest";
}

/* ----------------------- القائمة الجانبية (جوال) ----------------------- */
const sidenav = document.getElementById("sidenav");
const scrim = document.getElementById("navScrim");

function openNav() {
  sidenav.classList.add("open");
  scrim.classList.add("show");
}
function closeNav() {
  sidenav.classList.remove("open");
  scrim.classList.remove("show");
}
document.getElementById("menuToggle").addEventListener("click", () => {
  sidenav.classList.contains("open") ? closeNav() : openNav();
});
scrim.addEventListener("click", closeNav);

/* ----------------------- الوضع الليلي ----------------------- */
const themeBtn = document.getElementById("themeToggle");
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.innerHTML = iconHTML(theme === "dark" ? "moon" : "sun", 19);
}
applyTheme(store.getSettings().theme || "light");

themeBtn.addEventListener("click", () => {
  const next = store.getSettings().theme === "dark" ? "light" : "dark";
  store.updateSettings({ theme: next });
});

store.subscribe((state) => {
  applyTheme(state.settings.theme || "light");
  scheduleSync();
  scheduleSyncPush();
});

/* ----------------------- التشغيل ----------------------- */
window.addEventListener("hashchange", render);
if (!location.hash) location.hash = "#/calendar";

function boot() {
  document.body.classList.add("unlocked");
  render();
  startScheduler();
  if (store.getSettings().notificationsEnabled) {
    syncPush();
    setInterval(syncPush, 5 * 60_000); // يُبقي المزامنة والاشتراك ساريين
  }
  startSyncLoop();
}

const lockSettings = store.getSettings();
if (lockSettings.appLockEnabled && lockSettings.appLockHash && !isUnlockedThisSession()) {
  showLockScreen(lockSettings.appLockHash, boot);
} else {
  boot();
}

/* ----------------------- PWA (يعمل بلا إنترنت) ----------------------- */
/* لا نُفعّل الـ service worker أثناء التطوير المحلي حتى تظهر التعديلات فورًا. */
const isLocalDev = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !isLocalDev) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
} else if ("serviceWorker" in navigator && isLocalDev) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
}
