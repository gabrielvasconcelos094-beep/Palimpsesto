package app.palimpsesto;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Monta os RemoteViews dos dois widgets. Toda a aparência (cores, formas, ícones, título)
 * vem da configuração escrita pelo app; aqui só se escolhem layout, tamanhos e composição.
 *
 * Composição (inspirada no app):
 *  - Humor: cinco "poços" circulares, cada um tingido com a cor do seu nível e um anel
 *    suave; o símbolo no centro. Com altura suficiente, aparece o título em fonte serifada
 *    ("Como você está?") e, mais alto ainda, os nomes dos níveis.
 *  - Atalhos: três tiles pastel com ícone e rótulo.
 *  - Minimalista: cartão da cor da superfície com fio fino. Orgânico: bloco pastel com cantos
 *    assimétricos, formas abstratas discretas e círculos/tiles brancos ou coloridos.
 */
final class WidgetRenderer {
    static final String SCHEME = "palimpsesto";
    static final String HOST = "widget";

    private static final int[] CELL = {R.id.cell0, R.id.cell1, R.id.cell2, R.id.cell3, R.id.cell4};
    private static final int[] ICON = {R.id.icon0, R.id.icon1, R.id.icon2, R.id.icon3, R.id.icon4};
    private static final int[] LABEL = {R.id.label0, R.id.label1, R.id.label2, R.id.label3, R.id.label4};
    private static final int[] WELL = {R.id.well0, R.id.well1, R.id.well2, R.id.well3, R.id.well4};
    private static final int[] RING = {R.id.ring0, R.id.ring1, R.id.ring2, R.id.ring3, R.id.ring4};
    private static final int[] TILE = {R.id.tile0, R.id.tile1, R.id.tile2};
    private static final int[] TILE_ORGANIC = {R.drawable.widget_tile_org_a, R.drawable.widget_tile_org_b, R.drawable.widget_tile_org_c};

    private WidgetRenderer() {}

    static Uri actionUri(String action) {
        return Uri.parse(SCHEME + "://" + HOST + "/" + action);
    }

    /** Ação aberta no app: "mood/-2"…"mood/2", "mood/new", "experience" ou "event". */
    static PendingIntent action(Context c, String action, int requestCode) {
        Intent i = new Intent(Intent.ACTION_VIEW, actionUri(action), c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Mistura `a` com `b`; t é a parte de `b` (0…1). */
    static int mix(int a, int b, float t) {
        return Color.rgb(
            Math.round(Color.red(a) + (Color.red(b) - Color.red(a)) * t),
            Math.round(Color.green(a) + (Color.green(b) - Color.green(a)) * t),
            Math.round(Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t));
    }

    private static int bgRes(boolean organic, WidgetStore.Variant v) {
        if (organic) return R.drawable.widget_bg_organic;
        return v.radius <= 6 ? R.drawable.widget_bg_r4 : v.radius <= 16 ? R.drawable.widget_bg_r12 : R.drawable.widget_bg_r20;
    }

    private static int strokeRes(WidgetStore.Variant v) {
        return v.radius <= 6 ? R.drawable.widget_stroke_r4 : v.radius <= 16 ? R.drawable.widget_stroke_r12 : R.drawable.widget_stroke_r20;
    }

    private static int tileRes(WidgetStore.Variant v) {
        return v.radius <= 6 ? R.drawable.widget_tile_r3 : v.radius <= 16 ? R.drawable.widget_tile_r8 : R.drawable.widget_tile_r14;
    }

    /** Cartão de fundo: cor, contorno (minimalista) ou formas abstratas (orgânico). */
    private static void frame(RemoteViews rv, boolean organic, WidgetStore.Variant v, boolean decor) {
        rv.setImageViewResource(R.id.bg, bgRes(organic, v));
        rv.setInt(R.id.bg, "setColorFilter", organic ? v.tints[0] : v.surface);
        if (organic) {
            rv.setViewVisibility(R.id.stroke, View.GONE);
            // A forma abstrata só aparece onde há espaço livre (ao lado do título), nunca sobre os poços.
            rv.setViewVisibility(R.id.blob, decor ? View.VISIBLE : View.GONE);
            rv.setInt(R.id.blob, "setColorFilter", v.tints[1]);
        } else {
            rv.setViewVisibility(R.id.blob, View.GONE);
            rv.setViewVisibility(R.id.stroke, View.VISIBLE);
            rv.setImageViewResource(R.id.stroke, strokeRes(v));
            rv.setInt(R.id.stroke, "setColorFilter", v.line);
        }
    }

    private static int heightDp(Bundle options) {
        int h = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        return h > 0 ? h : 56;
    }

    private static int widthDp(Bundle options, int fallback) {
        int w = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        return w > 0 ? w : fallback;
    }

    private static int px(Context c, float dp) {
        return Math.round(dp * c.getResources().getDisplayMetrics().density);
    }

    /** Widget de humor: cinco símbolos; cada um abre o registro já com a valência. */
    static RemoteViews mood(Context c, Bundle options) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_mood);
        for (int i = 0; i < 5; i++) rv.setOnClickPendingIntent(CELL[i], action(c, "mood/" + (i - 2), 10 + i));
        WidgetStore.Config cfg = WidgetStore.load(c);
        if (cfg == null) return rv;
        WidgetStore.Variant v = WidgetStore.pick(c, cfg);
        boolean organic = "organic".equals(cfg.style);

        int h = heightDp(options);
        int w = widthDp(options, 250);
        boolean title = h >= 84 && v.title != null;
        frame(rv, organic, v, title);
        boolean labels = h >= 112;
        Bitmap tb = title ? WidgetStore.bitmap(c, v.title) : null;
        if (tb != null) {
            rv.setImageViewBitmap(R.id.title, tb);
            rv.setViewVisibility(R.id.title, View.VISIBLE);
        } else {
            rv.setViewVisibility(R.id.title, View.GONE);
        }

        // Poço: fundo tingido com a cor do nível (minimalista) ou círculo da superfície (orgânico).
        int bgColor = organic ? v.tints[0] : v.surface;
        for (int i = 0; i < 5; i++) {
            int level = v.moodColors[i];
            Bitmap b = WidgetStore.bitmap(c, v.mood[i]);
            if (b != null) rv.setImageViewBitmap(ICON[i], b);
            rv.setInt(WELL[i], "setColorFilter", organic ? v.surface : mix(level, bgColor, 0.88f));
            if (organic) {
                rv.setViewVisibility(RING[i], View.GONE);
            } else {
                rv.setViewVisibility(RING[i], View.VISIBLE);
                rv.setInt(RING[i], "setColorFilter", mix(level, bgColor, 0.55f));
            }
            rv.setTextViewText(LABEL[i], cfg.labels[i]);
            rv.setTextColor(LABEL[i], v.inkSoft);
            rv.setViewVisibility(LABEL[i], labels ? View.VISIBLE : View.GONE);
            rv.setContentDescription(CELL[i], "Registrar humor: " + cfg.labels[i]);
        }

        // Tamanhos: o poço cresce até 52dp e o símbolo ocupa ~60% dele, centralizado.
        float cellW = (w - 16f) / 5f;
        float availH = h - 16f - (title ? 26f : 0f) - (labels ? 32f : 0f); // nomes reservam 2 linhas em todas as células
        float box = Math.max(24f, Math.min(cellW, availH));
        float well = Math.min(52f, box - 2f);
        float wellPad = Math.max(1f, (box - well) / 2f);
        float iconPad = Math.max(2f, (box - well * 0.6f) / 2f);
        for (int i = 0; i < 5; i++) {
            rv.setViewPadding(WELL[i], px(c, wellPad), px(c, wellPad), px(c, wellPad), px(c, wellPad));
            rv.setViewPadding(RING[i], px(c, wellPad), px(c, wellPad), px(c, wellPad), px(c, wellPad));
            rv.setViewPadding(ICON[i], px(c, iconPad), px(c, iconPad), px(c, iconPad), px(c, iconPad));
        }
        return rv;
    }

