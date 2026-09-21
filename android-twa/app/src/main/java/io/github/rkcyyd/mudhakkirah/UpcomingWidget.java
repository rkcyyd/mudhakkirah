package io.github.rkcyyd.mudhakkirah;

import android.content.Context;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public abstract class UpcomingWidget extends BaseWidget {
    abstract boolean monthMode();

    @Override int layoutId() { return R.layout.widget_list; }

    @Override
    void render(Context c, RemoteViews rv, JSONObject snap, Calendar today) {
        boolean pg = WidgetData.primaryGreg(snap);
        Calendar horizon = (Calendar) today.clone();
        if (monthMode()) horizon.set(Calendar.DAY_OF_MONTH, horizon.getActualMaximum(Calendar.DAY_OF_MONTH));
        else horizon.add(Calendar.DAY_OF_MONTH, 7);
        String from = WidgetData.iso(today);
        String to = WidgetData.iso(horizon);
        rv.setTextViewText(R.id.w_title, widgetTitle());
        int dim = ContextCompat.getColor(c, R.color.w_dim);
        List<Line> lines = new ArrayList<>();
        String lastDate = "";
        int count = 0;
        for (WidgetData.Task t : WidgetData.openTasks(snap)) {
            if (t.date.compareTo(from) <= 0 || t.date.compareTo(to) > 0) continue;
            count++;
            if (!t.date.equals(lastDate)) {
                lastDate = t.date;
                lines.add(new Line("", dim, WidgetData.dayLabel(WidgetData.parse(t.date), pg), true));
            }
            lines.add(new Line("●", t.color, (t.time.isEmpty() ? "" : t.time + "  ") + t.title, false));
        }
        rv.setTextViewText(R.id.w_sub, count == 0 ? "" : WidgetData.ar(count) + " مهمة قادمة");
        if (lines.isEmpty()) {
            showEmpty(rv, monthMode() ? "لا مهام لباقي الشهر 🎉" : "لا مهام هذا الأسبوع 🎉");
        } else {
            capLines(lines, dim);
            fillRows(c, rv, lines);
        }
    }
}
