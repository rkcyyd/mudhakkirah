package io.github.rkcyyd.mudhakkirah;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/** يطلب رمز المزامنة مرة واحدة (نفس الرمز في رزنامة ← الإعدادات ← المزامنة). */
public class WidgetConfigActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent i = getIntent();
        if (i != null && i.getExtras() != null) {
            widgetId = i.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));

        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID && !WidgetData.getKey(this).isEmpty()) {
            finishOk();
            return;
        }

        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        TextView title = new TextView(this);
        title.setText("رمز المزامنة");
        title.setTextSize(20);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(title);

        TextView help = new TextView(this);
        help.setText("افتح رزنامة ← الإعدادات ← المزامنة بين الأجهزة ← «عرض رمز الربط» ثم انسخ الرمز هنا (مثال: XKQ7-2MPR-9FWT-4CDJ).");
        help.setPadding(0, pad / 2, 0, pad / 2);
        root.addView(help);

        final EditText input = new EditText(this);
        input.setHint("XXXX-XXXX-XXXX-XXXX");
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        input.setGravity(Gravity.CENTER);
        input.setText(WidgetData.getKey(this));
        root.addView(input);

        Button save = new Button(this);
        save.setText("حفظ وتحديث الويدجت");
        save.setOnClickListener(v -> {
            String k = input.getText().toString().trim();
            if (k.length() < 8) {
                Toast.makeText(this, "أدخل الرمز كاملًا", Toast.LENGTH_SHORT).show();
                return;
            }
            WidgetData.setKey(this, k);
            finishOk();
        });
        root.addView(save);
        setContentView(root);
    }

    private void finishOk() {
        Class<?>[] providers = {TasksWidget.class, WeekWidget.class, MonthWidget.class, ExamCountdownWidget.class,
                TaskCountdownWidget.class, HabitsWidget.class, CalendarWidget.class};
        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        for (Class<?> cls : providers) {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(this, cls));
            if (ids.length == 0) continue;
            Intent u = new Intent(this, cls).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            sendBroadcast(u);
        }
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        }
        finish();
    }
}
