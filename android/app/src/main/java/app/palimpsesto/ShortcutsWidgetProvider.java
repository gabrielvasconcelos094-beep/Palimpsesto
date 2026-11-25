package app.palimpsesto;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;

/** Widget compacto com três atalhos: humor, experiência e acontecimento. */
public class ShortcutsWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, WidgetRenderer.shortcuts(c, m.getAppWidgetOptions(id)));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        m.updateAppWidget(id, WidgetRenderer.shortcuts(c, options));
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, ShortcutsWidgetProvider.class));
        for (int id : ids) m.updateAppWidget(id, WidgetRenderer.shortcuts(c, m.getAppWidgetOptions(id)));
    }
}
