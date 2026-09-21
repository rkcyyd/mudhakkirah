package io.github.rkcyyd.mudhakkirah;

import android.content.Context;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public class HabitsWidget extends BaseWidget {
    @Override int layoutId() { return R.layout.widget_list; }
    @Override String widgetTitle() { return "العادات اليوم"; }

    @Override
    void render(Context c, RemoteViews rv, JSONObject snap, Calendar today) {
        String todayIso = WidgetData.iso(today);
        int dim = ContextCompat.getColor(c, R.color.w_dim);
        List<WidgetData.Habit> habits = WidgetData.habits(snap);
        int done = 0;
        List<Line> lines = new ArrayList<>();
        for (WidgetData.Habit h : habits) {
            boolean d = h.log.contains(todayIso);
            if (d) done++;
            int st = WidgetData.streak(h, today);
            lines.add(new Line(d ? "✓" : "○", h.color, h.icon + " " + h.label + (st > 0 ? "  🔥" + WidgetData.ar(st) : ""), false));
        }
        rv.setTextViewText(R.id.w_title, "العادات اليوم");
        rv.setTextViewText(R.id.w_sub, habits.isEmpty() ? "" : WidgetData.ar(done) + " من " + WidgetData.ar(habits.size()) + " منجزة");
        if (lines.isEmpty()) {
            showEmpty(rv, "لا عادات بعد — أضفها من التطبيق");
        } else {
            capLines(lines, dim);
            fillRows(c, rv, lines);
        }
    }
}
