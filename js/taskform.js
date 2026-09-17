/**
 * taskform.js — نموذج إضافة/تعديل مهمة (يُستخدم في التقويم وصفحة المهام)
 */
import { store } from "./store.js";
import { el, icon, openModal } from "./dom.js";
import { toISODate } from "./dates.js";

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
