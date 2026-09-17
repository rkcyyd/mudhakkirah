/**
 * views/habits.js — عادات شخصية بسيطة (لا تظهر في التقويم) مع تتبّع يومي وسلسلة إنجاز
 */
import { store, habitStats } from "../store.js";
import { el, clear, icon, openModal } from "../dom.js";
import { toISODate, toArabicDigits, weekdayName } from "../dates.js";

const PALETTE = [
  "#2da44e", "#1f6feb", "#d29922", "#cf222e", "#8250df",
  "#0969da", "#bc4c00", "#6639ba", "#218bff", "#e3b341",
];
const DAYS_SHOWN = 14;

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
      "عادات يومية بسيطة (قراءة، رياضة، حفظ...) — منفصلة تمامًا عن التقويم ولا تظهر فيه. ",
      "اضغط على أي مربّع لتسجيل يوم كمُنجز، وتابع سلسلتك 🔥.",
    ])
  );

  if (!habits.length) {
    wrap.append(el("div.empty.big", {}, ["لا عادات بعد. أضف أول عادة تبيها تتابعها."]));
    return;
  }

  const list = el("div.habit-list");
  for (const h of habits) list.append(habitCard(h));
  wrap.append(list);
}

function habitCard(h) {
  const todayISO = toISODate(new Date());
  const stats = habitStats(h, todayISO);

  const days = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ iso: toISODate(d), date: d });
  }

  return el("div.habit-card", { style: `--c:${h.color}` }, [
    el("div.habit-top", {}, [
      el("div.habit-name", {}, [
        el("span.habit-dot"),
        h.label,
      ]),
      el("div.habit-streak", {}, [
        stats.streak > 0 ? `🔥 ${toArabicDigits(stats.streak)}` : el("span.muted.sm", {}, ["ابدأ اليوم"]),
      ]),
      el("div.habit-actions", {}, [
        el("button.icon-btn.sm", { onclick: () => openHabitForm(h), "aria-label": "تعديل" }, [icon("edit", 14)]),
        el("button.icon-btn.sm", {
          onclick: () => {
            if (confirm(`حذف عادة "${h.label}"؟`)) store.removeHabit(h.id);
          },
          "aria-label": "حذف",
        }, [icon("trash", 14)]),
      ]),
    ]),
    el("div.habit-grid", {},
      days.map(({ iso, date }) =>
        el("button.habit-day" + (h.log[iso] ? ".done" : ""), {
          title: `${weekdayName(date)} ${toArabicDigits(date.getDate())}`,
          onclick: () => store.toggleHabitDay(h.id, iso),
        })
      )
    ),
    el("div.habit-stats", {}, [
      el("span", {}, [`هذا الأسبوع: ${toArabicDigits(stats.last7)}/٧`]),
      el("span", {}, [`آخر ٣٠ يوم: ${toArabicDigits(stats.last30)}/٣٠`]),
      h.target ? el("span", {}, [`الهدف: ${toArabicDigits(h.target)} أيام/أسبوع`]) : null,
    ]),
  ]);
}

function openHabitForm(habit) {
  const editing = !!habit;
  openModal(editing ? "تعديل عادة" : "عادة جديدة", (body, close) => {
    const labelInput = el("input.field", {
      type: "text", placeholder: "اسم العادة (مثلاً: قراءة ٢٠ دقيقة)", value: habit?.label || "",
    });

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
            if (editing) store.updateHabit(habit.id, { label, color, target });
            else store.addHabit({ label, color, target });
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
