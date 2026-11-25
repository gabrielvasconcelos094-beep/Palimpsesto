package app.palimpsesto;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Monta os RemoteViews dos dois widgets. Toda a aparência (cores, formas, ícones)
 * vem da configuração escrita pelo app; aqui só se escolhem layout e tamanhos.
 */
final class WidgetRenderer {
    static final String SCHEME = "palimpsesto";
    static final String HOST = "widget";

    private static final int[] CELL = {R.id.cell0, R.id.cell1, R.id.cell2, R.id.cell3, R.id.cell4};
    private static final int[] ICON = {R.id.icon0, R.id.icon1, R.id.icon2, R.id.icon3, R.id.icon4};
    private static final int[] LABEL = {R.id.label0, R.id.label1, R.id.label2, R.id.label3, R.id.label4};

    private WidgetRenderer() {}

    /** Ação aberta no app: "mood/-2"…"mood/2", "experience" ou "event". */
    static Uri actionUri(String action) {
        return Uri.parse(SCHEME + "://" + HOST + "/" + action);
    }

    static PendingIntent action(Context c, String action, int requestCode) {
        Intent i = new Intent(Intent.ACTION_VIEW, actionUri(action), c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int bgRes(WidgetStore.Config cfg, WidgetStore.Variant v) {
        if ("organic".equals(cfg.style)) return R.drawable.widget_bg_organic;
        return v.radius <= 6 ? R.drawable.widget_bg_r4 : v.radius <= 16 ? R.drawable.widget_bg_r12 : R.drawable.widget_bg_r20;
    }

    private static int strokeRes(WidgetStore.Variant v) {
        return v.radius <= 6 ? R.drawable.widget_stroke_r4 : v.radius <= 16 ? R.drawable.widget_stroke_r12 : R.drawable.widget_stroke_r20;
    }

    private static void frame(RemoteViews rv, WidgetStore.Config cfg, WidgetStore.Variant v) {
        boolean organic = "organic".equals(cfg.style);
        rv.setImageViewResource(R.id.bg, bgRes(cfg, v));
        rv.setInt(R.id.bg, "setColorFilter", v.surface);
        if (organic) {
            // Orgânico: sem contorno; uma forma abstrata discreta no canto.
            rv.setViewVisibility(R.id.stroke, View.GONE);
            rv.setViewVisibility(R.id.blob, View.VISIBLE);
            rv.setInt(R.id.blob, "setColorFilter", v.tint2);
        } else {
            rv.setViewVisibility(R.id.blob, View.GONE);
            rv.setViewVisibility(R.id.stroke, View.VISIBLE);
            rv.setImageViewResource(R.id.stroke, strokeRes(v));
            rv.setInt(R.id.stroke, "setColorFilter", v.line);
        }
    }

    private static int heightDp(Bundle options) {
        return options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
    }

    private static int widthDp(Bundle options, int fallback) {
        int w = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        return w > 0 ? w : fallback;
    }

    /**
     * Mantém os símbolos num tamanho agradável em qualquer redimensionamento: o espaço da
     * célula cresce, mas o ícone para em `maxDp` (o resto vira margem).
     */
    private static void fitIcons(Context c, RemoteViews rv, int[] icons, int count, Bundle options, int fallbackWidthDp, boolean labels, int maxDp) {
        int h = heightDp(options) > 0 ? heightDp(options) : 56;
        float cellW = (widthDp(options, fallbackWidthDp) - 12f) / count;
        float availH = h - 4f - (labels ? 24f : 0f);
        float box = Math.max(24f, Math.min(cellW, availH));
        float target = Math.min(maxDp, box - 4f);
        int pad = Math.round(Math.max(2f, (box - target) / 2f) * c.getResources().getDisplayMetrics().density);
        for (int i = 0; i < count; i++) rv.setViewPadding(icons[i], pad, pad, pad, pad);
    }

    /** Widget de humor: cinco símbolos lado a lado; cada um abre o registro com a valência. */
    static RemoteViews mood(Context c, Bundle options) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_mood);
        WidgetStore.Config cfg = WidgetStore.load(c);
        if (cfg == null) {
            for (int i = 0; i < 5; i++) rv.setOnClickPendingIntent(CELL[i], action(c, "mood/" + (i - 2), 10 + i));
            return rv;
        }
        WidgetStore.Variant v = WidgetStore.pick(c, cfg);
        frame(rv, cfg, v);
        boolean labels = heightDp(options) >= 96;
        for (int i = 0; i < 5; i++) {
            Bitmap b = WidgetStore.bitmap(c, v.mood[i]);
            if (b != null) rv.setImageViewBitmap(ICON[i], b);
            rv.setTextViewText(LABEL[i], cfg.labels[i]);
            rv.setTextColor(LABEL[i], v.inkSoft);
            rv.setViewVisibility(LABEL[i], labels ? View.VISIBLE : View.GONE);
            rv.setContentDescription(CELL[i], "Registrar humor: " + cfg.labels[i]);
            // O valor interno (−2…+2) vai na ação; os símbolos e nomes não importam.
            rv.setOnClickPendingIntent(CELL[i], action(c, "mood/" + (i - 2), 10 + i));
        }
        fitIcons(c, rv, ICON, 5, options, 250, labels, 44);
        return rv;
    }

    /** Widget de atalhos: registrar humor, experiência e acontecimento. */
    static RemoteViews shortcuts(Context c, Bundle options) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_shortcuts);
        rv.setOnClickPendingIntent(R.id.cell0, action(c, "mood/new", 20));
        rv.setOnClickPendingIntent(R.id.cell1, action(c, "experience", 21));
        rv.setOnClickPendingIntent(R.id.cell2, action(c, "event", 22));
        rv.setContentDescription(R.id.cell0, "Registrar humor");
        rv.setContentDescription(R.id.cell1, "Registrar experiência");
        rv.setContentDescription(R.id.cell2, "Registrar acontecimento");
        WidgetStore.Config cfg = WidgetStore.load(c);
        if (cfg == null) return rv;
        WidgetStore.Variant v = WidgetStore.pick(c, cfg);
        frame(rv, cfg, v);
        boolean labels = heightDp(options) >= 48;
        String[] names = {"Humor", "Experiência", "Acontecimento"};
        Bitmap[] icons = {WidgetStore.bitmap(c, v.mood[3]), WidgetStore.bitmap(c, v.actions[0]), WidgetStore.bitmap(c, v.actions[1])};
        for (int i = 0; i < 3; i++) {
            if (icons[i] != null) rv.setImageViewBitmap(ICON[i], icons[i]);
            rv.setTextViewText(LABEL[i], names[i]);
            rv.setTextColor(LABEL[i], v.ink);
            rv.setViewVisibility(LABEL[i], labels ? View.VISIBLE : View.GONE);
        }
        fitIcons(c, rv, ICON, 3, options, 180, labels, 36);
        return rv;
    }
}
