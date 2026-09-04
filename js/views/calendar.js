/**
 * views/calendar.js — عرض التقويم الشهري (هجري + ميلادي)
 */
import { store, typeVisibleOnCalendar } from "../store.js";
import { el, clear } from "../dom.js";
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
      el("button.icon-btn", { onclick: () => shift(1), "aria-label": "الشهر التالي" }, ["›"]),
      el("button.btn.btn-ghost.btn-sm", { onclick: goToday }, ["اليوم"]),
      el("button.icon-btn", { onclick: () => shift(-1), "aria-label": "الشهر السابق" }, ["‹"]),
    ]),
    el("div.cal-title", {}, [
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
    }, ["＋"])
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
  }, [
    el("div.cell-nums", {}, [
      el("span.num-hijri", {}, [toArabicDigits(h.day)]),
      el("span.num-greg", {}, [toArabicDigits(cell.date.getDate())]),
    ]),
    el("div.cell-chips", {},
      visible.slice(0, 3).map((t) => {
        const type = store.getType(t.typeId);
        return el("span.chip" + (t.done ? ".done" : ""), {
          style: `--c:${type?.color || "#8b949e"}`,
          title: t.title,
        }, [el("span.chip-label", {}, [t.title])]);
      })
    ),
    visible.length > 3 && el("div.cell-more", {}, [`+${toArabicDigits(visible.length - 3)}`]),
  ]);
  return node;
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
        el("div.day-task" + (t.done ? ".done" : ""), {}, [
          el("button.check", {
            onclick: () => store.toggleTask(t.id),
            "aria-label": "تبديل الإنجاز",
          }, [t.done ? "✓" : ""]),
          el("span.tt-color", { style: `background:${type?.color || "#8b949e"}` }),
          el("div.tt-main", {
            onclick: () => openTaskForm({ task: t }),
          }, [
            el("div.tt-title", {}, [t.title]),
            el("div.tt-meta", {}, [
              type ? type.label : "بدون نوع",
              t.time ? " · " + t.time : "",
              hidden ? " · مخفي من التقويم" : "",
            ]),
          ]),
        ])
      );
    }
  }

  return el("div.day-panel", {}, [
    el("div.day-head", {}, [
      el("div", {}, [
        el("div.day-weekday", {}, [d.weekday]),
        el("div.day-hijri", {}, [d.hijri]),
        el("div.day-greg", {}, [d.greg]),
      ]),
      el("button.btn.btn-primary.btn-sm", {
        onclick: () => openTaskForm({ date: state.selected }),
      }, ["＋ مهمة"]),
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
