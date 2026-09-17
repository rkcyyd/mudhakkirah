/**
 * lock.js — قفل بسيط برمز (PIN) لمنع فتح التطبيق من شخص آخر على نفس الجهاز.
 * ------------------------------------------------------------------
 * تنبيه صدق: هذا حماية بسيطة من جهة العميل (لا خادم هنا) — يمنع شخصًا
 * عابرًا ممسكًا بجهازك من فتح التطبيق، لكنه لا يوقف شخصًا تقنيًا يصل
 * لأدوات المطوّر في متصفحك. البيانات نفسها أصلًا لا تُرى من أي متصفح
 * آخر لأنها محفوظة محليًا في هذا المتصفح فقط.
 */
import { el } from "./dom.js";
import { iconHTML } from "./icons.js";

const SESSION_KEY = "mudh_unlocked";
const ATTEMPTS_KEY = "mudh_lock_attempts";

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** حماية بسيطة من التخمين المتكرر: قفل مؤقّت متصاعد بعد كل ٥ محاولات فاشلة. */
function getAttempts() {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)) || { count: 0, lockUntil: 0 }; }
  catch { return { count: 0, lockUntil: 0 }; }
}
function setAttempts(a) {
  try { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a)); } catch {}
}
function registerFailure() {
  const a = getAttempts();
  a.count++;
  if (a.count > 0 && a.count % 5 === 0) {
    const tier = Math.min(Math.floor(a.count / 5), 6); // يتصاعد حتى يصل لسقف
    a.lockUntil = Date.now() + tier * 30_000; // ٣٠ ثانية × مستوى التصعيد
  }
  setAttempts(a);
  return a;
}
function registerSuccess() {
  setAttempts({ count: 0, lockUntil: 0 });
}

export function isUnlockedThisSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return true; // إن تعذّر الوصول لـ sessionStorage لا نمنع الاستخدام
  }
}

function markUnlocked() {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
}

/**
 * يعرض شاشة قفل كاملة فوق الصفحة. ينادي onUnlock() عند إدخال الرمز الصحيح.
 */
export function showLockScreen(expectedHash, onUnlock) {
  const overlay = el("div.lock-screen");
  const dots = [];
  let entered = "";
  let shaking = false;
  let lockTimer = null;

  const dotsRow = el("div.lock-dots", {},
    Array.from({ length: 6 }, () => {
      const d = el("span.lock-dot");
      dots.push(d);
      return d;
    })
  );

  const err = el("div.lock-err", {}, ["رمز غير صحيح، حاول مرة أخرى"]);
  err.style.visibility = "hidden";

  const updateDots = () => {
    dots.forEach((d, i) => d.classList.toggle("filled", i < entered.length));
  };

  function isLocked() {
    return getAttempts().lockUntil > Date.now();
  }

  function applyLockUI() {
    const { lockUntil } = getAttempts();
    const remaining = lockUntil - Date.now();
    const locked = remaining > 0;
    overlay.querySelectorAll(".lock-key, .lock-confirm").forEach((b) => { b.disabled = locked; });
    clearInterval(lockTimer);
    if (locked) {
      err.style.visibility = "visible";
      const tick = () => {
        const left = Math.ceil((getAttempts().lockUntil - Date.now()) / 1000);
        if (left <= 0) {
          err.textContent = "رمز غير صحيح، حاول مرة أخرى";
          applyLockUI();
          return;
        }
        err.textContent = `محاولات كثيرة فاشلة — انتظر ${left} ثانية`;
      };
      tick();
      lockTimer = setInterval(tick, 1000);
    }
  }

  const submit = async () => {
    if (isLocked()) return;
    const hash = await sha256Hex(entered);
    if (hash === expectedHash) {
      registerSuccess();
      clearInterval(lockTimer);
      markUnlocked();
      overlay.remove();
      onUnlock();
    } else {
      registerFailure();
      shaking = true;
      overlay.querySelector(".lock-box").classList.add("shake");
      err.style.visibility = "visible";
      setTimeout(() => {
        overlay.querySelector(".lock-box")?.classList.remove("shake");
        entered = "";
        updateDots();
        shaking = false;
        applyLockUI();
      }, 420);
    }
  };

  const press = (digit) => {
    if (shaking || isLocked() || entered.length >= 6) return;
    entered += digit;
    updateDots();
    err.style.visibility = "hidden";
  };

  const pad = el("div.lock-pad", {},
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) => {
      if (k === "") return el("span");
      if (k === "⌫") {
        return el("button.lock-key.lock-key-del", {
          onclick: () => { entered = entered.slice(0, -1); updateDots(); },
        }, [el("span.icon", { html: iconHTML("close", 16) })]);
      }
      return el("button.lock-key", { onclick: () => press(k) }, [k]);
    })
  );

  const confirmBtn = el("button.btn.btn-primary.lock-confirm", { onclick: submit }, ["فتح"]);

  overlay.append(
    el("div.lock-box", {}, [
      el("div.lock-icon", { html: iconHTML("lock", 30) }),
      el("div.lock-title", {}, ["مذكّرتي مقفلة"]),
      el("div.lock-sub", {}, ["أدخل الرمز لفتح التطبيق"]),
      dotsRow,
      err,
      pad,
      confirmBtn,
    ])
  );

  document.body.append(overlay);
  applyLockUI();

  window.addEventListener("keydown", function onKey(e) {
    if (!document.body.contains(overlay)) {
      window.removeEventListener("keydown", onKey);
      return;
    }
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") { entered = entered.slice(0, -1); updateDots(); }
    else if (e.key === "Enter") submit();
  });
}
