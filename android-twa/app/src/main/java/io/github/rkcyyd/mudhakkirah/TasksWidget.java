package io.github.rkcyyd.mudhakkirah;

import android.content.Context;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public class TasksWidget extends BaseWidget {
    @Override int layoutId() { return R.layout.widget_list; }
    @Override String widgetTitle() { return "اليوم"; }

    @Override
    void render(Context c, RemoteViews rv, JSONObject snap, Calendar today) {
        boolean pg = WidgetData.primaryGreg(snap);
        rv.setTextViewText(R.id.w_title, "اليوم");
        rv.setTextViewText(R.id.w_sub, WidgetData.dayLabel(today, pg));
        String todayIso = WidgetData.iso(today);
        int danger = ContextCompat.getColor(c, R.color.w_danger);
        int dim = ContextCompat.getColor(c, R.color.w_dim);
        List<Line> lines = new ArrayList<>();
        List<WidgetData.Task> overdue = new ArrayList<>();
        List<WidgetData.Task> now = new ArrayList<>();
        for (WidgetData.Task t : WidgetData.openTasks(snap)) {
            if (t.date.compareTo(todayIso) < 0) overdue.add(t);
            else if (t.date.equals(todayIso)) now.add(t);
        }
        for (WidgetData.Task t : overdue) lines.add(new Line("●", danger, t.title + "  — متأخرة", false));
        for (WidgetData.Task t : now) lines.add(new Line("●", t.color, (t.time.isEmpty() ? "" : t.time + "  ") + t.title, false));
        if (lines.isEmpty()) {
            showEmpty(rv, "لا مهام اليوم 🎉");
        } else {
            capLines(lines, dim);
            fillRows(c, rv, lines);
        }
    }
}
