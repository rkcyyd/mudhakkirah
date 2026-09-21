package io.github.rkcyyd.mudhakkirah;

public class ExamCountdownWidget extends CountdownWidget {
    @Override boolean examOnly() { return true; }
    @Override String widgetTitle() { return "أقرب اختبار"; }
}
