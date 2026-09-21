/**
 * views/habits.js — لوحة العادات: إحصاءات شاملة + جدول أسبوعي/شهري + تصفية بالفئة
 * ------------------------------------------------------------------
 * جدول واحد يلخّص كل العادات (يبقى مقروءًا مهما كثرت)، مع ✓ على ما أنجزته،
 * وشريط إحصاءات عامة، وتصفية بفئة معيّنة. الضغط على اسم العادة يفتح تفصيلها
 * الكامل (حلقة التقدّم، أيام الأسبوع، الإحصاءات).
 */
import { store, habitStats } from "../store.js";
import { el, clear, icon, openModal } from "../dom.js";
import { toISODate, toArabicDigits, weekdayNames, gregMonthName } from "../dates.js";

const PALETTE = [
  "#2da44e", "#1f6feb", "#d29922", "#cf222e", "#8250df",
  "#0969da", "#bc4c00", "#6639ba", "#218bff", "#e3b341",
];
const EMOJI_PRESETS = ["📖", "🏃", "💧", "🧘", "🕌", "😴", "🥗", "✍️", "💊", "🚭", "📵", "🎯"];
const CATEGORY_PRESETS = ["صحة", "عبادة", "دراسة", "عمل", "شخصي"];

// حالة العرض (تبقى طوال الجلسة)
const view = { category: "all", mode: "week", monthOffset: 0 };

export function renderHabits(root) {
  const wrap = el("div.page");
  root.append(wrap);
  const draw = () => paint(wrap);
  const unsub = store.subscribe(draw);
  draw();
  return unsub;
}

function paint(wrap) {
  clear(wrap);
  const all = store.getHabits();

  wrap.append(
    el("div.page-head", {}, [
      el("h2", {}, ["العادات"]),
      el("button.btn.btn-primary", { onclick: () => openHabitForm() }, [icon("plus", 16), "عادة جديدة"]),
    ])
  );

  if (!all.length) {
    wrap.append(
      el("p.hint", {}, ["عادات يومية بسيطة — منفصلة عن التقويم. أضف أول عادة تبي تتابعها."]),
      el("div.empty.big", {}, ["لا عادات بعد."])
    );
    return;
  }

  // فئات موجودة فعليًا
  const cats = [...new Set(all.map((h) => h.category).filter(Boolean))];
  if (view.category !== "all" && !cats.includes(view.category)) view.category = "all";
  const habits = view.category === "all" ? all : all.filter((h) => h.category === view.category);

  wrap.append(summaryStrip(habits));

  /* شريط الأدوات: فئات + وضع العرض */
  const chips = el("div.filter-chips", {}, [
    chip("الكل", view.category === "all", () => { view.category = "all"; paint(wrap); }),
    ...cats.map((c) => chip(c, view.category === c, () => { view.category = c; paint(wrap); })),
  ]);
  const modeToggle = el("div.seg", {}, [
    segBtn("أسبوع", view.mode === "week", () => { view.mode = "week"; paint(wrap); }),
    segBtn("شهر", view.mode === "month", () => { view.mode = "month"; paint(wrap); }),
  ]);
  wrap.append(el("div.habit-toolbar", {}, [chips, modeToggle]));

  wrap.append(view.mode === "month" ? monthTable(habits, wrap) : weekTable(habits));
}

function chip(label, active, onClick) {
  return el("button.fchip" + (active ? ".active" : ""), { onclick: onClick }, [label]);
}
function segBtn(label, active, onClick) {
  return el("button.seg-btn" + (active ? ".active" : ""), { onclick: onClick }, [label]);
}

/* ===================== أدوات التواريخ ===================== */

function thisWeekDates() {
  const weekStart = store.getSettings().weekStart ?? 0;
  const today = new Date();
  const offset = (today.getDay() - weekStart + 7) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function monthDates(offset) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return {
    first,
    dates: Array.from({ length: days }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)),
  };
}

/* ===================== شريط الإحصاءات العامة ===================== */

