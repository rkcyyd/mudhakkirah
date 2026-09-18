/**
 * views/calendar.js — عرض التقويم الشهري (هجري + ميلادي)
 */
import { store, typeVisibleOnCalendar } from "../store.js";
import { el, clear, icon } from "../dom.js";
import { openTaskForm } from "../taskform.js";
import { examCountdownBanner } from "../examcountdown.js";
import {
  buildMonthGrid,
  monthTitle,
  weekdayNames,
  toHijriParts,
  toArabicDigits,
  toISODate,
  fromISODate,
  isToday,
  describeDay,
} from "../dates.js";

// حالة العرض محفوظة بين إعادات الرسم داخل نفس الجلسة
const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selected: toISODate(new Date()),
};

export function renderCalendar(root) {
  const wrap = el("div.cal-wrap");
  root.append(wrap);

  const draw = () => paint(wrap);
  const unsub = store.subscribe(draw);
  draw();
  return unsub;
}

function paint(wrap) {
  clear(wrap);
  const settings = store.getSettings();
  const grid = buildMonthGrid(state.year, state.month, settings.weekStart);
  const title = monthTitle(state.year, state.month);

  const banner = examCountdownBanner();
  if (banner) wrap.append(banner);

  /* ------- شريط التنقل ------- */
  const header = el("div.cal-header", {}, [
    el("div.cal-nav", {}, [
      el("button.icon-btn", { onclick: () => shift(-1), "aria-label": "الشهر السابق" }, [icon("chevron-end", 18)]),
      el("button.btn.btn-ghost.btn-sm", { onclick: goToday }, ["اليوم"]),
      el("button.icon-btn", { onclick: () => shift(1), "aria-label": "الشهر التالي" }, [icon("chevron-start", 18)]),
    ]),
    el("div.cal-title", {}, settings.primaryCalendar === "gregorian" ? [
      el("div.cal-title-hijri", {}, [title.greg]),
      el("div.cal-title-greg", {}, [title.hijri]),
    ] : [
      el("div.cal-title-hijri", {}, [title.hijri]),
      el("div.cal-title-greg", {}, [title.greg]),
    ]),
  ]);

  /* ------- أيام الأسبوع ------- */
  const names = weekdayNames(true);
  const ordered = names.slice(settings.weekStart).concat(names.slice(0, settings.weekStart));
  const dow = el("div.cal-dow", {}, ordered.map((n) => el("div", {}, [n])));

  /* ------- شبكة الأيام ------- */
  const gridEl = el("div.cal-grid");
  for (const week of grid) {
    for (const cell of week) {
      gridEl.append(dayCell(cell, settings));
    }
  }

  wrap.append(header, dow, gridEl, dayPanel(settings));

  /* رابط زر عائم لإضافة مهمة لليوم المحدد */
  wrap.append(
    el("button.fab", {
      onclick: () => openTaskForm({ date: state.selected }),
      "aria-label": "إضافة مهمة",
    }, [icon("plus", 24)])
  );
}

function dayCell(cell, settings) {
  const h = toHijriParts(cell.date);
  const tasks = store.getTasksByDate(cell.iso);
  const visible = tasks.filter((t) =>
    typeVisibleOnCalendar(store.getType(t.typeId), settings)
  );

  const classes = ["cal-cell"];
  if (!cell.inMonth) classes.push("out");
  if (cell.iso === state.selected) classes.push("selected");
  if (isToday(cell.date)) classes.push("today");
  if (h.day === 1) classes.push("hijri-start");

  const node = el("button." + classes.join("."), {
    onclick: () => {
      state.selected = cell.iso;
      paint(node.closest(".cal-wrap"));
    },
    ondragover: (e) => {
      if (!draggingTaskId) return;
      e.preventDefault();
      node.classList.add("drop-target");
    },
    ondragleave: () => node.classList.remove("drop-target"),
    ondrop: (e) => {
      e.preventDefault();
      node.classList.remove("drop-target");
      if (draggingTaskId && cell.iso) {
        store.moveTask(draggingTaskId, cell.iso);
        state.selected = cell.iso;
      }
      draggingTaskId = null;
    },
  }, [
    cellNums(h.day, cell.date.getDate(), settings),
    el("div.cell-chips", {},
      visible.slice(0, 3).map((t) => {
        const type = store.getType(t.typeId);
        return el("span.chip" + (t.done ? ".done" : ""), {
          style: `--c:${type?.color || "#8b949e"}`,
          title: t.title + " — اسحبها ليوم آخر لتغيير التاريخ",
          draggable: "true",
          ondragstart: (e) => {
            draggingTaskId = t.id;
            e.dataTransfer.effectAllowed = "move";
          },
          ondragend: () => { draggingTaskId = null; },
        }, [el("span.chip-label", {}, [t.title])]);
      })
    ),
    visible.length > 3 && el("div.cell-more", {}, [`+${toArabicDigits(visible.length - 3)}`]),
  ]);
  return node;
}

