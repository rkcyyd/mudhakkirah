/**
 * views/settings.js — الإعدادات + استيراد/تصدير البيانات
 */
import { store } from "../store.js";
import { el, clear, icon, openModal } from "../dom.js";
import { toISODate } from "../dates.js";
import { requestPermission, permissionState } from "../notifications.js";
import { sha256Hex } from "../lock.js";
import { syncPush, unsyncPush, sendTestPush } from "../push-sync.js";
import { startNewSync, linkWithKey, stopSync, pushNow, getLocalSyncKey } from "../sync.js";

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

  /* ------- التنبيهات ------- */
  const perm = permissionState();
  const pushBox = el("div.push-status");
  wrap.append(
    card("التنبيهات", [
      toggleRow(
        "تفعيل تنبيهات المهام",
        s.notificationsEnabled && perm === "granted",
        async (v) => {
          if (v) {
            const ok = await requestPermission();
            store.updateSettings({ notificationsEnabled: ok });
            if (!ok) {
              alert("رفض المتصفح إذن الإشعارات. فعّلها من إعدادات الموقع بالمتصفح ثم أعد المحاولة.");
              return;
            }
            paintPushStatus(pushBox, "جارٍ الربط بخدمة التنبيهات...");
            const r = await syncPush();
            paintPushStatus(pushBox, r.ok ? "متصل — التنبيهات تعمل حتى مع إغلاق التطبيق ✓" : "تعذّر الاتصال بخدمة التنبيهات، سيُعاد المحاولة تلقائيًا.");
          } else {
            store.updateSettings({ notificationsEnabled: false });
            await unsyncPush();
            clear(pushBox);
          }
        }
      ),
      perm === "denied" &&
        el("p.hint", {}, ["الإذن مرفوض من المتصفح حاليًا. لتفعيله: إعدادات الموقع ← الإشعارات ← السماح."]),
      el("p.hint", {}, [
        "تُضبط تنبيهات كل مهمة من نموذج المهمة نفسها (قبلها بكذا، أو متكررة). ",
        "التنبيهات هنا مزدوجة: محلية فورية ما دام التطبيق/الويدجت مفتوحًا، ",
        "وأخرى عبر خدمة خلفية تصل حتى مع إغلاق التطبيق بالكامل.",
      ]),
      s.notificationsEnabled && perm === "granted"
        ? el("div.btn-row", {}, [
            el("button.btn.btn-ghost.btn-sm", {
              onclick: async () => {
                paintPushStatus(pushBox, "يُرسِل تنبيهًا تجريبيًا...");
                const ok = await sendTestPush();
                paintPushStatus(pushBox, ok ? "أُرسل — يفترض يوصلك خلال لحظات." : "تعذّر الإرسال.");
              },
            }, [icon("bell", 14), "اختبار الآن"]),
          ])
        : null,
      pushBox,
    ])
  );
  if (s.notificationsEnabled && perm === "granted") {
    paintPushStatus(pushBox, "متصل بخدمة التنبيهات الخلفية ✓");
  }

  /* ------- المزامنة بين الأجهزة ------- */
  const syncBox = el("div.sync-status");
  wrap.append(
    card("المزامنة بين الأجهزة", [
      el("p.hint", {}, [
        "اربط جوالك ولابتوبك برمز واحد فتظهر أي مهمة تسجّلها على أي جهاز في البقية تلقائيًا. ",
        "الخادم لا يرى الرمز نفسه أبدًا، فقط بصمته — بدونه لا يقدر أي أحد الوصول لبياناتك.",
      ]),
      s.syncEnabled ? syncEnabledView(syncBox) : syncSetupView(syncBox),
      syncBox,
    ])
  );

  /* ------- الخصوصية ------- */
  wrap.append(
    card("الخصوصية والأمان", [
      el("p.hint", {}, [
        "بياناتك (مهامك وملاحظاتك) محفوظة في متصفح هذا الجهاز فقط، ولا يراها أي زائر آخر لهذا الرابط — ",
        "زائر آخر يفتح نفس الرابط يرى تطبيقًا فارغًا، لا بياناتك.",
      ]),
      s.appLockEnabled
        ? el("div.btn-row", {}, [
            el("span.tag.ok", {}, [icon("lock", 13), " قفل بالرمز مُفعّل"]),
            el("button.btn.btn-ghost.btn-sm", { onclick: () => openLockForm(true) }, ["تغيير الرمز"]),
            el("button.btn.btn-danger-ghost.btn-sm", {
              onclick: () => {
                if (confirm("إيقاف قفل التطبيق؟")) store.updateSettings({ appLockEnabled: false, appLockHash: null });
              },
            }, ["إيقاف القفل"]),
          ])
        : el("div.btn-row", {}, [
            el("button.btn.btn-primary", { onclick: () => openLockForm(false) }, [icon("lock", 16), "تفعيل قفل بالرمز"]),
          ]),
      el("p.hint", {}, [
        "قفل بسيط برمز من ٤-٦ أرقام يمنع أي شخص آخر يمسك جهازك من فتح التطبيق مباشرة. ",
        "لا يُحفظ الرمز نفسه، فقط بصمته.",
      ]),
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
        "للمزامنة التلقائية المستمرة بين أجهزتك استخدم بطاقة «المزامنة بين الأجهزة» أعلاه. ",
        "التصدير/الاستيراد هنا مفيد لنسخة احتياطية لمرة واحدة.",
      ]),
      el("div.btn-row", {}, [
        el("button.btn.btn-primary", { onclick: exportData }, [icon("download", 16), "تصدير نسخة (JSON)"]),
        el("button.btn.btn-ghost", { onclick: () => importInput.click() }, [icon("upload", 16), "استيراد نسخة"]),
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
      }, [icon("trash", 16), "حذف كل البيانات"]),
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

function paintPushStatus(box, text) {
  clear(box);
  box.append(el("p.hint.push-hint", {}, [text]));
}

function syncSetupView(statusBox) {
  return el("div.btn-row", {}, [
    el("button.btn.btn-primary", {
      onclick: async () => {
        paintPushStatus(statusBox, "جارٍ الإعداد...");
        const key = await startNewSync();
        showSyncKeyModal(key, true);
      },
    }, [icon("target", 16), "بدء مزامنة جديدة"]),
    el("button.btn.btn-ghost", { onclick: () => openLinkForm(statusBox) }, ["لدي رمز من جهاز آخر"]),
  ]);
}

function syncEnabledView(statusBox) {
  const key = getLocalSyncKey();
  return el("div.sync-enabled", {}, [
    el("div.btn-row", {}, [
      el("span.tag.ok", {}, [icon("target", 13), " المزامنة مُفعّلة"]),
      el("button.btn.btn-ghost.btn-sm", { onclick: () => showSyncKeyModal(key, false) }, ["عرض رمز الربط"]),
      el("button.btn.btn-ghost.btn-sm", {
        onclick: async () => {
          paintPushStatus(statusBox, "جارٍ المزامنة...");
          const r = await pushNow();
          paintPushStatus(statusBox, r.ok ? "تمت المزامنة الآن ✓" : "تعذّرت المزامنة، سيُعاد المحاولة تلقائيًا.");
        },
      }, [icon("clock", 13), "مزامنة الآن"]),
      el("button.btn.btn-danger-ghost.btn-sm", {
        onclick: () => {
          if (confirm("إيقاف المزامنة على هذا الجهاز؟ بياناتك هنا تبقى كما هي، فقط لن تتزامن بعد الآن.")) {
            stopSync();
          }
        },
      }, ["إيقاف"]),
    ]),
  ]);
}

function showSyncKeyModal(key, firstTime) {
  openModal(firstTime ? "رمز المزامنة الخاص بك" : "رمز الربط", (body, close) => {
    body.append(
      el("p.hint", {}, [
        firstTime
          ? "افتح مذكّرتي على جهازك الآخر (الإعدادات ← المزامنة ← «لدي رمز من جهاز آخر») وأدخل هذا الرمز:"
          : "استخدم هذا الرمز لربط جهاز آخر بنفس بياناتك:",
      ]),
      el("div.sync-key-display", {}, [key]),
      el("div.btn-row", {}, [
        el("button.btn.btn-primary", {
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(key);
              alert("نُسخ الرمز.");
            } catch {
              alert("تعذّر النسخ التلقائي — انسخه يدويًا.");
            }
          },
        }, [icon("download", 14), "نسخ"]),
        el("button.btn.btn-ghost", { onclick: close }, ["إغلاق"]),
      ]),
      firstTime && el("p.hint", {}, ["احتفظ بهذا الرمز — هو مفتاح الوصول لبياناتك، لا تشاركه إلا مع أجهزتك."]),
    );
  });
}

