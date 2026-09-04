/**
 * views/tasks.js — قائمة المهام مع فلاتر وتجميع زمني
 */
import { store } from "../store.js";
import { el, clear } from "../dom.js";
import { openTaskForm } from "../taskform.js";
import { toISODate, fromISODate, describeDay, toArabicDigits } from "../dates.js";

const filter = { typeId: "all", status: "open" }; // status: open | all | done

export function renderTasks(root) {
  const wrap = el("div.page");
  root.append(wrap);
  const draw = () => paint(wrap);
  const unsub = store.subscribe(draw);
  draw();
  return unsub;
}

function paint(wrap) {
  clear(wrap);
  const types = store.getTypes();

  wrap.append(
    el("div.page-head", {}, [
      el("h2", {}, ["المهام"]),
      el("button.btn.btn-primary", {
        onclick: () => openTaskForm({}),
      }, ["＋ مهمة جديدة"]),
    ])
  );

  /* ------- فلاتر ------- */
  const typeChips = el("div.filter-chips", {}, [
    chip("الكل", filter.typeId === "all", () => { filter.typeId = "all"; paint(wrap); }),
    ...types.map((t) =>
      chip(t.label, filter.typeId === t.id, () => { filter.typeId = t.id; paint(wrap); }, t.color)
    ),
  ]);

  const statusChips = el("div.filter-chips", {}, [
    chip("غير المنجزة", filter.status === "open", () => { filter.status = "open"; paint(wrap); }),
    chip("المنجزة", filter.status === "done", () => { filter.status = "done"; paint(wrap); }),
    chip("الكل", filter.status === "all", () => { filter.status = "all"; paint(wrap); }),
  ]);

  wrap.append(el("div.filters", {}, [typeChips, statusChips]));

  /* ------- تطبيق الفلترة ------- */
  let tasks = store.getTasks().slice();
  if (filter.typeId !== "all") tasks = tasks.filter((t) => t.typeId === filter.typeId);
  if (filter.status === "open") tasks = tasks.filter((t) => !t.done);
  if (filter.status === "done") tasks = tasks.filter((t) => t.done);

  tasks.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  if (!tasks.length) {
    wrap.append(el("div.empty.big", {}, ["لا توجد مهام مطابقة."]));
    return;
  }

  /* ------- تجميع ------- */
  const todayISO = toISODate(new Date());
  const groups = { overdue: [], today: [], upcoming: [], done: [] };
  for (const t of tasks) {
    if (t.done) groups.done.push(t);
    else if (t.date < todayISO) groups.overdue.push(t);
    else if (t.date === todayISO) groups.today.push(t);
    else groups.upcoming.push(t);
  }

  const sections = [
    ["متأخرة", groups.overdue, "sec-overdue"],
    ["اليوم", groups.today, "sec-today"],
    ["قادمة", groups.upcoming, ""],
    ["منجزة", groups.done, "sec-done"],
  ];

  for (const [label, arr, cls] of sections) {
    if (!arr.length) continue;
    wrap.append(el("div.sec-title." + (cls || "x"), {}, [
      label, el("span.count", {}, [toArabicDigits(arr.length)]),
    ]));
    const listEl = el("div.task-list");
    for (const t of arr) listEl.append(row(t));
    wrap.append(listEl);
  }
}

function row(t) {
  const type = store.getType(t.typeId);
  const d = describeDay(fromISODate(t.date));
  return el("div.task-row" + (t.done ? ".done" : ""), {}, [
    el("button.check", {
      onclick: () => store.toggleTask(t.id),
      "aria-label": "تبديل الإنجاز",
    }, [t.done ? "✓" : ""]),
    el("span.tt-color", { style: `background:${type?.color || "#8b949e"}` }),
    el("div.task-body", { onclick: () => openTaskForm({ task: t }) }, [
      el("div.tt-title", {}, [t.title]),
      el("div.tt-meta", {}, [
        (type ? type.label : "بدون نوع") + " · " + d.weekday + " " + d.hijriShort +
        (t.time ? " · " + t.time : ""),
      ]),
    ]),
  ]);
}

function chip(label, active, onClick, color) {
  return el("button.fchip" + (active ? ".active" : ""), {
    onclick: onClick,
    style: color ? `--chip:${color}` : null,
  }, [label]);
}
