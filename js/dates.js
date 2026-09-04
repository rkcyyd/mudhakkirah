/**
 * dates.js — أدوات التاريخ الهجري والميلادي
 * ------------------------------------------------------------------
 * التقويم الهجري يعتمد على تقويم أم القرى (المستخدم رسميًا في السعودية)
 * عبر واجهة Intl المدمجة في المتصفح — بدون أي مكتبة خارجية.
 */

const AR_MONTHS_GREG = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const AR_MONTHS_HIJRI = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const AR_WEEKDAYS = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];
const AR_WEEKDAYS_SHORT = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

const hijriFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const arDigits = new Intl.NumberFormat("ar-EG", { useGrouping: false });

/** أرقام عربية (٠١٢٣) بدون فاصل آلاف. */
export function toArabicDigits(n) {
  return arDigits.format(n);
}

/** "YYYY-MM-DD" لتاريخ محلي (بدون انزياح المنطقة الزمنية). */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

/** يحوّل تاريخًا ميلاديًا إلى مكوّنات هجرية { day, month, year }. */
export function toHijriParts(date) {
  const parts = hijriFmt.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    day: Number(get("day")),
    month: Number(get("month")),
    year: Number(get("year")),
  };
}

export function hijriMonthName(month1to12) {
  return AR_MONTHS_HIJRI[month1to12 - 1] || "";
}

export function gregMonthName(month0to11) {
  return AR_MONTHS_GREG[month0to11] || "";
}

export function weekdayName(date, short = false) {
  const arr = short ? AR_WEEKDAYS_SHORT : AR_WEEKDAYS;
  return arr[date.getDay()];
}

export function weekdayNames(short = false) {
  return short ? AR_WEEKDAYS_SHORT.slice() : AR_WEEKDAYS.slice();
}

/**
 * عنوان الشهر: "شعبان / رمضان ١٤٤٧ هـ — سبتمبر ٢٠٢٦ م"
 * قد يمتد الشهر الميلادي على شهرين هجريين، فنعرض النطاق.
 */
export function monthTitle(year, month0) {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
  const h1 = toHijriParts(first);
  const h2 = toHijriParts(last);

  let hijri;
  if (h1.month === h2.month && h1.year === h2.year) {
    hijri = `${hijriMonthName(h1.month)} ${toArabicDigits(h1.year)} هـ`;
  } else {
    const y = h1.year === h2.year ? toArabicDigits(h1.year) : `${toArabicDigits(h1.year)}/${toArabicDigits(h2.year)}`;
    hijri = `${hijriMonthName(h1.month)} – ${hijriMonthName(h2.month)} ${y} هـ`;
  }
  const greg = `${gregMonthName(month0)} ${toArabicDigits(year)} م`;
  return { hijri, greg };
}

/** وصف كامل ليوم واحد. */
export function describeDay(date) {
  const h = toHijriParts(date);
  return {
    weekday: weekdayName(date),
    greg: `${toArabicDigits(date.getDate())} ${gregMonthName(date.getMonth())} ${toArabicDigits(date.getFullYear())} م`,
    hijri: `${toArabicDigits(h.day)} ${hijriMonthName(h.month)} ${toArabicDigits(h.year)} هـ`,
    hijriShort: `${toArabicDigits(h.day)} ${hijriMonthName(h.month)}`,
  };
}

/**
 * يبني شبكة الشهر: مصفوفة أسابيع، كل أسبوع 7 كائنات
 * { date, inMonth, iso }.
 */
export function buildMonthGrid(year, month0, weekStart = 0) {
  const firstOfMonth = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const startOffset = (firstOfMonth.getDay() - weekStart + 7) % 7;
  const gridStart = new Date(year, month0, 1 - startOffset);
  const weekCount = Math.ceil((startOffset + daysInMonth) / 7);

  const weeks = [];
  let cursor = new Date(gridStart);
  for (let w = 0; w < weekCount; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push({
        date: new Date(cursor),
        iso: toISODate(cursor),
        inMonth: cursor.getMonth() === month0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