// أثناء السحب: معرّف المهمة المسحوبة حاليًا (حالة وحدة بسيطة، بلا حاجة لمكتبة DnD)
let draggingTaskId = null;

/** يبني رقمي اليوم (هجري/ميلادي) مع إبراز الأهم حسب إعداد المستخدم. */
function cellNums(hijriDay, gregDay, settings) {
  const hijriEl = el("span.num-hijri", {}, [toArabicDigits(hijriDay)]);
  const gregEl = el("span.num-greg", {}, [toArabicDigits(gregDay)]);
  if (settings.primaryCalendar === "gregorian") {
    hijriEl.classList.add("num-secondary");
    gregEl.classList.add("num-primary");
    return el("div.cell-nums", {}, [gregEl, hijriEl]);
  }
  hijriEl.classList.add("num-primary");
  gregEl.classList.add("num-secondary");
  return el("div.cell-nums", {}, [hijriEl, gregEl]);
}

function dayPanel(settings) {
  const date = fromISODate(state.selected);
  const d = describeDay(date);
  const tasks = store.getTasksByDate(state.selected);

  const list = el("div.day-tasks");
  if (!tasks.length) {
    list.append(el("div.empty", {}, ["لا مهام في هذا اليوم."]));
  } else {
    for (const t of tasks) {
      const type = store.getType(t.typeId);
      const hidden = !typeVisibleOnCalendar(type, settings);
      list.append(
        el("div.day-task" + (t.done ? ".done" : ""), {
          draggable: "true",
          ondragstart: (e) => {
            draggingTaskId = t.id;
            e.dataTransfer.effectAllowed = "move";
          },
          ondragend: () => { draggingTaskId = null; },
        }, [
          el("button.check", {
            onclick: () => store.toggleTask(t.id),
            "aria-label": "تبديل الإنجاز",
          }, [t.done ? icon("check", 14) : ""]),
          el("span.tt-color", { style: `background:${type?.color || "#8b949e"}` }),
          el("div.tt-main", {
            onclick: () => openTaskForm({ task: t }),
          }, [
            el("div.tt-title", {}, [t.title]),
            el("div.tt-meta", {}, [
              type ? type.label : "بدون نوع",
              t.time ? "  " + t.time : "",
              hidden ? "  ·  مخفي من التقويم" : "",
            ]),
          ]),
        ])
      );
    }
  }

  return el("div.day-panel", {}, [
    el("div.day-head", {}, [
      el("div", {}, settings.primaryCalendar === "gregorian" ? [
        el("div.day-weekday", {}, [d.weekday]),
        el("div.day-hijri", {}, [d.greg]),
        el("div.day-greg", {}, [d.hijri]),
      ] : [
        el("div.day-weekday", {}, [d.weekday]),
        el("div.day-hijri", {}, [d.hijri]),
        el("div.day-greg", {}, [d.greg]),
      ]),
      el("button.btn.btn-primary.btn-sm", {
        onclick: () => openTaskForm({ date: state.selected }),
      }, [icon("plus", 16), "مهمة"]),
    ]),
    list,
  ]);
}

/* ------- تنقّل ------- */
function shift(deltaMonths) {
  const d = new Date(state.year, state.month + deltaMonths, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  repaint();
}
function goToday() {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  state.selected = toISODate(now);
  repaint();
}
function repaint() {
  const wrap = document.querySelector(".cal-wrap");
  if (wrap) paint(wrap);
}
