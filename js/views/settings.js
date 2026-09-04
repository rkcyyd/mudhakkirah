/**
 * views/settings.js — الإعدادات + استيراد/تصدير البيانات
 */
import { store } from "../store.js";
import { el, clear } from "../dom.js";
import { toISODate } from "../dates.js";

export function renderSettings(root) {
  const wrap = el("div.page");
  root.append(wrap);
  const draw = () => paint(wrap);
  const unsub = store.subscribe(draw);
  draw();
  return unsub;
}

function paint(wrap) {
  clear(wrap);
  const s = store.getSettings();

  wrap.append(el("div.page-head", {}, [el("h2", {}, ["الإعدادات"])]));

  /* ------- عرض ------- */
  wrap.append(
    card("العرض", [
      toggleRow("الوضع الليلي", s.theme === "dark", (v) =>
        store.updateSettings({ theme: v ? "dark" : "light" })
      ),
      toggleRow(
        "إخفاء المهام الشخصية من التقويم",
        s.hidePersonalFromCalendar,
        (v) => store.updateSettings({ hidePersonalFromCalendar: v })
      ),
      toggleRow(
        "عدّاد تنازلي لأقرب اختبار",
        s.showExamCountdown !== false,
        (v) => store.updateSettings({ showExamCountdown: v })
      ),
      selectRow("بداية الأسبوع", String(s.weekStart), {
        "0": "الأحد", "1": "الاثنين", "6": "السبت",
      }, (v) => store.updateSettings({ weekStart: Number(v) })),
    ])
  );

  /* ------- البيانات ------- */
  const stats = summary();
  wrap.append(
    card("البيانات", [
      el("div.stat-row", {}, [
        stat(stats.tasks, "مهمة"),
        stat(stats.done, "منجزة"),
        stat(stats.types, "نوع"),
      ]),
      el("p.hint", {}, [
        "البيانات محفوظة محليًا في هذا المتصفح فقط. للنقل إلى جهاز آخر استخدم التصدير ثم الاستيراد. ",
        "المزامنة السحابية التلقائية ميزة قادمة.",
      ]),
      el("div.btn-row", {}, [
        el("button.btn.btn-primary", { onclick: exportData }, ["⬇️ تصدير نسخة (JSON)"]),
        el("button.btn.btn-ghost", { onclick: () => importInput.click() }, ["⬆️ استيراد نسخة"]),
      ]),
      importInput(),
    ])
  );

  /* ------- خطر ------- */
  wrap.append(
    card("منطقة الخطر", [
      el("p.hint", {}, ["يحذف كل المهام والملاحظات ويعيد الأنواع للوضع الافتراضي."]),
      el("button.btn.btn-danger", {
        onclick: () => {
          if (confirm("متأكد؟ سيُحذف كل شيء ولا يمكن التراجع.")) store.resetAll();
        },
      }, ["حذف كل البيانات"]),
    ])
  );

  wrap.append(el("p.version", {}, ["مذكّرتي — نسخة ١.٠"]));
}

/* ----------------- helpers ----------------- */

function summary() {
  const tasks = store.getTasks();
  return {
    tasks: tasks.length,
    done: tasks.filter((t) => t.done).length,
    types: store.getTypes().length,
  };
}

function exportData() {
  const blob = new Blob([store.exportJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mudhakkirah-backup-${toISODate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

let _importInput;
function importInput() {
  if (_importInput) return _importInput;
  _importInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    style: "display:none",
    onchange: (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          store.importJSON(reader.result);
          alert("تم الاستيراد بنجاح.");
        } catch {
          alert("الملف غير صالح.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
  });
  return _importInput;
}

function card(title, children) {
  return el("section.card", {}, [el("h3", {}, [title]), ...children]);
}

function toggleRow(label, checked, onChange) {
  const input = el("input", { type: "checkbox", checked });
  input.addEventListener("change", () => onChange(input.checked));
  return el("label.set-row", {}, [el("span", {}, [label]), el("span.switch", {}, [input, el("span.slider")])]);
}

function selectRow(label, value, options, onChange) {
  const sel = el("select.field.sm", {},
    Object.entries(options).map(([k, v]) => el("option", { value: k, selected: k === value }, [v]))
  );
  sel.addEventListener("change", () => onChange(sel.value));
  return el("label.set-row", {}, [el("span", {}, [label]), sel]);
}

function stat(n, label) {
  return el("div.stat", {}, [el("div.stat-n", {}, [String(n)]), el("div.stat-l", {}, [label])]);
}
