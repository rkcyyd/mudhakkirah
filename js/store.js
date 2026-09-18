/**
 * store.js — طبقة البيانات
 * ------------------------------------------------------------------
 * كل قراءة/كتابة للبيانات تمر من هنا. حاليًا التخزين محلي (localStorage).
 * عند إضافة مزامنة سحابية لاحقًا (مثل Supabase) نغيّر الدوال في قسم
 * "adapter" فقط، دون لمس بقية التطبيق.
 */

const STORAGE_KEY = "mudhakkirah:v1";

// الحقول الوحيدة من الإعدادات التي تُزامَن بين الأجهزة (البقية خاصة بهذا الجهاز: الثيم، القفل، الإذن...)
const SYNCABLE_SETTINGS = ["hidePersonalFromCalendar", "showExamCountdown", "weekStart", "primaryCalendar"];

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
    tasks: [], // { id, title, typeId, date, time, note, done, createdAt, updatedAt, reminders:[], remindersFired:{} }
    habits: [], // { id, label, color, createdAt, updatedAt, archived, log:{ "YYYY-MM-DD": true } }
    notes: "", // مساحة الملاحظات الشخصية (نص حر)
    notesUpdatedAt: 0,
    // شواهد حذف (تُستخدم فقط عند تفعيل المزامنة بين الأجهزة، لضمان عدم "عودة" عنصر محذوف)
    tombstones: { tasks: {}, habits: {}, types: {} },
    settingsUpdatedAt: 0, // للحقول القابلة للمزامنة أدناه فقط
    settings: {
      hidePersonalFromCalendar: true, // زر إخفاء المهام الشخصية من التقويم
      theme: "light", // light | dark
      weekStart: 0, // 0 = الأحد
      showExamCountdown: true, // عدّاد تنازلي لأقرب اختبار
      primaryCalendar: "hijri", // hijri | gregorian — أي تاريخ يظهر أبرز (أكبر) في التقويم
      notificationsEnabled: false, // تنبيهات المهام
      appLockEnabled: false, // قفل بالرمز
      appLockHash: null, // بصمة SHA-256 للرمز (لا يُحفظ الرمز نفسه)
      syncEnabled: false, // مزامنة بين الأجهزة
      syncKey: null, // رمز المزامنة (يبقى محليًا فقط، يُرسَل مُجزّأً SHA-256 للخادم)
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
  merged.habits = Array.isArray(merged.habits) ? merged.habits : [];
  merged.tombstones = {
    tasks: { ...(saved.tombstones?.tasks || {}) },
    habits: { ...(saved.tombstones?.habits || {}) },
    types: { ...(saved.tombstones?.types || {}) },
  };
  merged.notesUpdatedAt = saved.notesUpdatedAt || 0;
  merged.settingsUpdatedAt = saved.settingsUpdatedAt || 0;
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
      updatedAt: Date.now(),
    };
    if (examKind) type.examKind = examKind;
    state.types = [...state.types, type];
    emit();
    return type;
  },
  updateType(id, patch) {
    state.types = state.types.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
    );
    emit();
  },
  removeType(id) {
    const t = store.getType(id);
    if (!t || t.system) return false;
    state.types = state.types.filter((x) => x.id !== id);
    state.tombstones.types[id] = Date.now();
    // المهام المرتبطة تُحوّل إلى "بدون نوع"
    state.tasks = state.tasks.map((task) =>
      task.typeId === id ? { ...task, typeId: null, updatedAt: Date.now() } : task
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
  addTask({ title, typeId, date, time = "", note = "", reminders = [] }) {
    const task = {
      id: uid(),
      title: title?.trim() || "بدون عنوان",
      typeId: typeId || null,
      date, // YYYY-MM-DD
      time,
      note,
      done: false,
      reminders, // [{ id, amount, unit:'minutes'|'hours'|'days', repeatEvery:null|{amount,unit} }]
      remindersFired: {},
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
    };
    state.tasks = [...state.tasks, task];
    emit();
    return task;
  },
  updateTask(id, patch) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
    );
    emit();
  },
  /** لتغيير تاريخ مهمة (السحب في التقويم) — يمسح سجلّ التنبيهات المُطلقة لهذا التاريخ. */
  moveTask(id, newDate) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, date: newDate, remindersFired: {}, updatedAt: Date.now() } : t
    );
    emit();
  },
  toggleTask(id) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, done: !t.done, updatedAt: Date.now() } : t
    );
    emit();
  },
  removeTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    state.tombstones.tasks[id] = Date.now();
    emit();
  },
  /** يسجّل أن قاعدة تنبيه معيّنة أُطلقت (لمنع التكرار)، مع طابع زمني لدعم "التكرار". */
  markReminderFired(taskId, ruleId, atISO) {
    state.tasks = state.tasks.map((t) =>
      t.id === taskId
        ? { ...t, remindersFired: { ...(t.remindersFired || {}), [ruleId]: atISO } }
        : t
    );
    emit();
  },

  /* -------------------- العادات -------------------- */
  getHabits() {
    return state.habits;
  },
  getHabit(id) {
    return state.habits.find((h) => h.id === id) || null;
  },
  addHabit({ label, color = "#2da44e", target = 7 }) {
    const habit = {
      id: uid(),
      label: label?.trim() || "عادة جديدة",
      color,
      target, // عدد الأيام المستهدف أسبوعيًا (1-7)
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      log: {},
    };
    state.habits = [...state.habits, habit];
    emit();
    return habit;
  },
  updateHabit(id, patch) {
    state.habits = state.habits.map((h) => (h.id === id ? { ...h, ...patch, updatedAt: Date.now() } : h));
    emit();
  },
  removeHabit(id) {
    state.habits = state.habits.filter((h) => h.id !== id);
    state.tombstones.habits[id] = Date.now();
    emit();
  },
  toggleHabitDay(id, dateISO) {
    state.habits = state.habits.map((h) => {
      if (h.id !== id) return h;
      const log = { ...h.log };
      if (log[dateISO]) delete log[dateISO];
      else log[dateISO] = true;
      return { ...h, log, updatedAt: Date.now() };
    });
    emit();
  },

  /* -------------------- الملاحظات -------------------- */
  getNotes() {
    return state.notes;
  },
  setNotes(text) {
    state.notes = text;
    state.notesUpdatedAt = Date.now();
    emit();
  },

  /* -------------------- الإعدادات -------------------- */
  getSettings() {
    return state.settings;
  },
  updateSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    if (SYNCABLE_SETTINGS.some((k) => k in patch)) state.settingsUpdatedAt = Date.now();
    emit();
  },

  /* -------------------- المزامنة بين الأجهزة -------------------- */

  /** لقطة من كل البيانات القابلة للمزامنة (بدون إعدادات خاصة بالجهاز). */
  getSyncSnapshot() {
    return {
      types: state.types,
      tasks: state.tasks,
      habits: state.habits,
      notes: state.notes,
      notesUpdatedAt: state.notesUpdatedAt,
      tombstones: state.tombstones,
      settingsUpdatedAt: state.settingsUpdatedAt,
      settingsSubset: Object.fromEntries(SYNCABLE_SETTINGS.map((k) => [k, state.settings[k]])),
    };
  },

  /**
   * يدمج لقطة واردة من جهاز آخر مع الحالة المحلية: لكل سجلّ (نوع/مهمة/عادة)
   * يفوز الأحدث updatedAt، وشواهد الحذف (tombstones) تُقصي أي سجلّ أقدم منها.
   * يُرجع true إن تغيّر شيء فعليًا محليًا (يستحق حفظًا وإرسالًا للخادم مجددًا).
   */
  mergeRemoteSnapshot(remote) {
    if (!remote) return false;
    let changed = false;

    // دمج شواهد الحذف أولًا (اتحاد، الأحدث يبقى إن تكرّر المعرّف)
    for (const kind of ["tasks", "habits", "types"]) {
      const remoteTomb = remote.tombstones?.[kind] || {};
      for (const [id, at] of Object.entries(remoteTomb)) {
        if (!state.tombstones[kind][id] || at > state.tombstones[kind][id]) {
          state.tombstones[kind][id] = at;
          changed = true;
        }
      }
    }

    const mergeList = (localList, remoteList, kind) => {
      const byId = new Map(localList.map((x) => [x.id, x]));
      for (const r of remoteList || []) {
        const tombAt = state.tombstones[kind][r.id];
        if (tombAt && tombAt >= (r.updatedAt || 0)) continue; // محذوف بعده — يُتجاهَل
        const l = byId.get(r.id);
        if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) {
          byId.set(r.id, r);
          changed = true;
        }
      }
      // أزل أي عنصر محلي أصبح له شاهد حذف أحدث منه (حُذف من جهاز آخر)
      for (const [id, item] of [...byId]) {
        const tombAt = state.tombstones[kind][id];
        if (tombAt && tombAt >= (item.updatedAt || 0)) {
          byId.delete(id);
          changed = true;
        }
      }
      return [...byId.values()];
    };

    state.types = mergeList(state.types, remote.types, "types");
    state.tasks = mergeList(state.tasks, remote.tasks, "tasks");
    state.habits = mergeList(state.habits, remote.habits, "habits");

    if ((remote.notesUpdatedAt || 0) > (state.notesUpdatedAt || 0)) {
      state.notes = remote.notes || "";
      state.notesUpdatedAt = remote.notesUpdatedAt;
      changed = true;
    }
    if ((remote.settingsUpdatedAt || 0) > (state.settingsUpdatedAt || 0) && remote.settingsSubset) {
      state.settings = { ...state.settings, ...remote.settingsSubset };
      state.settingsUpdatedAt = remote.settingsUpdatedAt;
      changed = true;
    }

    // ضمان بقاء الأنواع الأساسية دائمًا
    const ids = new Set(state.types.map((t) => t.id));
    for (const dt of defaultTypes()) {
      if (!ids.has(dt.id) && !state.tombstones.types[dt.id]) state.types.push(dt);
    }

    if (changed) emit();
    return changed;
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

/** إحصاءات عادة: السلسلة الحالية (streak) وعدد أيام آخر ٧/٣٠ يومًا. */
export function habitStats(habit, todayISO) {
  const today = todayISO || new Date().toISOString().slice(0, 10);
  const dayMs = 86400000;
  const toISO = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  let streak = 0;
  let cursor = new Date(today + "T00:00:00");
  // إذا لم يُنجَز اليوم بعد، نبدأ العدّ من الأمس حتى لا تنكسر السلسلة قبل نهاية اليوم
  if (!habit.log[toISO(cursor)]) cursor = new Date(cursor.getTime() - dayMs);
  while (habit.log[toISO(cursor)]) {
    streak++;
    cursor = new Date(cursor.getTime() - dayMs);
  }

  let last7 = 0, last30 = 0;
  cursor = new Date(today + "T00:00:00");
  for (let i = 0; i < 30; i++) {
    const iso = toISO(new Date(cursor.getTime() - i * dayMs));
    if (habit.log[iso]) {
      last30++;
      if (i < 7) last7++;
    }
  }
  return { streak, last7, last30 };
}
