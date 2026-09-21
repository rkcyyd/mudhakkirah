package io.github.rkcyyd.mudhakkirah;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** جلب لقطة بيانات رزنامة من خادم المزامنة + أدوات مشتركة للويدجت. */
final class WidgetData {
    static final String SERVER = "https://mudhakkirah-push.k12345aled.workers.dev";
    private static final String PREFS = "roznama_widgets";

    static final String[] WEEKDAYS = {"الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"};
    static final String[] WEEKDAYS_SHORT = {"أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"};
    static final String[] GREG = {"يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
            "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"};
    static final String[] HIJRI = {"محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
            "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"};

    private WidgetData() {}

    /* ---------- التخزين المحلي ---------- */

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String getKey(Context c) {
        return prefs(c).getString("key", "");
    }

    static void setKey(Context c, String key) {
        prefs(c).edit().putString("key", key.trim().toUpperCase(Locale.ROOT)).remove("snapshot").apply();
    }

    static long fetchedAt(Context c) {
        return prefs(c).getLong("fetchedAt", 0);
    }

    static JSONObject cached(Context c) {
        String s = prefs(c).getString("snapshot", null);
        if (s == null) return null;
        try { return new JSONObject(s); } catch (Exception e) { return null; }
    }

    /* ---------- الشبكة ---------- */