function openLinkForm(statusBox) {
  openModal("ربط بجهاز آخر", (body, close) => {
    const input = el("input.field", { type: "text", placeholder: "مثال: XKQ7-2MPR-9FWT-4CDJ" });
    const err = el("div.form-err");
    body.append(
      field("رمز المزامنة", input),
      err,
      el("div.modal-actions", {}, [
        el("span.spacer"),
        el("button.btn.btn-ghost", { onclick: close }, ["إلغاء"]),
        el("button.btn.btn-primary", {
          onclick: async () => {
            const v = input.value.trim();
            if (!v) { err.textContent = "أدخل الرمز."; return; }
            close();
            paintPushStatus(statusBox, "جارٍ الربط...");
            const r = await linkWithKey(v);
            paintPushStatus(statusBox, r.ok ? "تم الربط والمزامنة ✓" : "تعذّر الربط — تأكد من الرمز.");
          },
        }, ["ربط"]),
      ])
    );
  });
}

function openLockForm(changing) {
  openModal(changing ? "تغيير رمز القفل" : "تفعيل قفل بالرمز", (body, close) => {
    const pin1 = el("input.field", { type: "password", inputmode: "numeric", maxlength: "6", placeholder: "رمز من ٤-٦ أرقام" });
    const pin2 = el("input.field", { type: "password", inputmode: "numeric", maxlength: "6", placeholder: "أعد كتابة الرمز" });
    const err = el("div.form-err");

    const save = async () => {
      const a = pin1.value.trim(), b = pin2.value.trim();
      if (!/^\d{4,6}$/.test(a)) { err.textContent = "الرمز يجب أن يكون ٤ إلى ٦ أرقام."; return; }
      if (a !== b) { err.textContent = "الرمزان غير متطابقين."; return; }
      const hash = await sha256Hex(a);
      store.updateSettings({ appLockEnabled: true, appLockHash: hash });
      close();
    };

    body.append(
      field("الرمز الجديد", pin1),
      field("تأكيد الرمز", pin2),
      err,
      el("div.modal-actions", {}, [
        el("span.spacer"),
        el("button.btn.btn-ghost", { onclick: close }, ["إلغاء"]),
        el("button.btn.btn-primary", { onclick: save }, ["حفظ"]),
      ])
    );
  });
}

function field(label, input) {
  return el("label.form-field", {}, [el("span.form-label", {}, [label]), input]);
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
