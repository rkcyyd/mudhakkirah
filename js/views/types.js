/**
 * views/types.js — إدارة أنواع المهام (إضافة/تعديل/حذف/لون/إظهار في التقويم)
 */
import { store } from "../store.js";
import { el, clear, openModal } from "../dom.js";
import { toArabicDigits } from "../dates.js";

const CATEGORIES = {
  homework: "واجب",
  exam: "اختبار",
  personal: "شخصي",
  custom: "مخصّص",
};
const EXAM_KINDS = { mid: "ميد", quiz: "كويز", final: "فاينل" };

const PALETTE = [
  "#1f6feb", "#2da44e", "#d29922", "#cf222e", "#8250df",
  "#0969da", "#1a7f37", "#bc4c00", "#a40e26", "#6639ba",
  "#57606a", "#218bff", "#3fb950", "#e3b341", "#ff7b72",
];

export function renderTypes(root) {
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
  const tasks = store.getTasks();

  wrap.append(
    el("div.page-head", {}, [
      el("h2", {}, ["أنواع المهام"]),
      el("button.btn.btn-primary", { onclick: () => openTypeForm() }, ["＋ نوع جديد"]),
    ]),
    el("p.hint", {}, [
      "لكل نوع لون يميّزه في التقويم. الاختبارات لها ثلاثة أشكال: ميد، كويز، فاينل. ",
      "الأنواع الأساسية لا يمكن حذفها لكن يمكن تعديل اسمها ولونها.",
    ])
  );

  const grid = el("div.type-grid");
  for (const t of types) {
    const count = tasks.filter((x) => x.typeId === t.id).length;
    grid.append(
      el("div.type-card", { style: `--c:${t.color}` }, [
        el("div.type-top", {}, [
          el("span.type-swatch"),
          el("div.type-name", {}, [t.label]),
        ]),
        el("div.type-tags", {}, [
          el("span.tag", {}, [CATEGORIES[t.category] || t.category]),
          t.examKind && el("span.tag", {}, [EXAM_KINDS[t.examKind] || t.examKind]),
          t.system && el("span.tag.muted", {}, ["أساسي"]),
          el("span.tag" + (t.showOnCalendar ? ".ok" : ".off"), {}, [
            t.showOnCalendar ? "يظهر في التقويم" : "مخفي من التقويم",
          ]),
        ]),
        el("div.type-foot", {}, [
          el("span.muted.sm", {}, [toArabicDigits(count) + " مهمة"]),
          el("span.spacer"),
          el("button.btn.btn-ghost.btn-sm", { onclick: () => openTypeForm(t) }, ["تعديل"]),
          !t.system &&
            el("button.btn.btn-danger-ghost.btn-sm", {
              onclick: () => {
                if (confirm(`حذف النوع "${t.label}"؟ ستبقى مهامه بلا نوع.`)) {
                  store.removeType(t.id);
                }
              },
            }, ["حذف"]),
        ]),
      ])
    );
  }
  wrap.append(grid);
}

function openTypeForm(type) {
  const editing = !!type;
  openModal(editing ? "تعديل نوع" : "نوع جديد", (body, close) => {
    const labelInput = el("input.field", {
      type: "text", placeholder: "اسم النوع", value: type?.label || "",
    });

    const catSelect = el("select.field", {},
      Object.entries(CATEGORIES).map(([k, v]) =>
        el("option", { value: k, selected: (type?.category || "custom") === k }, [v])
      )
    );

    const examWrap = el("label.form-field");
    const examSelect = el("select.field", {},
      Object.entries(EXAM_KINDS).map(([k, v]) =>
        el("option", { value: k, selected: type?.examKind === k }, [v])
      )
    );
    examWrap.append(el("span.form-label", {}, ["نوع الاختبار"]), examSelect);
    const syncExam = () => { examWrap.style.display = catSelect.value === "exam" ? "" : "none"; };
    catSelect.addEventListener("change", syncExam);
    syncExam();

    let color = type?.color || PALETTE[0];
    const swatches = el("div.swatches", {},
      PALETTE.map((c) =>
        el("button.swatch" + (c === color ? ".sel" : ""), {
          style: `background:${c}`,
          onclick: (e) => {
            color = c;
            swatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
            e.currentTarget.classList.add("sel");
            customColor.value = c;
          },
        })
      )
    );
    const customColor = el("input", { type: "color", value: color, class: "field color-field" });
    customColor.addEventListener("input", () => {
      color = customColor.value;
      swatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
    });

    const showToggle = el("input", {
      type: "checkbox",
      checked: type ? type.showOnCalendar !== false : true,
    });

    body.append(
      field("الاسم", labelInput),
      field("التصنيف", catSelect),
      examWrap,
      el("div.form-field", {}, [
        el("span.form-label", {}, ["اللون"]),
        swatches,
        el("div.color-row", {}, [customColor, el("span.muted.sm", {}, ["أو اختر لونًا مخصّصًا"])]),
      ]),
      el("label.form-check", {}, [showToggle, el("span", {}, ["إظهار هذا النوع في التقويم"])]),
      el("div.modal-actions", {}, [
        el("span.spacer"),
        el("button.btn.btn-ghost", { onclick: close }, ["إلغاء"]),
        el("button.btn.btn-primary", {
          onclick: () => {
            const label = labelInput.value.trim();
            if (!label) { labelInput.focus(); return; }
            const patch = {
              label,
              category: catSelect.value,
              color,
              showOnCalendar: showToggle.checked,
            };
            if (catSelect.value === "exam") patch.examKind = examSelect.value;
            if (editing) store.updateType(type.id, patch);
            else store.addType(patch);
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
