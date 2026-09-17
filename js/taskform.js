/**
 * taskform.js — نموذج إضافة/تعديل مهمة (يُستخدم في التقويم وصفحة المهام)
 */
import { store } from "./store.js";
import { el, icon, openModal } from "./dom.js";
import { toISODate } from "./dates.js";

const UNIT_LABEL = { minutes: "دقيقة", hours: "ساعة", days: "يوم" };
let ruleSeq = 0;
const ruleId = () => `r${Date.now().toString(36)}${ruleSeq++}`;

/**
 * @param {object} opts
 * @param {string} [opts.date]  تاريخ افتراضي "YYYY-MM-DD"
 * @param {object} [opts.task]  مهمة موجودة للتعديل
 * @param {Function} [opts.onSaved]
 */
export function openTaskForm({ date, task, onSaved } = {}) {
  const editing = !!task;
  const types = store.getTypes();
  const defaultDate = date || task?.date || toISODate(new Date());

  openModal(editing ? "تعديل مهمة" : "مهمة جديدة", (body, close) => {
    const titleInput = el("input.field", {
      type: "text",
      placeholder: "عنوان المهمة",
      value: task?.title || "",
    });

    const typeSelect = el("select.field", {},
      types.map((t) =>
        el("option", { value: t.id, selected: task?.typeId === t.id }, [t.label])
      )
    );
    if (!editing) typeSelect.value = types[0]?.id || "";

    const dateInput = el("input.field", { type: "date", value: defaultDate });
    const timeInput = el("input.field", { type: "time", value: task?.time || "" });
    const noteInput = el("textarea.field", { rows: 3, placeholder: "تفاصيل إضافية (اختياري)" });
    noteInput.value = task?.note || "";

    const reminders = (task?.reminders || []).map((r) => ({ ...r }));
    const remindersBox = el("div.reminders-box");
    const renderReminders = () => paintReminders(remindersBox, reminders, renderReminders);
    renderReminders();

    const err = el("div.form-err");

    const save = () => {
      const title = titleInput.value.trim();
      if (!title) {
        err.textContent = "اكتب عنوان المهمة.";
        titleInput.focus();
        return;
      }
      const payload = {
        title,
        typeId: typeSelect.value || null,
        date: dateInput.value,
        time: timeInput.value,
        note: noteInput.value.trim(),
        reminders,
      };
      if (editing) store.updateTask(task.id, payload);
      else store.addTask(payload);
      close();
      onSaved?.();
    };

    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });

    body.append(
      field("العنوان", titleInput),
      field("النوع", typeSelect),
      el("div.form-row", {}, [
        field("التاريخ", dateInput),
        field("الوقت", timeInput),
      ]),
      field("ملاحظة", noteInput),
      el("div.form-field", {}, [
        el("span.form-label", {}, ["التذكيرات"]),
        remindersBox,
      ]),
      err,
      el("div.modal-actions", {}, [
        editing &&
          el("button.btn.btn-danger-ghost", {
            onclick: () => {
              if (confirm("حذف هذه المهمة؟")) {
                store.removeTask(task.id);
                close();
                onSaved?.();
              }
            },
          }, [icon("trash", 16), "حذف"]),
        el("span.spacer"),
        el("button.btn.btn-ghost", { onclick: close }, ["إلغاء"]),
        el("button.btn.btn-primary", { onclick: save }, [editing ? "حفظ" : "إضافة"]),
      ])
    );
  });
}

function field(label, input) {
  return el("label.form-field", {}, [el("span.form-label", {}, [label]), input]);
}

function ruleText(rule) {
  const base = `قبلها بـ ${rule.amount} ${UNIT_LABEL[rule.unit]}`;
  if (!rule.repeatEvery) return base;
  return `${base} (يتكرّر كل ${rule.repeatEvery.amount} ${UNIT_LABEL[rule.repeatEvery.unit]})`;
}

function paintReminders(box, reminders, rerender) {
  box.innerHTML = "";

  if (reminders.length) {
    box.append(
      el("div.reminder-chips", {},
        reminders.map((r) =>
          el("span.rchip", {}, [
            icon("bell", 13),
            ruleText(r),
            el("button.rchip-x", {
              onclick: () => {
                const i = reminders.indexOf(r);
                if (i > -1) reminders.splice(i, 1);
                rerender();
              },
              "aria-label": "إزالة",
            }, [icon("close", 11)]),
          ])
        )
      )
    );
  }

  /* اختصارات سريعة */
  box.append(
    el("div.reminder-presets", {}, [
      presetBtn("قبل ساعة", { amount: 1, unit: "hours" }, reminders, rerender),
      presetBtn("قبل ٣ ساعات", { amount: 3, unit: "hours" }, reminders, rerender),
      presetBtn("قبل يوم", { amount: 1, unit: "days" }, reminders, rerender),
      presetBtn("قبل يومين", { amount: 2, unit: "days" }, reminders, rerender),
    ])
  );

  /* بناء تذكير مخصّص */
  const amountInput = el("input.field.sm", { type: "number", min: "1", value: "2" });
  const unitSelect = el("select.field.sm", {}, [
    el("option", { value: "hours", selected: true }, ["ساعة"]),
    el("option", { value: "minutes" }, ["دقيقة"]),
    el("option", { value: "days" }, ["يوم"]),
  ]);
  const repeatCheck = el("input", { type: "checkbox" });
  const repeatAmount = el("input.field.sm", { type: "number", min: "1", value: "1", disabled: true });
  const repeatUnit = el("select.field.sm", { disabled: true }, [
    el("option", { value: "hours", selected: true }, ["ساعة"]),
    el("option", { value: "minutes" }, ["دقيقة"]),
    el("option", { value: "days" }, ["يوم"]),
  ]);
  repeatCheck.addEventListener("change", () => {
    repeatAmount.disabled = !repeatCheck.checked;
    repeatUnit.disabled = !repeatCheck.checked;
  });

  box.append(
    el("div.reminder-builder", {}, [
      el("div.reminder-row", {}, ["قبلها بـ", amountInput, unitSelect]),
      el("label.reminder-row.reminder-repeat", {}, [
        repeatCheck, "كرّر كل", repeatAmount, repeatUnit, "حتى الموعد",
      ]),
      el("button.btn.btn-ghost.btn-sm", {
        onclick: () => {
          const amount = Math.max(1, Number(amountInput.value) || 1);
          reminders.push({
            id: ruleId(),
            amount,
            unit: unitSelect.value,
            repeatEvery: repeatCheck.checked
              ? { amount: Math.max(1, Number(repeatAmount.value) || 1), unit: repeatUnit.value }
              : null,
          });
          rerender();
        },
      }, [icon("plus", 14), "إضافة تذكير"]),
    ])
  );
}

function presetBtn(label, { amount, unit }, reminders, rerender) {
  return el("button.btn.btn-ghost.btn-sm", {
    onclick: () => {
      reminders.push({
        id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        amount, unit, repeatEvery: null,
      });
      rerender();
    },
  }, [icon("clock", 13), label]);
}
