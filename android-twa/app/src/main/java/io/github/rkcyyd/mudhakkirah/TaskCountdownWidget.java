package io.github.rkcyyd.mudhakkirah;

public class TaskCountdownWidget extends CountdownWidget {
    @Override boolean examOnly() { return false; }
    @Override String widgetTitle() { return "أقرب مهمة"; }
}
