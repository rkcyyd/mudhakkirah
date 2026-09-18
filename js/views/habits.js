/**
 * views/habits.js — عادات شخصية بسيطة (لا تظهر في التقويم) مع تتبّع دائري أنيق
 * تصميم مستوحى من بطاقات "التقدّم الدائري" في أدوات التتبّع المالي —
 * حلقة نسبة الإنجاز + بطاقة ملوّنة برمز تعبيري لكل عادة.
 */
import { store, habitStats } from "../store.js";
import { el, clear, icon, openModal } from "../dom.js";
import { toISODate, toArabicDigits, weekdayNames } from "../dates.js";

const PALETTE = [
  "#2da44e", "#1f6feb", "#d29922", "#cf222e", "#8250df",
  "#0969da", "#bc4c00", "#6639ba", "#218bff", "#e3b341",
];
const EMOJI_PRESETS = ["📖", "🏃", "💧", "🧘", "🕌", "😴", "🥗", "✍️", "💊", "🚭", "📵", "🎯"];

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
  const habits = store.getHabits();

  wrap.append(
    el("div.page-head", {}, [
      el("h2", {}, ["العادات"]),
      el("button.btn.btn-primary", { onclick: () => openHabitForm() }, [icon("plus", 16), "عادة جديدة"]),
    ]),
    el("p.hint", {}, [
      "عادات يومية بسيطة — منفصلة تمامًا عن التقويم ولا تظهر فيه. ",
      "الحلقة تعرض إنجاز هذا الأسبوع، واضغط أي يوم بالأسفل لتسجيله.",
    ])
  );

  if (!habits.length) {
    wrap.append(el("div.empty.big", {}, ["لا عادات بعد. أضف أول عادة تبيها تتابعها."]));
    return;
  }

  const list = el("div.habit-grid-wrap");
  for (const h of habits) list.append(habitCard(h));
  wrap.append(list);
}

/** أيام هذا الأسبوع (من بداية الأسبوع المضبوطة بالإعدادات) كتواريخ ISO. */
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

function habitCard(h) {
  const todayISO = toISODate(new Date());
  const stats = habitStats(h, todayISO);
  const target = h.target || 7;
  const week = thisWeekDates();
  const doneThisWeek = week.filter((d) => h.log[toISODate(d)]).length;
  const pct = Math.min(100, Math.round((doneThisWeek / target) * 100));

  const dayLabels = weekdayNames(true);
  const weekRow = el("div.habit-week", {},
    week.map((d, i) => {
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

  return el("div.habit-card", { style: `--c:${h.color}` }, [
    el("div.habit-card-top", {}, [
      el("span.habit-emoji", {}, [h.icon || "🎯"]),
      el("div.habit-actions", {}, [
        el("button.icon-btn.sm", { onclick: () => openHabitForm(h), "aria-label": "تعديل" }, [icon("edit", 14)]),
        el("button.icon-btn.sm", {
          onclick: () => { if (confirm(`حذف عادة "${h.label}"؟`)) store.removeHabit(h.id); },
          "aria-label": "حذف",
        }, [icon("trash", 14)]),
      ]),
    ]),
    el("div.habit-name", {}, [h.label]),
    ring(pct, `${toArabicDigits(doneThisWeek)}/${toArabicDigits(target)}`, h.color),
    weekRow,
    el("div.habit-stats", {}, [
      el("span", {}, stats.streak > 0 ? [`🔥 ${toArabicDigits(stats.streak)} يوم متتالي`] : ["ابدأ اليوم"]),
      el("span", {}, [`آخر ٣٠ يوم: ${toArabicDigits(stats.last30)}`]),
    ]),
  ]);
}

/** حلقة SVG لنسبة الإنجاز، مع نص في المنتصف. */
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
  return el("div.habit-ring-wrap", {}, [
    svg,
    el("div.habit-ring-text", {}, [centerText]),
  ]);
}

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

    const targetInput = el("input.field", {
      type: "number", min: "1", max: "7", value: String(habit?.target || 7),
    });

    body.append(
      el("div.form-field", {}, [
        el("span.form-label", {}, ["الرمز"]),
        el("div.emoji-picker-row", {}, [emojiPreview, emojiRow]),
      ]),
      field("الاسم", labelInput),
      el("div.form-field", {}, [el("span.form-label", {}, ["اللون"]), swatches]),
      field("الهدف (أيام/أسبوع)", targetInput),
      el("div.modal-actions", {}, [
        editing &&
          el("button.btn.btn-danger-ghost", {
            onclick: () => {
              if (confirm(`حذف عادة "${habit.label}"؟`)) {
                store.removeHabit(habit.id);
                close();
              }
            },
          }, [icon("trash", 16), "حذف"]),
        el("span.spacer"),
        el("button.btn.btn-ghost", { onclick: close }, ["إلغاء"]),
        el("button.btn.btn-primary", {
          onclick: () => {
            const label = labelInput.value.trim();
            if (!label) { labelInput.focus(); return; }
            const target = Math.min(7, Math.max(1, Number(targetInput.value) || 7));
            if (editing) store.updateHabit(habit.id, { label, color, target, icon: emoji });
            else store.addHabit({ label, color, target, icon: emoji });
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