function summaryStrip(habits) {
  const todayISO = toISODate(new Date());
  const week = thisWeekDates();
  const doneToday = habits.filter((h) => h.log[todayISO]).length;

  let weekDone = 0, weekTarget = 0, bestStreak = 0, bestName = "";
  for (const h of habits) {
    const target = h.target || 7;
    weekDone += Math.min(target, week.filter((d) => h.log[toISODate(d)]).length);
    weekTarget += target;
    const st = habitStats(h, todayISO).streak;
    if (st > bestStreak) { bestStreak = st; bestName = h.label; }
  }
  const weekPct = weekTarget ? Math.round((weekDone / weekTarget) * 100) : 0;

  return el("div.habit-summary", {}, [
    statBox("اليوم", `${toArabicDigits(doneToday)}/${toArabicDigits(habits.length)}`, "عادات منجزة"),
    statBox("هذا الأسبوع", `${toArabicDigits(weekPct)}٪`, "من أهدافك", weekPct),
    statBox("أطول سلسلة", bestStreak ? `🔥 ${toArabicDigits(bestStreak)}` : "–", bestName || "ابدأ اليوم"),
    statBox("العادات", toArabicDigits(habits.length), view.category === "all" ? "كل الفئات" : view.category),
  ]);
}

function statBox(label, value, sub, pct) {
  return el("div.hs-box", {}, [
    el("div.hs-label", {}, [label]),
    el("div.hs-value", {}, [value]),
    pct != null ? el("div.habit-mini-bar", {}, [el("div.habit-mini-fill.accent", { style: `width:${pct}%` })]) : null,
    el("div.hs-sub", {}, [sub]),
  ]);
}

/* ===================== الجدول الأسبوعي ===================== */

function weekTable(habits) {
  const week = thisWeekDates();
  const dayLabels = weekdayNames(true);
  const todayISO = toISODate(new Date());

  const table = el("div.habit-table");
  table.append(
    el("div.habit-thead", {}, [
      el("span.ht-col-name", {}, ["العادة"]),
      el("span.ht-col-progress", {}, ["الإنجاز"]),
      el("span.ht-col-days", {}, week.map((d) => el("span.ht-dh", {}, [dayLabels[d.getDay()][0]]))),
      el("span.ht-col-streak", {}, ["🔥"]),
    ])
  );

  for (const h of habits) {
    const target = h.target || 7;
    const done = week.filter((d) => h.log[toISODate(d)]).length;
    const pct = Math.min(100, Math.round((done / target) * 100));
    const stats = habitStats(h, todayISO);

    table.append(
      el("div.habit-row", { style: `--c:${h.color}` }, [
        nameCell(h),
        el("div.ht-col-progress", {}, [
          el("div.habit-mini-bar", {}, [el("div.habit-mini-fill", { style: `width:${pct}%` })]),
          el("span.habit-mini-frac", {}, [`${toArabicDigits(done)}/${toArabicDigits(target)}`]),
        ]),
        el("div.ht-col-days", {}, week.map((d) => checkCell(h, d, todayISO))),
        el("div.ht-col-streak", {}, [stats.streak > 0 ? toArabicDigits(stats.streak) : "–"]),
      ])
    );
  }
  return el("div.habit-table-wrap", {}, [table]);
}

/* ===================== الجدول الشهري ===================== */

function monthTable(habits, wrap) {
  const { first, dates } = monthDates(view.monthOffset);
  const todayISO = toISODate(new Date());
  const dayLabels = weekdayNames(true);
  const cols = `minmax(150px, 1.4fr) repeat(${dates.length}, 26px) 70px`;

  const nav = el("div.habit-monthnav", {}, [
    el("button.icon-btn.sm", { onclick: () => { view.monthOffset--; paint(wrap); }, "aria-label": "الشهر السابق" }, [icon("chevron-end", 16)]),
    el("span.habit-monthname", {}, [`${gregMonthName(first.getMonth())} ${toArabicDigits(first.getFullYear())}`]),
    el("button.icon-btn.sm", { onclick: () => { view.monthOffset++; paint(wrap); }, "aria-label": "الشهر التالي" }, [icon("chevron-start", 16)]),
  ]);

  const head = el("div.mt-row.mt-head", { style: `grid-template-columns:${cols}` }, [
    el("span.mt-name", {}, ["العادة"]),
    ...dates.map((d) =>
      el("span.mt-dh" + (toISODate(d) === todayISO ? ".today" : ""), {}, [
        el("span.mt-dl", {}, [dayLabels[d.getDay()][0]]),
        el("span", {}, [toArabicDigits(d.getDate())]),
      ])
    ),
    el("span.mt-total", {}, ["المجموع"]),
  ]);

  const rows = habits.map((h) => {
    const past = dates.filter((d) => toISODate(d) <= todayISO);
    const done = dates.filter((d) => h.log[toISODate(d)]).length;
    const pct = past.length ? Math.round((done / past.length) * 100) : 0;
    return el("div.mt-row", { style: `grid-template-columns:${cols}; --c:${h.color}` }, [
      el("div.mt-name", {}, [nameCell(h)]),
      ...dates.map((d) => checkCell(h, d, todayISO)),
      el("div.mt-total", {}, [`${toArabicDigits(done)} · ${toArabicDigits(pct)}٪`]),
    ]);
  });

  return el("div.habit-month", {}, [
    nav,
    el("div.habit-table-wrap", {}, [el("div.habit-table.month", {}, [head, ...rows])]),
  ]);
}

