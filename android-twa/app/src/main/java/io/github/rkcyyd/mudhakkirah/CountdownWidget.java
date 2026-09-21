package io.github.rkcyyd.mudhakkirah;

import android.content.Context;
import android.util.TypedValue;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;

public abstract class CountdownWidget extends BaseWidget {
    abstract boolean examOnly();

    @Override int layoutId() { return R.layout.widget_countdown; }

    @Override
    void render(Context c, RemoteViews rv, JSONObject snap, Calendar today) {
        boolean pg = WidgetData.primaryGreg(snap);
        String todayIso = WidgetData.iso(today);
        rv.setTextViewText(R.id.w_title, widgetTitle());
        rv.setTextViewText(R.id.w_sub, "");
        WidgetData.Task next = null;
        for (WidgetData.Task t : WidgetData.openTasks(snap)) {
            if (t.date.compareTo(todayIso) < 0) continue;
            if (examOnly() && !"exam".equals(t.typeCategory)) continue;
            next = t;
            break;
        }
        if (next == null) {
            showEmpty(rv, examOnly() ? "لا اختبارات قادمة 🎉" : "لا مهام قادمة 🎉");
            return;
        }
        Calendar d = WidgetData.parse(next.date);
        int days = WidgetData.daysBetween(today, d);
        if (days <= 0) {
            rv.setTextViewText(R.id.w_big, "اليوم");
            rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, 28);
            rv.setTextViewText(R.id.w_unit, "");
        } else if (days == 1) {
            rv.setTextViewText(R.id.w_big, "غدًا");
            rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, 28);
            rv.setTextViewText(R.id.w_unit, "");
        } else {
            rv.setTextViewText(R.id.w_big, WidgetData.ar(days));
            rv.setTextViewTextSize(R.id.w_big, TypedValue.COMPLEX_UNIT_SP, 40);
            rv.setTextViewText(R.id.w_unit, "أيام متبقية");
        }
        rv.setTextColor(R.id.w_big, next.color);
        rv.setTextViewText(R.id.w_task, next.title);
        rv.setTextViewText(R.id.w_meta, (next.typeLabel.isEmpty() ? "" : next.typeLabel + " — ")
                + WidgetData.dayLabel(d, pg) + (next.time.isEmpty() ? "" : "  " + next.time));
    }
}
