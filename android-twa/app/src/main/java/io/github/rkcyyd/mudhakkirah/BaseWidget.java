package io.github.rkcyyd.mudhakkirah;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.FileNotFoundException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** أساس كل ويدجتات رزنامة: جلب البيانات، الضغط للفتح/التحديث، وعرض رسائل الحالة. */
public abstract class BaseWidget extends AppWidgetProvider {
    static final String ACTION_REFRESH = "io.github.rkcyyd.mudhakkirah.WIDGET_REFRESH";
    static final int MAX_ROWS = 9;

    static final int[] ROW = {R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4, R.id.row5, R.id.row6, R.id.row7, R.id.row8};
    static final int[] DOT = {R.id.dot0, R.id.dot1, R.id.dot2, R.id.dot3, R.id.dot4, R.id.dot5, R.id.dot6, R.id.dot7, R.id.dot8};
    static final int[] TXT = {R.id.txt0, R.id.txt1, R.id.txt2, R.id.txt3, R.id.txt4, R.id.txt5, R.id.txt6, R.id.txt7, R.id.txt8};

    static final class Line {
        final String dot;
        final int dotColor;
        final String text;
        final boolean header;

        Line(String dot, int dotColor, String text, boolean header) {
            this.dot = dot;
            this.dotColor = dotColor;
            this.text = text;
            this.header = header;
        }
    }

    abstract int layoutId();

    /** عنوان الويدجت الثابت (يظهر مع رسائل الحالة). */
    abstract String widgetTitle();

    /** يملأ العرض بالبيانات الفعلية (بعد نجاح الجلب أو من الكاش). */
    abstract void render(Context c, RemoteViews rv, JSONObject snap, Calendar today);

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        runAsync(ctx, mgr, ids);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (ACTION_REFRESH.equals(intent.getAction())) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, getClass()));
            runAsync(ctx, mgr, ids);
        } else {
            super.onReceive(ctx, intent);
        }
    }

    private void runAsync(Context ctx, AppWidgetManager mgr, int[] ids) {
        final PendingResult pr = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                update(app, mgr, ids);
            } catch (Exception ignored) {
            } finally {
                pr.finish();
            }
        }).start();
    }

    private void update(Context ctx, AppWidgetManager mgr, int[] ids) {
        String key = WidgetData.getKey(ctx);
        JSONObject snap = null;
        String error = null;
        if (!key.isEmpty()) {
            try {
                snap = WidgetData.fetch(ctx);
            } catch (FileNotFoundException e) {
                error = "badkey";
            } catch (Exception e) {
                snap = WidgetData.cached(ctx);
                if (snap == null) error = "network";
            }
        }
        Calendar today = WidgetData.today();

        for (int id : ids) {
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), layoutId());
            wireClicks(ctx, rv);

            if (key.isEmpty()) {
                message(rv, "اضغط هنا لإدخال رمز المزامنة\n(رزنامة ← الإعدادات ← المزامنة ← عرض رمز الربط)");
            } else if ("badkey".equals(error)) {
                message(rv, "الرمز غير صحيح أو لا توجد بيانات بعد — اضغط لتغييره");
            } else if (error != null) {
                message(rv, "تعذّر الاتصال بالإنترنت");
            } else {
                render(ctx, rv, snap, today);
                long t = WidgetData.fetchedAt(ctx);
                if (t > 0) {
                    rv.setTextViewText(R.id.w_footer, "آخر تحديث " + new SimpleDateFormat("HH:mm", Locale.US).format(new Date(t)));
                }
            }
            mgr.updateAppWidget(id, rv);
        }
    }

    private void wireClicks(Context ctx, RemoteViews rv) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);

        Intent open = new Intent(ctx, LauncherActivity.class);
        rv.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 0, open, flags));

        Intent refresh = new Intent(ctx, getClass()).setAction(ACTION_REFRESH);
        rv.setOnClickPendingIntent(R.id.w_refresh, PendingIntent.getBroadcast(ctx, getClass().getName().hashCode(), refresh, flags));

        Intent config = new Intent(ctx, WidgetConfigActivity.class);
        rv.setOnClickPendingIntent(R.id.w_msg, PendingIntent.getActivity(ctx, 1, config, flags));
    }

    void message(RemoteViews rv, String text) {
        rv.setTextViewText(R.id.w_title, widgetTitle());
        rv.setTextViewText(R.id.w_sub, "");
        rv.setViewVisibility(R.id.w_msg, View.VISIBLE);
        rv.setTextViewText(R.id.w_msg, text);
    }

    static void showEmpty(RemoteViews rv, String text) {
        rv.setViewVisibility(R.id.w_msg, View.VISIBLE);
        rv.setTextViewText(R.id.w_msg, text);
    }

    static void fillRows(Context c, RemoteViews rv, List<Line> lines) {
        int dim = ContextCompat.getColor(c, R.color.w_dim);
        int text = ContextCompat.getColor(c, R.color.w_text);
        for (int i = 0; i < MAX_ROWS; i++) {
            if (i < lines.size()) {
                Line l = lines.get(i);
                rv.setViewVisibility(ROW[i], View.VISIBLE);
                if (l.dot.isEmpty()) {
                    rv.setViewVisibility(DOT[i], View.GONE);
                } else {
                    rv.setViewVisibility(DOT[i], View.VISIBLE);
                    rv.setTextViewText(DOT[i], l.dot);
                    rv.setTextColor(DOT[i], l.dotColor);
                }
                CharSequence cs = l.text;
                if (l.header) {
                    SpannableString ss = new SpannableString(l.text);
                    ss.setSpan(new StyleSpan(android.graphics.Typeface.BOLD), 0, ss.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    cs = ss;
                }
                rv.setTextViewText(TXT[i], cs);
                rv.setTextColor(TXT[i], l.header ? dim : text);
            } else {
                rv.setViewVisibility(ROW[i], View.GONE);
            }
        }
    }

    /** يقصّ القائمة لأقصى عدد صفوف ويضيف سطر "+N أخرى". */
    static void capLines(List<Line> lines, int dimColor) {
        if (lines.size() <= MAX_ROWS) return;
        int extra = lines.size() - (MAX_ROWS - 1);
        while (lines.size() > MAX_ROWS - 1) lines.remove(lines.size() - 1);
        lines.add(new Line("", dimColor, "+" + WidgetData.ar(extra) + " أخرى", true));
    }
}
