/**
 * dom.js — أدوات صغيرة لبناء عناصر HTML
 */

/**
 * إنشاء عنصر: el("div.card", { onclick }, [child, "نص"])
 * الوسم يقبل صيغة "tag.class1.class2#id".
 */
export function el(spec, props = {}, children = []) {
  const [head, ...classes] = spec.split(".");
  let tag = head;
  let id = null;
  if (head.includes("#")) {
    [tag, id] = head.split("#");
  }
  const node = document.createElement(tag || "div");
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(" ");

  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node) {
      try { node[k] = v; } catch { node.setAttribute(k, v); }
    } else {
      node.setAttribute(k, v);
    }
  }

  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** نافذة منبثقة بسيطة. content دالة تستقبل (close). */
export function openModal(title, buildContent) {
  const overlay = el("div.modal-overlay");
  const box = el("div.modal");
  const close = () => overlay.remove();

  box.append(
    el("div.modal-head", {}, [
      el("h3", {}, [title]),
      el("button.icon-btn", { onclick: close, "aria-label": "إغلاق" }, ["✕"]),
    ])
  );
  const body = el("div.modal-body");
  box.append(body);
  overlay.append(box);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  document.body.append(overlay);
  buildContent(body, close);
  const firstField = body.querySelector("input, textarea, select, button");
  if (firstField) firstField.focus();
  return close;
}