/* ===================== خلايا مشتركة ===================== */

function nameCell(h) {
  return el("div.ht-col-name", { onclick: () => openHabitDetail(h), title: "التفاصيل" }, [
    el("span.habit-emoji.sm", { style: `--c:${h.color}` }, [h.icon || "🎯"]),
    el("span.habit-row-label", {}, [h.label]),
  ]);
}

function checkCell(h, d, todayISO) {
  const iso = toISODate(d);
  const done = !!h.log[iso];
  const isToday = iso === todayISO;
  const future = iso > todayISO;
  return el("button.habit-check" + (done ? ".done" : "") + (isToday ? ".is-today" : "") + (future ? ".future" : ""), {
    style: `--c:${h.color}`,
    title: `${toArabicDigits(d.getDate())}`,
    onclick: () => store.toggleHabitDay(h.id, iso),
  }, [done ? icon("check", 13) : ""]);
}

/* ===================== تفصيل عادة (نافذة) ===================== */

function openHabitDetail(h) {
  openModal(h.label, (body, close) => {
    const paintDetail = () => {
      clear(body);
      const todayISO = toISODate(new Date());
      const stats = habitStats(h, todayISO);
      const target = h.target || 7;
      const week = thisWeekDates();
      const doneThisWeek = week.filter((d) => h.log[toISODate(d)]).length;
      const pct = Math.min(100, Math.round((doneThisWeek / target) * 100));
      const dayLabels = weekdayNames(true);

      const weekRow = el("div.habit-week", {},
        week.map((d) => {
          const iso = toISODate(d);
          const isToday = iso === todayISO;
          const done = !!h.log[iso];
          return el("button.habit-daychip" + (done ? ".done" : "") + (isToday ? ".is-today" : ""), {
            style: `--c:${h.color}`,
            title: `${dayLabels[d.getDay()]} ${toArabicDigits(d.getDate())}`,
            onclick: () => store.toggleHabitDay(h.id, iso),
          }, [
            el("span.habit-daychip-l", {}, [dayLabels[d.getDay()][0]]),
            el("span.habit-daychip-n", {}, [toArabicDigits(d.getDate())]),
          ]);
        })
      );

      body.append(
        el("div.habit-detail", { style: `--c:${h.color}` }, [
          el("span.habit-emoji.lg", {}, [h.icon || "🎯"]),
          h.category ? el("span.tag", {}, [h.category]) : null,
          ring(pct, `${toArabicDigits(doneThisWeek)}/${toArabicDigits(target)}`, h.color),
          weekRow,
          el("div.habit-stats", {}, [
            el("span", {}, stats.streak > 0 ? [`🔥 ${toArabicDigits(stats.streak)} يوم متتالي`] : ["ابدأ اليوم"]),
            el("span", {}, [`آخر ٧ أيام: ${toArabicDigits(stats.last7)}`]),
            el("span", {}, [`آخر ٣٠ يوم: ${toArabicDigits(stats.last30)}`]),
          ]),
          el("div.modal-actions", {}, [
            el("button.btn.btn-danger-ghost", {
              onclick: () => {
                if (confirm(`حذف عادة "${h.label}"؟`)) { store.removeHabit(h.id); close(); }
              },
            }, [icon("trash", 16), "حذف"]),
            el("span.spacer"),
            el("button.btn.btn-ghost", { onclick: () => { close(); openHabitForm(h); } }, [icon("edit", 14), "تعديل"]),
            el("button.btn.btn-primary", { onclick: close }, ["إغلاق"]),
          ]),
        ])
      );
    };
    const unsub = store.subscribe(() => {
      const fresh = store.getHabit(h.id);
      if (fresh) { h = fresh; paintDetail(); }
      else close();
    });
    paintDetail();
    return unsub;
  });
}

