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

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const submit = async () => {
    const hash = await sha256Hex(entered);
    if (hash === expectedHash) {
      markUnlocked();
      overlay.remove();
      onUnlock();
    } else {
      shaking = true;
      overlay.querySelector(".lock-box").classList.add("shake");
      err.style.visibility = "visible";
      setTimeout(() => {
        overlay.querySelector(".lock-box")?.classList.remove("shake");
        entered = "";
        updateDots();
        shaking = false;
      }, 420);
    }
  };

  const press = (digit) => {
    if (shaking || entered.length >= 6) return;
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
