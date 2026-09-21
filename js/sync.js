/**
 * sync.js — مزامنة بيانات التطبيق بين أجهزتك (نفس الخادم المستخدم للتنبيهات)
 * ------------------------------------------------------------------
 * لا يوجد نظام تسجيل دخول. الرابط بين أجهزتك هو "رمز مزامنة" عشوائي طويل
 * (١٢٨ بت) تولّده أنت على أول جهاز وتُدخله يدويًا على بقية أجهزتك. الخادم
 * لا يرى الرمز نفسه أبدًا — فقط بصمته (SHA-256) — وهذه البصمة هي مفتاح
 * تخزين بياناتك في KV. بدون الرمز، لا يمكن لأي أحد آخر الوصول لبياناتك
 * أو حتى معرفة أنها موجودة (لا قوائم علنية، لا تخمين ممكن عمليًا).
 */
import { store } from "./store.js";
import { sha256Hex } from "./lock.js";
import { PUSH_SERVER_URL } from "./push-sync.js";

const KEY_STORAGE = "mudh_sync_key";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // بلا أحرف/أرقام متشابهة (0/O, 1/I..)

/** يولّد رمز مزامنة عشوائيًا قابلًا للقراءة، مثل: XKQ7-2MPR-9FWT-4CDJ */
export function generateSyncKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s.match(/.{1,4}/g).join("-");
}

export function getLocalSyncKey() {
  try { return localStorage.getItem(KEY_STORAGE); } catch { return null; }
}
function saveLocalSyncKey(key) {
  try { localStorage.setItem(KEY_STORAGE, key); } catch {}
}
function clearLocalSyncKey() {
  try { localStorage.removeItem(KEY_STORAGE); } catch {}
}

async function keyHash() {
  const key = getLocalSyncKey();
  return key ? sha256Hex(key) : null;
}

let lastPushedBody = null; // لتجنّب رفع نفس اللقطة مرتين (يوفّر حدود Cloudflare المجانية)

/** يرفع اللقطة المحلية الحالية كما هي (بدون سحب أولًا). */
async function rawPush() {
  const hash = await keyHash();
  if (!hash) return { ok: false, reason: "no-key" };
  try {
    const body = JSON.stringify({ keyHash: hash, snapshot: store.getSyncSnapshot() });
    if (body === lastPushedBody) return { ok: true, skipped: true };
    const res = await fetch(`${PUSH_SERVER_URL}/data/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) lastPushedBody = body;
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, reason: "network", error: String(e) };
  }
}

async function pullNow() {
  const hash = await keyHash();
  if (!hash) return { ok: false, reason: "no-key" };
  try {
    const res = await fetch(`${PUSH_SERVER_URL}/data/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyHash: hash }),
    });
    if (res.status === 404) return { ok: true, empty: true };
    if (!res.ok) return { ok: false, reason: "server-error" };
    const { snapshot } = await res.json();
    store.mergeRemoteSnapshot(snapshot);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "network", error: String(e) };
  }
}

/**
 * يسحب أولًا ويدمج (حتى لا نرفع نسخة محلية أقدم فتُفقد تغييرات جاءت من
 * جهاز آخر)، ثم يرفع النتيجة المدموجة. هذا هو المسار الآمن الذي يجب
 * استخدامه دائمًا بدل الرفع المباشر.
 */
async function pushNow() {
  const pull = await pullNow(); // يدمج أي تحديثات من الخادم في الحالة المحلية أولًا
  if (!pull.ok) return pull; // لا شبكة/رمز غير صالح — لا فائدة من محاولة الرفع
  return rawPush();
}

/** يبدأ مزامنة جديدة على هذا الجهاز بمفتاح جديد، ويرفع بياناته الحالية. */
export async function startNewSync() {
  const key = generateSyncKey();
  saveLocalSyncKey(key);
  store.updateSettings({ syncEnabled: true, syncKey: key });
  await rawPush(); // لا يوجد شيء على الخادم بعد لسحبه
  return key;
}

/** يربط هذا الجهاز برمز موجود من جهاز آخر، ويسحب بياناته أولًا. */
export async function linkWithKey(key) {
  const clean = key.trim().toUpperCase();
  saveLocalSyncKey(clean);
  store.updateSettings({ syncEnabled: true, syncKey: clean });
  const pull = await pullNow();
  if (!pull.ok) {
    clearLocalSyncKey();
    store.updateSettings({ syncEnabled: false, syncKey: null });
    return pull;
  }
  await rawPush(); // إرسال ما لدينا محليًا مدموجًا مع ما سُحب فقط للتو
  return pull;
}

export function stopSync() {
  clearLocalSyncKey();
  store.updateSettings({ syncEnabled: false, syncKey: null });
}

let debounceTimer = null;
let loopTimer = null;

/** يجدول رفعًا بعد أي تغيير محلي (بتأخير بسيط لتجميع تغييرات متتالية). */
export function scheduleSyncPush() {
  if (!store.getSettings().syncEnabled) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(pushNow, 2500);
}

/** يبدأ سحبًا دوريًا (كل ٤٥ ثانية، ويتوقف عند إخفاء التطبيق) ليصل أي تغيير من جهاز آخر. */
export function startSyncLoop() {
  if (loopTimer) return;
  if (store.getSettings().syncEnabled) pullNow();
  loopTimer = setInterval(() => {
    if (document.hidden) return;
    if (store.getSettings().syncEnabled) pullNow();
  }, 45_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && store.getSettings().syncEnabled) pullNow();
  });
}

export { pushNow, pullNow };