    /** Widget de atalhos: três tiles com ícone e rótulo. */
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
        boolean organic = "organic".equals(cfg.style);
        // Orgânico: fundo claro com tiles de matizes diferentes; minimalista: tiles discretos num único tom.
        if (organic) {
            rv.setImageViewResource(R.id.bg, R.drawable.widget_bg_organic);
            rv.setInt(R.id.bg, "setColorFilter", v.surface);
            rv.setViewVisibility(R.id.stroke, View.GONE);
            rv.setViewVisibility(R.id.blob, View.GONE);
        } else {
            frame(rv, false, v, false);
        }
        int h = heightDp(options);
        int w = widthDp(options, 180);
        boolean labels = h >= 48;
        String[] names = {"Humor", "Experiência", "Acontecimento"};
        Bitmap[] icons = {WidgetStore.bitmap(c, v.mood[3]), WidgetStore.bitmap(c, v.actions[0]), WidgetStore.bitmap(c, v.actions[1])};
        int[] tileColor = organic ? new int[] {v.tints[1], v.tints[2], v.tints[3]} : new int[] {mix(v.tints[0], v.surface, 0.35f), mix(v.tints[0], v.surface, 0.35f), mix(v.tints[0], v.surface, 0.35f)};
        for (int i = 0; i < 3; i++) {
            rv.setImageViewResource(TILE[i], organic ? TILE_ORGANIC[i] : tileRes(v));
            rv.setInt(TILE[i], "setColorFilter", tileColor[i]);
            if (icons[i] != null) rv.setImageViewBitmap(ICON[i], icons[i]);
            rv.setTextViewText(LABEL[i], names[i]);
            rv.setTextColor(LABEL[i], v.ink);
            rv.setViewVisibility(LABEL[i], labels ? View.VISIBLE : View.GONE);
        }
        // O ícone nunca passa de 34dp; o resto vira respiro dentro do tile.
        float tileW = (w - 12f) / 3f - 6f;
        float availH = h - 12f - 6f - 4f - (labels ? 18f : 0f);
        float box = Math.max(18f, Math.min(tileW, availH));
        float pad = Math.max(2f, (box - Math.min(34f, box - 2f)) / 2f);
        for (int i = 0; i < 3; i++) rv.setViewPadding(ICON[i], px(c, pad), px(c, pad), px(c, pad), px(c, pad));
        return rv;
    }
}
