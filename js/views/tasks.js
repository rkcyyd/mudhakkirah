/**
 * views/tasks.js — قائمة المهام مع فلاتر وتجميع زمني
 */
import { store } from "../store.js";
import { el, clear, icon } from "../dom.js";
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
      }, [icon("plus", 16), "مهمة جديدة"]),
    ])
  );

  wrap.append(progressDashboard());

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

/** بطاقة تتبّع: نسبة الإنجاز العامة + شريط مصغّر لكل نوع فيه مهام. */
function progressDashboard() {
  const tasks = store.getTasks();
  if (!tasks.length) return el("div");

  const done = tasks.filter((t) => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);

  const byType = new Map();
  for (const t of tasks) {
    const key = t.typeId || "none";
    if (!byType.has(key)) byType.set(key, { total: 0, done: 0 });
    const s = byType.get(key);
    s.total++;
    if (t.done) s.done++;
  }

  const typeRows = store
    .getTypes()
    .map((type) => ({ type, s: byType.get(type.id) }))
    .filter((x) => x.s && x.s.total > 0)
    .map(({ type, s }) =>
      el("div.track-type", {}, [
        el("div.track-type-top", {}, [
          el("span.track-type-label", {}, [
            el("span.track-dot", { style: `background:${type.color}` }),
            type.label,
          ]),
          el("span.track-type-n", {}, [`${toArabicDigits(s.done)}/${toArabicDigits(s.total)}`]),
        ]),
        el("div.track-mini", {}, [
          el("div.track-mini-fill", {
            style: `width:${Math.round((s.done / s.total) * 100)}%; background:${type.color}`,
          }),
        ]),
      ])
    );

  return el("div.track-card", {}, [
    el("div.track-head", {}, [
      el("span", {}, ["الإنجاز العام"]),
      el("span.track-pct", {}, [`${toArabicDigits(pct)}٪`]),
    ]),
    el("div.track-bar", {}, [el("div.track-fill", { style: `width:${pct}%` })]),
    el("div.track-sub", {}, [`${toArabicDigits(done)} من ${toArabicDigits(tasks.length)} مهمة منجزة`]),
    typeRows.length ? el("div.track-types", {}, typeRows) : null,
  ]);
}

function row(t) {
  const type = store.getType(t.typeId);
  const d = describeDay(fromISODate(t.date));
  return el("div.task-row" + (t.done ? ".done" : ""), {}, [
    el("button.check", {
      onclick: () => store.toggleTask(t.id),
      "aria-label": "تبديل الإنجاز",
    }, [t.done ? icon("check", 14) : ""]),
    el("span.tt-color", { style: `background:${type?.color || "#8b949e"}` }),
    el("div.task-body", { onclick: () => openTaskForm({ task: t }) }, [
      el("div.tt-title", {}, [t.title]),
      el("div.tt-meta", {}, [
        (type ? type.label : "بدون نوع") + " · " + d.weekday + " " + d.hijriShort +
        (t.time ? "  " + t.time : ""),
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
