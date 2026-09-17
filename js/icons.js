/**
 * icons.js — مجموعة أيقونات SVG بسيطة (خطوط، بلا اعتماديات خارجية)
 * بديل عن رموز Unicode/الإيموجي حتى تبدو الواجهة متّسقة في كل مكان.
 */

const PATHS = {
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="5,13 10,18 19,7"/>',
  "chevron-start": '<polyline points="15,6 9,12 15,18"/>',
  "chevron-end": '<polyline points="9,6 15,12 9,18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4.2"/><line x1="12" y1="19.8" x2="12" y2="22"/><line x1="2" y1="12" x2="4.2" y2="12"/><line x1="19.8" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="6.4" y2="17.6"/><line x1="17.6" y1="6.4" x2="19.1" y2="4.9"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="7,12 10.3,15.3 17,8.7"/>',
  tag: '<path d="M3 4h7l11 11-7 7L3 11.5V4Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  note: '<path d="M6 3h8l5 5v13H6Z"/><path d="M14 3v5h5"/><line x1="9" y1="12.5" x2="16" y2="12.5"/><line x1="9" y1="16.5" x2="14.5" y2="16.5"/>',
  settings: '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2"/>',
  trash: '<polyline points="4,7 20,7"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20l0.8-3.8L15.5 5.5l3.8 3.8L8.6 20H4Z"/>',
  maximize: '<polyline points="9,3 3,3 3,9"/><polyline points="15,3 21,3 21,9"/><polyline points="21,15 21,21 15,21"/><polyline points="3,15 3,21 9,21"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><line x1="21" y1="21" x2="15.5" y2="15.5"/>',
  download: '<path d="M12 3v13"/><polyline points="7,11.5 12,16.5 17,11.5"/><line x1="4" y1="20" x2="20" y2="20"/>',
  upload: '<path d="M12 20V7"/><polyline points="7,11.5 12,6.5 17,11.5"/><line x1="4" y1="4" x2="20" y2="4"/>',
  target: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
  bell: '<path d="M6 10a6 6 0 1 1 12 0c0 4.2 1.2 5.6 1.8 6.2a.7.7 0 0 1-.5 1.2H4.7a.7.7 0 0 1-.5-1.2C4.8 15.6 6 14.2 6 10Z"/><path d="M9.5 20a2.5 2.5 0 0 0 5 0"/>',
  "bell-off": '<path d="M6 10a6 6 0 0 1 3-5.2"/><path d="M12 4a6 6 0 0 1 6 6c0 4.2 1.2 5.6 1.8 6.2a.7.7 0 0 1-.5 1.2H8.5"/><path d="M4.7 17.4A.7.7 0 0 0 5.2 18.6h.3"/><path d="M9.5 20a2.5 2.5 0 0 0 5 0"/><line x1="3" y1="3" x2="21" y2="21"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><polyline points="12,7.5 12,12 15.5,14"/>',
  lock: '<rect x="4.5" y="11" width="15" height="9.5" rx="2.2"/><path d="M8 11V7.3a4 4 0 0 1 8 0V11"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none"/>',
};

/**
 * يعيد رمز HTML لأيقونة SVG جاهزة للحقن (يستخدم في el(..., {html}) أو innerHTML مباشرة).
 * اللون يتبع خاصية color الحالية (currentColor).
 */
export function iconHTML(name, size = 20) {
  const body = PATHS[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
