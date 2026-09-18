/**
 * views/widget.js — واجهة مصغّرة لسطح المكتب/الجوال، بأقسام قابلة للتفعيل
 * ------------------------------------------------------------------
 * كل قسم (عدّاد اختبار، عدّاد مهمة، تقويم مصغّر، اليوم، القادمة، العادات)
 * يُفعَّل أو يُطفأ من الإعدادات ← الويدجت، فتبني بالضبط اللوحة اللي تناسبك
 * بدون الحاجة لطلب تعديل جديد في كل مرة.
 */
import { store, habitStats } from "../store.js";
import { el, clear, icon } from "../dom.js";
import { openTaskForm } from "../taskform.js";
import { examCountdownBanner, taskCountdownBanner } from "../examcountdown.js";
import {
  toISODate,
  fromISODate,
  describeDay,
  toArabicDigits,
  weekdayName,
  weekdayNames,
  buildMonthGrid,
  toHijriParts,
  isToday,
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
  const settings = store.getSettings();
  const primaryGreg = settings.primaryCalendar === "gregorian";
  const sections = settings.widgetSections || {};

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

  let any = false;

  if (sections.examCountdown) {
    const b = examCountdownBanner();
    if (b) { wrap.append(b); any = true; }
  }
  if (sections.taskCountdown) {
    const b = taskCountdownBanner();
    if (b) { wrap.append(b); any = true; }
  }
  if (sections.miniCalendar) { wrap.append(sectionMiniCalendar(todayISO)); any = true; }
  if (sections.today) { any = sectionToday(wrap, todayISO) || any; }
  if (sections.upcoming) { any = sectionUpcoming(wrap, todayISO, settings.widgetUpcomingRange || "week") || any; }
  if (sections.habits) { const has = sectionHabits(wrap, todayISO); any = any || has; }

  if (!any) {
    wrap.append(el("div.w-empty", {}, [
      "لا شيء لعرضه 🎉",
      el("div.w-empty-hint", {}, ["فعّل أقسامًا من الإعدادات ← الويدجت"]),
    ]));
  }
}

/* ===================== الأقسام ===================== */

function sectionToday(wrap, todayISO) {
  const tasks = store.getTasks().filter((t) => !t.done);
  const overdue = tasks.filter((t) => t.date < todayISO).sort((a, b) => b.date.localeCompare(a.date));
  const todayTasks = tasks.filter((t) => t.date === todayISO);
  if (overdue.length) wrap.append(taskSection("متأخرة", overdue, "over"));
  wrap.append(taskSection("اليوم", todayTasks, "today", true));
  return overdue.length > 0 || todayTasks.length > 0;
}

function sectionUpcoming(wrap, todayISO, range) {
  const tasks = store.getTasks().filter((t) => !t.done);
  const today = fromISODate(todayISO);
  const horizon = new Date(today);
  if (range === "month") {
    horizon.setMonth(horizon.getMonth() + 1);
    horizon.setDate(0); // آخر يوم في الشهر الحالي
  } else {
    horizon.setDate(horizon.getDate() + 7);
  }
  const horizonISO = toISODate(horizon);
  const upcoming = tasks
    .filter((t) => t.date > todayISO && t.date <= horizonISO)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  if (!upcoming.length) return false;

  wrap.append(el("div.w-sec-heading", {}, [range === "month" ? "باقي الشهر" : "هذا الأسبوع"]));
  const byDay = new Map();
  for (const t of upcoming) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date).push(t);
  }
  for (const [date, arr] of byDay) {
    const dd = fromISODate(date);
    const label = `${weekdayName(dd)}  ${describeDay(dd).hijriShort}`;
    wrap.append(taskSection(label, arr, ""));
  }
  return true;
}

function sectionHabits(wrap, todayISO) {
  const habits = store.getHabits();
  if (!habits.length) return false;
  wrap.append(el("div.w-sec-heading", {}, ["العادات اليوم"]));
  const box = el("div.w-habits");
  for (const h of habits) {
    const done = !!h.log[todayISO];
    const stats = habitStats(h, todayISO);
    box.append(
      el("button.w-habit" + (done ? ".done" : ""), {
        style: `--c:${h.color}`,
        onclick: () => store.toggleHabitDay(h.id, todayISO),
      }, [
        el("span.w-habit-emoji", {}, [h.icon || "🎯"]),
        el("span.w-habit-label", {}, [h.label]),
        stats.streak > 0 ? el("span.w-habit-streak", {}, [`🔥${toArabicDigits(stats.streak)}`]) : null,
        el("span.w-habit-check", {}, [done ? icon("check", 12) : ""]),
      ])
    );
  }
  wrap.append(box);
  return true;
}

function sectionMiniCalendar(todayISO) {
  const today = fromISODate(todayISO);
  const weekStart = store.getSettings().weekStart ?? 0;
  const grid = buildMonthGrid(today.getFullYear(), today.getMonth(), weekStart);
  const tasksByDate = new Set(store.getTasks().filter((t) => !t.done).map((t) => t.date));

  const names = weekdayNames(true);
  const ordered = names.slice(weekStart).concat(names.slice(0, weekStart));

  const box = el("div.w-minical", {}, [
    el("div.w-minical-dow", {}, ordered.map((n) => el("span", {}, [n[0]]))),
  ]);
  const gridEl = el("div.w-minical-grid");
  for (const week of grid) {
    for (const cell of week) {
      const has = tasksByDate.has(cell.iso);
      gridEl.append(
        el("span.w-minical-day"
          + (cell.inMonth ? "" : ".out")
          + (isToday(cell.date) ? ".today" : "")
          + (has ? ".has" : ""), {}, [toArabicDigits(cell.date.getDate())])
      );
    }
  }
  box.append(gridEl);
  return box;
}

/* ===================== أدوات مشتركة ===================== */

function taskSection(title, arr, cls, showEmpty = false) {
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
