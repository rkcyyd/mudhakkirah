/**
 * app.js — نقطة البداية: التوجيه (router)، القائمة، الوضع الليلي
 */
import { store } from "./store.js";
import { iconHTML } from "./icons.js";
import { renderCalendar } from "./views/calendar.js";
import { renderTasks } from "./views/tasks.js";
import { renderTypes } from "./views/types.js";
import { renderNotes } from "./views/notes.js";
import { renderSettings } from "./views/settings.js";
import { renderWidget } from "./views/widget.js";

const routes = {
  calendar: renderCalendar,
  tasks: renderTasks,
  types: renderTypes,
  notes: renderNotes,
  settings: renderSettings,
  widget: renderWidget,
};

const viewEl = document.getElementById("view");
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
});

/* ----------------------- التشغيل ----------------------- */
window.addEventListener("hashchange", render);
if (!location.hash) location.hash = "#/calendar";
render();

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
