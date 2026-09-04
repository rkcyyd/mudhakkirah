/**
 * views/notes.js — مساحة الملاحظات الشخصية (حفظ تلقائي)
 */
import { store } from "../store.js";
import { el } from "../dom.js";

export function renderNotes(root) {
  const wrap = el("div.page");
  const status = el("span.muted.sm", {}, ["محفوظ"]);

  const area = el("textarea.notes-area", {
    placeholder: "اكتب ملاحظاتك الشخصية هنا… (قراءة كتب، أفكار، قوائم…)\nتُحفظ تلقائيًا.",
    value: store.getNotes(),
    spellcheck: false,
  });

  let timer = null;
  area.addEventListener("input", () => {
    status.textContent = "يحفظ…";
    clearTimeout(timer);
    timer = setTimeout(() => {
      store.setNotes(area.value);
      status.textContent = "محفوظ ✓";
    }, 400);
  });

  wrap.append(
    el("div.page-head", {}, [el("h2", {}, ["ملاحظات شخصية"]), status]),
    el("p.hint", {}, ["مساحة حرة لا تظهر في التقويم. لإدارة مهام شخصية بتاريخ، استخدم نوع «شخصي» في صفحة المهام."]),
    area
  );

  root.append(wrap);

  return () => {
    clearTimeout(timer);
    if (area.value !== store.getNotes()) store.setNotes(area.value);
  };
}
