/**
 * store.js — طبقة البيانات
 * ------------------------------------------------------------------
 * كل قراءة/كتابة للبيانات تمر من هنا. حاليًا التخزين محلي (localStorage).
 * عند إضافة مزامنة سحابية لاحقًا (مثل Supabase) نغيّر الدوال في قسم
 * "adapter" فقط، دون لمس بقية التطبيق.
 */

const STORAGE_KEY = "mudhakkirah:v1";

/* ============================ الحالة الافتراضية ============================ */

function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

/**
 * أنواع المهام الافتراضية.
 * category: homework | exam | personal | custom
 * examKind (للاختبارات فقط): mid | quiz | final
 * showOnCalendar: هل يظهر هذا النوع في التقويم
 * system: أنواع أساسية لا يمكن حذفها (لكن يمكن تعديل لونها واسمها)
 */
function defaultTypes() {
  return [
    {
      id: "t_homework",
      label: "واجب",
      category: "homework",
      color: "#1f6feb",
      showOnCalendar: true,
      system: true,
    },
    {
      id: "t_exam_mid",
      label: "اختبار ميد",
      category: "exam",
      examKind: "mid",
      color: "#d29922",
      showOnCalendar: true,
      system: true,
    },
    {
      id: "t_exam_quiz",
      label: "اختبار كويز",
      category: "exam",
      examKind: "quiz",
      color: "#2da44e",
      showOnCalendar: true,
      system: true,
    },
    {
      id: "t_exam_final",
      label: "اختبار فاينل",
      category: "exam",
      examKind: "final",
      color: "#cf222e",
      showOnCalendar: true,
      system: true,
    },
    {
      id: "t_personal",
      label: "شخصي",
      category: "personal",
      color: "#8250df",
      showOnCalendar: false,
      system: true,
    },
  ];
}

function defaultState() {
  return {
    version: 1,
    types: defaultTypes(),
    tasks: [], // { id, title, typeId, date:"YYYY-MM-DD", time:"HH:MM"|"", note, done, createdAt }
    notes: "", // مساحة الملاحظات الشخصية (نص حر)
    settings: {
      hidePersonalFromCalendar: true, // زر إخفاء المهام الشخصية من التقويم
      theme: "light", // light | dark
      weekStart: 0, // 0 = الأحد
      showExamCountdown: true, // عدّاد تنازلي لأقرب اختبار
    },
  };
}

/* ============================ adapter (محلي) ============================ */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.warn("تعذّر قراءة البيانات، سيتم البدء من جديد.", e);
    return defaultState();
  }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("تعذّر حفظ البيانات.", e);
  }
}

/** دمج الحالة المحفوظة مع أي حقول جديدة أُضيفت في نسخ لاحقة. */
function migrate(saved) {
  const base = defaultState();
  const merged = {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
  };
  // ضمان وجود الأنواع الأساسية دائمًا
  const ids = new Set((merged.types || []).map((t) => t.id));
  for (const dt of base.types) {
    if (!ids.has(dt.id)) merged.types.push(dt);
  }
  merged.tasks = Array.isArray(merged.tasks) ? merged.tasks : [];
  return merged;
}

/* ============================ المخزن + الاشتراك ============================ */

let state = load();
const listeners = new Set();

function emit() {
  persist(state);
  for (const fn of listeners) fn(state);
}

export const store = {
  /** الاشتراك في أي تغيير — يعيد دالة لإلغاء الاشتراك. */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getState() {
    return state;
  },

  /* -------------------- الأنواع -------------------- */
  getTypes() {
    return state.types;
  },
  getType(id) {
    return state.types.find((t) => t.id === id) || null;
  },
  addType({ label, category = "custom", color = "#57606a", examKind, showOnCalendar = true }) {
    const type = {
      id: uid(),
      label: label?.trim() || "نوع جديد",
      category,
      color,
      showOnCalendar,
      system: false,
    };
    if (examKind) type.examKind = examKind;
    state.types = [...state.types, type];
    emit();
    return type;
  },
  updateType(id, patch) {
    state.types = state.types.map((t) =>
      t.id === id ? { ...t, ...patch } : t
    );
    emit();
  },
  removeType(id) {
    const t = store.getType(id);
    if (!t || t.system) return false;
    state.types = state.types.filter((x) => x.id !== id);
    // المهام المرتبطة تُحوّل إلى "بدون نوع"
    state.tasks = state.tasks.map((task) =>
      task.typeId === id ? { ...task, typeId: null } : task
    );
    emit();
    return true;
  },

  /* -------------------- المهام -------------------- */
  getTasks() {
    return state.tasks;
  },
  getTasksByDate(dateStr) {
    return state.tasks
      .filter((t) => t.date === dateStr)
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  },
  addTask({ title, typeId, date, time = "", note = "" }) {
    const task = {
      id: uid(),
      title: title?.trim() || "بدون عنوان",
      typeId: typeId || null,
      date, // YYYY-MM-DD
      time,
      note,
      done: false,
      createdAt: new Date().toISOString(),
    };
    state.tasks = [...state.tasks, task];
    emit();
    return task;
  },
  updateTask(id, patch) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, ...patch } : t
    );
    emit();
  },
  toggleTask(id) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, done: !t.done } : t
    );
    emit();
  },
  removeTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    emit();
  },

  /* -------------------- الملاحظات -------------------- */
  getNotes() {
    return state.notes;
  },
  setNotes(text) {
    state.notes = text;
    emit();
  },

  /* -------------------- الإعدادات -------------------- */
  getSettings() {
    return state.settings;
  },
  updateSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    emit();
  },

  /* -------------------- استيراد / تصدير -------------------- */
  exportJSON() {
    return JSON.stringify(state, null, 2);
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    state = migrate(parsed);
    emit();
  },
  resetAll() {
    state = defaultState();
    emit();
  },
};

/**
 * هل يجب إظهار هذا النوع في التقويم؟
 * يجمع بين إعداد النوع وزر "إخفاء المهام الشخصية".
 */
export function typeVisibleOnCalendar(type, settings) {
  if (!type) return true;
  if (type.category === "personal" && settings.hidePersonalFromCalendar) return false;
  return type.showOnCalendar !== false;
}

/**
 * أقرب اختبار قادم (اليوم أو بعده) غير منجز.
 * @returns {{task, type, daysLeft}|null}
 */
export function nextExam(todayISO) {
  const today = todayISO || new Date().toISOString().slice(0, 10);
  const upcoming = store
    .getTasks()
    .filter((t) => !t.done && t.date >= today)
    .map((t) => ({ t, type: store.getType(t.typeId) }))
    .filter((x) => x.type && x.type.category === "exam")
    .sort((a, b) => (a.t.date + (a.t.time || "")).localeCompare(b.t.date + (b.t.time || "")));

  if (!upcoming.length) return null;
  const { t, type } = upcoming[0];
  const msPerDay = 86400000;
  const d0 = new Date(today + "T00:00:00");
  const d1 = new Date(t.date + "T00:00:00");
  const daysLeft = Math.round((d1 - d0) / msPerDay);
  return { task: t, type, daysLeft };
}