function ring(pct, centerText, color) {
  const r = 42, c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "habit-ring");
  svg.innerHTML = `
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="9"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="9"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
      transform="rotate(-90 50 50)" style="transition: stroke-dashoffset .5s var(--ease, ease)"/>
  `;
  return el("div.habit-ring-wrap", {}, [svg, el("div.habit-ring-text", {}, [centerText])]);
}

/* ===================== نموذج إضافة/تعديل ===================== */

function openHabitForm(habit) {
  const editing = !!habit;
  openModal(editing ? "تعديل عادة" : "عادة جديدة", (body, close) => {
    const labelInput = el("input.field", {
      type: "text", placeholder: "اسم العادة (مثلاً: قراءة ٢٠ دقيقة)", value: habit?.label || "",
    });

    let emoji = habit?.icon || EMOJI_PRESETS[0];
    const emojiPreview = el("span.habit-emoji-pick-current", {}, [emoji]);
    const emojiRow = el("div.emoji-picker", {},
      EMOJI_PRESETS.map((e) =>
        el("button.emoji-opt" + (e === emoji ? ".sel" : ""), {
          onclick: (ev) => {
            emoji = e;
            emojiPreview.textContent = e;
            emojiRow.querySelectorAll(".emoji-opt").forEach((b) => b.classList.remove("sel"));
            ev.currentTarget.classList.add("sel");
          },
        }, [e])
      )
    );

    let color = habit?.color || PALETTE[0];
    const swatches = el("div.swatches", {},
      PALETTE.map((c) =>
        el("button.swatch" + (c === color ? ".sel" : ""), {
          style: `background:${c}`,
          onclick: (e) => {
            color = c;
            swatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
            e.currentTarget.classList.add("sel");
          },
        })
      )
    );

    const existingCats = [...new Set(store.getHabits().map((x) => x.category).filter(Boolean))];
    const allCats = [...new Set([...CATEGORY_PRESETS, ...existingCats])];
    const catInput = el("input.field", { type: "text", list: "habitCats", placeholder: "اختر أو اكتب فئة (اختياري)", value: habit?.category || "" });
    const catList = el("datalist#habitCats", {}, allCats.map((c) => el("option", { value: c })));

    const targetInput = el("input.field", { type: "number", min: "1", max: "7", value: String(habit?.target || 7) });

    body.append(
      el("div.form-field", {}, [
        el("span.form-label", {}, ["الرمز"]),
        el("div.emoji-picker-row", {}, [emojiPreview, emojiRow]),
      ]),
      field("الاسم", labelInput),
      el("div.form-field", {}, [el("span.form-label", {}, ["اللون"]), swatches]),
      field("الفئة", catInput),
      catList,
      field("الهدف (أيام/أسبوع)", targetInput),
      el("div.modal-actions", {}, [
        editing &&
          el("button.btn.btn-danger-ghost", {
            onclick: () => {
              if (confirm(`حذف عادة "${habit.label}"؟`)) { store.removeHabit(habit.id); close(); }
            },
          }, [icon("trash", 16), "حذف"]),
        el("span.spacer"),
        el("button.btn.btn-ghost", { onclick: close }, ["إلغاء"]),
        el("button.btn.btn-primary", {
          onclick: () => {
            const label = labelInput.value.trim();
            if (!label) { labelInput.focus(); return; }
            const target = Math.min(7, Math.max(1, Number(targetInput.value) || 7));
            const category = catInput.value.trim();
            if (editing) store.updateHabit(habit.id, { label, color, target, icon: emoji, category });
            else store.addHabit({ label, color, target, icon: emoji, category });
            close();
          },
        }, [editing ? "حفظ" : "إضافة"]),
      ])
    );
  });
}

function field(label, input) {
  return el("label.form-field", {}, [el("span.form-label", {}, [label]), input]);
}
