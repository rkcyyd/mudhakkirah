/**
 * examcountdown.js — لافتة العدّاد التنازلي لأقرب اختبار
 */
import { store, nextExam } from "./store.js";
import { el } from "./dom.js";
import { toArabicDigits, fromISODate, describeDay } from "./dates.js";

/** يعيد عنصر اللافتة، أو null إذا كانت مغلقة من الإعدادات أو لا اختبارات. */
export function examCountdownBanner() {
  if (!store.getSettings().showExamCountdown) return null;
  const info = nextExam();
  if (!info) return null;

  const { task, type, daysLeft } = info;
  const d = describeDay(fromISODate(task.date));

  let when;
  if (daysLeft <= 0) when = "اليوم";
  else if (daysLeft === 1) when = "غدًا";
  else if (daysLeft === 2) when = "بعد يومين";
  else when = `متبقٍ ${toArabicDigits(daysLeft)} أيام`;

  const urgent = daysLeft <= 3;

  return el("div.exam-countdown" + (urgent ? ".urgent" : ""), {
    style: `--c:${type.color}`,
  }, [
    el("span.ec-dot"),
    el("div.ec-body", {}, [
      el("div.ec-title", {}, [`${when} · ${task.title}`]),
      el("div.ec-meta", {}, [`${type.label} — ${d.weekday} ${d.hijriShort} (${d.greg})`]),
    ]),
  ]);
}