    static String sha256(String s) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] d = md.digest(s.getBytes("UTF-8"));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format(Locale.US, "%02x", b));
        return sb.toString();
    }

    /** يسحب اللقطة من الخادم ويخزّنها. يرمي استثناءً عند الفشل (404 = رمز خاطئ/لا بيانات). */
    static JSONObject fetch(Context c) throws Exception {
        String key = getKey(c);
        URL url = new URL(SERVER + "/data/pull");
        HttpURLConnection h = (HttpURLConnection) url.openConnection();
        try {
            h.setRequestMethod("POST");
            h.setConnectTimeout(8000);
            h.setReadTimeout(8000);
            h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/json");
            byte[] body = ("{\"keyHash\":\"" + sha256(key) + "\"}").getBytes("UTF-8");
            OutputStream os = h.getOutputStream();
            os.write(body);
            os.close();
            int code = h.getResponseCode();
            if (code == 404) throw new FileNotFoundException("no data");
            if (code != 200) throw new IOException("http " + code);
            InputStream in = h.getInputStream();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            in.close();
            JSONObject snap = new JSONObject(bo.toString("UTF-8")).getJSONObject("snapshot");
            prefs(c).edit().putString("snapshot", snap.toString()).putLong("fetchedAt", System.currentTimeMillis()).apply();
            return snap;
        } finally {
            h.disconnect();
        }
    }

    /* ---------- تحويلات التاريخ ---------- */

    static String ar(long n) {
        String s = Long.toString(n);
        StringBuilder b = new StringBuilder();
        for (char ch : s.toCharArray()) b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch);
        return b.toString();
    }

    static Calendar today() {
        Calendar c = Calendar.getInstance();
        zero(c);
        return c;
    }

    static void zero(Calendar c) {
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
    }

    static String iso(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static Calendar parse(String iso) {
        Calendar c = Calendar.getInstance();
        try {
            String[] p = iso.split("-");
            c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
        } catch (Exception ignored) {}
        zero(c);
        return c;
    }

    static int daysBetween(Calendar a, Calendar b) {
        return (int) Math.round((b.getTimeInMillis() - a.getTimeInMillis()) / 86400000.0);
    }

    static String weekday(Calendar c) {
        return WEEKDAYS[c.get(Calendar.DAY_OF_WEEK) - 1];
    }

    static String greg(Calendar c) {
        return ar(c.get(Calendar.DAY_OF_MONTH)) + " " + GREG[c.get(Calendar.MONTH)] + " " + ar(c.get(Calendar.YEAR)) + " م";
    }

    static String gregShort(Calendar c) {
        return ar(c.get(Calendar.DAY_OF_MONTH)) + " " + GREG[c.get(Calendar.MONTH)];
    }

    @SuppressLint("NewApi")
    static String hijri(Calendar c) {
        if (Build.VERSION.SDK_INT < 26) return "";
        try {
            java.time.LocalDate ld = java.time.LocalDate.of(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
            java.time.chrono.HijrahDate h = java.time.chrono.HijrahDate.from(ld);
            return ar(h.get(java.time.temporal.ChronoField.DAY_OF_MONTH)) + " "
                    + HIJRI[h.get(java.time.temporal.ChronoField.MONTH_OF_YEAR) - 1] + " "
                    + ar(h.get(java.time.temporal.ChronoField.YEAR)) + " هـ";
        } catch (Exception e) {
            return "";
        }
    }

    @SuppressLint("NewApi")
    static String hijriShort(Calendar c) {
        if (Build.VERSION.SDK_INT < 26) return "";
        try {
            java.time.LocalDate ld = java.time.LocalDate.of(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
            java.time.chrono.HijrahDate h = java.time.chrono.HijrahDate.from(ld);
            return ar(h.get(java.time.temporal.ChronoField.DAY_OF_MONTH)) + " "
                    + HIJRI[h.get(java.time.temporal.ChronoField.MONTH_OF_YEAR) - 1];
        } catch (Exception e) {
            return "";
        }
    }

    /** "الأحد ٩ ربيع الآخر" أو الميلادي حسب إعداد التاريخ البارز. */
    static String dayLabel(Calendar c, boolean primaryGreg) {
        String h = hijriShort(c);
        if (primaryGreg || h.isEmpty()) return weekday(c) + " " + gregShort(c);
        return weekday(c) + " " + h;
    }

    /* ---------- نماذج البيانات ---------- */

    static final class Task {
        String title, date, time, typeLabel = "", typeCategory = "";
        int color = Color.parseColor("#8B949E");
    }

    static final class Habit {
        String label, icon;
        int color;
        int target;
        Set<String> log = new HashSet<>();
    }

    static int parseColor(String s, int fallback) {
        try { return Color.parseColor(s); } catch (Exception e) { return fallback; }
    }

    /** المهام غير المنجزة. */
    static List<Task> openTasks(JSONObject snap) {
        List<Task> out = new ArrayList<>();
        if (snap == null) return out;
        Map<String, JSONObject> types = new HashMap<>();
        JSONArray ta = snap.optJSONArray("types");
        if (ta != null) for (int i = 0; i < ta.length(); i++) {
            JSONObject t = ta.optJSONObject(i);
            if (t != null) types.put(t.optString("id"), t);
        }
        JSONArray arr = snap.optJSONArray("tasks");
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null || o.optBoolean("done", false)) continue;
            Task t = new Task();
            t.title = o.optString("title", "");
            t.date = o.optString("date", "");
            t.time = o.optString("time", "");
            JSONObject ty = types.get(o.optString("typeId"));
            if (ty != null) {
                t.typeLabel = ty.optString("label", "");
                t.typeCategory = ty.optString("category", "");
                t.color = parseColor(ty.optString("color", ""), t.color);
            }
            if (!t.date.isEmpty()) out.add(t);
        }
        java.util.Collections.sort(out, (a, b) -> (a.date + (a.time.isEmpty() ? "99" : a.time)).compareTo(b.date + (b.time.isEmpty() ? "99" : b.time)));
        return out;
    }

    static List<Habit> habits(JSONObject snap) {
        List<Habit> out = new ArrayList<>();
        if (snap == null) return out;
        JSONArray arr = snap.optJSONArray("habits");
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            Habit h = new Habit();
            h.label = o.optString("label", "");
            h.icon = o.optString("icon", "🎯");
            h.color = parseColor(o.optString("color", ""), Color.parseColor("#2DA44E"));
            h.target = o.optInt("target", 7);
            JSONObject log = o.optJSONObject("log");
            if (log != null) {
                java.util.Iterator<String> it = log.keys();
                while (it.hasNext()) h.log.add(it.next());
            }
            out.add(h);
        }
        return out;
    }

    static int streak(Habit h, Calendar today) {
        Calendar c = (Calendar) today.clone();
        if (!h.log.contains(iso(c))) c.add(Calendar.DAY_OF_MONTH, -1);
        int n = 0;
        while (h.log.contains(iso(c))) {
            n++;
            c.add(Calendar.DAY_OF_MONTH, -1);
        }
        return n;
    }

    static boolean primaryGreg(JSONObject snap) {
        if (snap == null) return false;
        JSONObject s = snap.optJSONObject("settingsSubset");
        return s != null && "gregorian".equals(s.optString("primaryCalendar", "hijri"));
    }

    static int weekStart(JSONObject snap) {
        if (snap == null) return 0;
        JSONObject s = snap.optJSONObject("settingsSubset");
        return s == null ? 0 : s.optInt("weekStart", 0);
    }
}
