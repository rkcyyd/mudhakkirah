package io.github.rkcyyd.mudhakkirah;

import android.content.Context;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

public class CalendarWidget extends BaseWidget {
    static final int[] DOW = {R.id.dow0, R.id.dow1, R.id.dow2, R.id.dow3, R.id.dow4, R.id.dow5, R.id.dow6};
    static final int[] CELL = new int[42];
    static {
        int[] ids = {R.id.cell0, R.id.cell1, R.id.cell2, R.id.cell3, R.id.cell4, R.id.cell5, R.id.cell6,
                R.id.cell7, R.id.cell8, R.id.cell9, R.id.cell10, R.id.cell11, R.id.cell12, R.id.cell13,
                R.id.cell14, R.id.cell15, R.id.cell16, R.id.cell17, R.id.cell18, R.id.cell19, R.id.cell20,
                R.id.cell21, R.id.cell22, R.id.cell23, R.id.cell24, R.id.cell25, R.id.cell26, R.id.cell27,
                R.id.cell28, R.id.cell29, R.id.cell30, R.id.cell31, R.id.cell32, R.id.cell33, R.id.cell34,
                R.id.cell35, R.id.cell36, R.id.cell37, R.id.cell38, R.id.cell39, R.id.cell40, R.id.cell41};
        System.arraycopy(ids, 0, CELL, 0, 42);
    }

    @Override int layoutId() { return R.layout.widget_calendar; }
    @Override String widgetTitle() { return "التقويم"; }

    @Override
    void render(Context c, RemoteViews rv, JSONObject snap, Calendar today) {
        boolean pg = WidgetData.primaryGreg(snap);
        int ws = WidgetData.weekStart(snap);
        int primary = ContextCompat.getColor(c, R.color.w_primary);
        int dim = ContextCompat.getColor(c, R.color.w_dim);
        int text = ContextCompat.getColor(c, R.color.w_text);
        int todayText = ContextCompat.getColor(c, R.color.w_today_text);

        String gTitle = WidgetData.GREG[today.get(Calendar.MONTH)] + " " + WidgetData.ar(today.get(Calendar.YEAR));
        String hTitle = WidgetData.hijri(today);
        rv.setTextViewText(R.id.w_title, pg || hTitle.isEmpty() ? gTitle : hTitle);
        rv.setTextViewText(R.id.w_sub, pg || hTitle.isEmpty() ? hTitle : gTitle);

        for (int i = 0; i < 7; i++) {
            rv.setTextViewText(DOW[i], WidgetData.WEEKDAYS_SHORT[(ws + i) % 7]);
        }

        Set<String> withTasks = new HashSet<>();
        for (WidgetData.Task t : WidgetData.openTasks(snap)) withTasks.add(t.date);

        Calendar first = (Calendar) today.clone();
        first.set(Calendar.DAY_OF_MONTH, 1);
        int startOffset = ((first.get(Calendar.DAY_OF_WEEK) - 1) - ws + 7) % 7;
        Calendar cur = (Calendar) first.clone();
        cur.add(Calendar.DAY_OF_MONTH, -startOffset);
        String todayIso = WidgetData.iso(today);

        for (int i = 0; i < 42; i++) {
            boolean inMonth = cur.get(Calendar.MONTH) == today.get(Calendar.MONTH);
            String iso = WidgetData.iso(cur);
            boolean isToday = iso.equals(todayIso);
            boolean has = withTasks.contains(iso);
            String label = WidgetData.ar(cur.get(Calendar.DAY_OF_MONTH)) + "\n" + (has ? "•" : " ");
            SpannableString ss = new SpannableString(label);
            int color = isToday ? todayText : (!inMonth ? dim : (has ? primary : text));
            ss.setSpan(new ForegroundColorSpan(color), 0, ss.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            if (has || isToday) ss.setSpan(new StyleSpan(Typeface.BOLD), 0, ss.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            rv.setTextViewText(CELL[i], ss);
            rv.setInt(CELL[i], "setBackgroundResource", isToday ? R.drawable.widget_today_bg : 0);
            cur.add(Calendar.DAY_OF_MONTH, 1);
        }
    }
}
