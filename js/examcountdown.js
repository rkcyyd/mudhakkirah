/**
 * examcountdown.js — لافتات العدّاد التنازلي (لأقرب اختبار، أو لأقرب مهمة عمومًا)
 */
import { store, nextExam, nextTask } from "./store.js";
import { el } from "./dom.js";
import { toArabicDigits, fromISODate, describeDay } from "./dates.js";

function banner(info, { urgentAt = 3 } = {}) {
  if (!info) return null;
  const { task, type, daysLeft } = info;
  const d = describeDay(fromISODate(task.date));

  let when;
  if (daysLeft <= 0) when = "اليوم";
  else if (daysLeft === 1) when = "غدًا";
  else if (daysLeft === 2) when = "بعد يومين";
  else when = `متبقٍ ${toArabicDigits(daysLeft)} أيام`;

  const urgent = daysLeft <= urgentAt;
  const color = type?.color || "var(--primary)";

  return el("div.exam-countdown" + (urgent ? ".urgent" : ""), {
    style: `--c:${color}`,
  }, [
    el("span.ec-dot"),
    el("div.ec-body", {}, [
      el("div.ec-title", {}, [`${when} · ${task.title}`]),
      el("div.ec-meta", {}, [`${type ? type.label + " — " : ""}${d.weekday} ${d.hijriShort} (${d.greg})`]),
    ]),
  ]);
}

/** يعيد عنصر اللافتة، أو null إذا كانت مغلقة من الإعدادات أو لا اختبارات. */
export function examCountdownBanner() {
  if (!store.getSettings().showExamCountdown) return null;
  return banner(nextExam());
}

/** عدّاد لأقرب مهمة قادمة من أي نوع (لا يتقيّد بإعداد الاختبارات). */
export function taskCountdownBanner() {
  return banner(nextTask(), { urgentAt: 1 });
}
