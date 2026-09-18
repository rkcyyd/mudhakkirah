/**
 * views/widget.js — واجهة مصغّرة لسطح المكتب
 * ------------------------------------------------------------------
 * تعرض بسرعة: المتأخر، اليوم، والأيام السبعة القادمة — قابلة للتحكم
 * (تحديد الإنجاز، إضافة سريعة). تُفتح عادةً في نافذة صغيرة بلا إطار.
 */
import { store } from "../store.js";
import { el, clear, icon } from "../dom.js";
import { openTaskForm } from "../taskform.js";
import { examCountdownBanner } from "../examcountdown.js";
import {
  toISODate,
  fromISODate,
  describeDay,
  toArabicDigits,
  weekdayName,
} from "../dates.js";

export function renderWidget(root) {
  document.body.classList.add("widget-mode");
  const wrap = el("div.widget");
  root.append(wrap);

  const draw = () => paint(wrap);
  const unsub = store.subscribe(draw);
  draw();

  // تحديث تلقائي عند تغيّر اليوم (لو بقيت النافذة مفتوحة)
  const timer = setInterval(() => {
    if (wrap.dataset.day !== toISODate(new Date())) draw();
  }, 60000);

  return () => {
    document.body.classList.remove("widget-mode");
    clearInterval(timer);
    unsub();
  };
}

function paint(wrap) {
  clear(wrap);
  const todayISO = toISODate(new Date());
  wrap.dataset.day = todayISO;
  const today = new Date();
  const d = describeDay(today);
  const primaryGreg = store.getSettings().primaryCalendar === "gregorian";

  /* شريط علوي ملوّن (يعوّض عن غياب ترويسة نظام قابلة للتصميم) */
  wrap.append(el("div.w-accent"));

  /* رأس */
  wrap.append(
    el("div.w-head", {}, [
      el("div.w-date", {}, [
        el("div.w-weekday", {}, [d.weekday]),
        el("div.w-hijri", {}, [primaryGreg ? d.greg : d.hijri]),
        el("div.w-greg", {}, [primaryGreg ? d.hijri : d.greg]),
      ]),
      el("div.w-actions", {}, [
        el("button.icon-btn", {
          title: "إضافة مهمة",
          onclick: () => openTaskForm({ date: todayISO }),
        }, [icon("plus", 18)]),
        el("a.icon-btn", { href: "#/calendar", title: "فتح التطبيق كاملًا" }, [icon("maximize", 16)]),
      ]),
    ])
  );

  const banner = examCountdownBanner();
  if (banner) wrap.append(banner);

  /* تجميع المهام */
  const tasks = store.getTasks().filter((t) => !t.done);
  const overdue = tasks
    .filter((t) => t.date < todayISO)
    .sort((a, b) => b.date.localeCompare(a.date));
  const todayTasks = tasks.filter((t) => t.date === todayISO);

  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);
  const horizonISO = toISODate(horizon);
  const upcoming = tasks
    .filter((t) => t.date > todayISO && t.date <= horizonISO)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  if (!overdue.length && !todayTasks.length && !upcoming.length) {
    wrap.append(el("div.w-empty", {}, ["لا مهام قريبة 🎉"]));
    return;
  }

  if (overdue.length) wrap.append(section("متأخرة", overdue, "over"));
  wrap.append(section("اليوم", todayTasks, "today", true));

  /* الأيام القادمة مجمّعة حسب اليوم */
  const byDay = new Map();
  for (const t of upcoming) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date).push(t);
  }
  for (const [date, arr] of byDay) {
    const dd = fromISODate(date);
    const label = `${weekdayName(dd)}  ${describeDay(dd).hijriShort}`;
    wrap.append(section(label, arr, ""));
  }
}

function section(title, arr, cls, showEmpty = false) {
  const box = el("div.w-sec" + (cls ? "." + cls : ""));
  box.append(el("div.w-sec-title", {}, [
    title,
    arr.length ? el("span.w-count", {}, [toArabicDigits(arr.length)]) : null,
  ]));
  if (!arr.length) {
    if (showEmpty) box.append(el("div.w-none", {}, ["لا شيء اليوم"]));
    return box;
  }
  for (const t of arr) box.append(row(t));
  return box;
}

function row(t) {
  const type = store.getType(t.typeId);
  return el("div.w-task", {}, [
    el("button.check.sm", {
      onclick: () => store.toggleTask(t.id),
      "aria-label": "إنجاز",
    }, [""]),
    el("span.tt-color", { style: `background:${type?.color || "#8b949e"}` }),
    el("div.w-task-body", { onclick: () => openTaskForm({ task: t }) }, [
      el("div.w-task-title", {}, [t.title]),
      el("div.w-task-meta", {}, [
        (type ? type.label : "بدون نوع") + (t.time ? "  " + t.time : ""),
      ]),
    ]),
  ]);
}
