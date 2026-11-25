package app.palimpsesto;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.os.Bundle;
import android.appwidget.AppWidgetManager;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.RemoteViews;
import android.widget.TextView;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import org.junit.Before;
import org.junit.Test;

/**
 * Infla os RemoteViews reais dos widgets, no tamanho de um widget na tela, desenha em
 * imagens (gravadas em getExternalFilesDir) e confere ícones, textos e ações.
 */
public class WidgetRenderTest {
    private Context ctx;
    private File out;

    @Before
    public void setUp() {
        ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        out = ctx.getExternalFilesDir(null);
        deleteConfig();
    }

    private void deleteConfig() {
        File d = WidgetStore.dir(ctx);
        File[] fs = d.listFiles();
        if (fs != null) for (File f : fs) f.delete();
    }

    private void writeConfig(String appearance, String style, String json) throws Exception {
        File d = WidgetStore.dir(ctx);
        d.mkdirs();
        try (FileOutputStream o = new FileOutputStream(new File(d, WidgetStore.CONFIG))) {
            o.write(json.getBytes("UTF-8"));
        }
    }

    private static String variant(String bg, String surface, String ink, String inkSoft, String line, String t1, String t2, int radius, String k) {
        return "{\"bg\":\"" + bg + "\",\"surface\":\"" + surface + "\",\"ink\":\"" + ink + "\",\"inkSoft\":\"" + inkSoft + "\",\"line\":\"" + line + "\",\"tint1\":\"" + t1
            + "\",\"tint2\":\"" + t2 + "\",\"radius\":" + radius + ",\"mood\":[\"d_" + k + "_m0.png\",\"d_" + k + "_m1.png\",\"d_" + k + "_m2.png\",\"d_" + k + "_m3.png\",\"d_" + k
            + "_m4.png\"],\"actions\":[\"d_" + k + "_a0.png\",\"d_" + k + "_a1.png\"]}";
    }

    private Bundle size(int heightDp, int widthDp) {
        Bundle b = new Bundle();
        b.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, heightDp);
        b.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, widthDp);
        return b;
    }

    /** Infla, mede em dp, desenha e grava a imagem. */
    private View render(RemoteViews rv, int wDp, int hDp, String name) throws Exception {
        float d = ctx.getResources().getDisplayMetrics().density;
        int w = Math.round(wDp * d);
        int h = Math.round(hDp * d);
        FrameLayout parent = new FrameLayout(ctx);
        View v = rv.apply(ctx, parent);
        v.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        v.layout(0, 0, w, h);
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        c.drawColor(0xFF7A7F86); // "papel de parede" para ver cantos arredondados e transparência
        v.draw(c);
        try (FileOutputStream o = new FileOutputStream(new File(out, name + ".png"))) {
            bmp.compress(Bitmap.CompressFormat.PNG, 100, o);
        }
        return v;
    }

    private void assertFiveIcons(View v) {
        int[] ids = {R.id.icon0, R.id.icon1, R.id.icon2, R.id.icon3, R.id.icon4};
        for (int id : ids) {
            ImageView iv = v.findViewById(id);
            assertNotNull(iv);
            assertTrue("ícone sem imagem", iv.getDrawable() instanceof BitmapDrawable);
            assertTrue(((BitmapDrawable) iv.getDrawable()).getBitmap().getWidth() >= 64);
        }
    }

    @Test
    public void moodWidget_defaultsWithoutAppSync() throws Exception {
        // Nenhuma configuração gravada pelo app: usa o conjunto padrão empacotado.
        View v = render(WidgetRenderer.mood(ctx, size(56, 320)), 320, 56, "mood-default");
        assertFiveIcons(v);
        for (int id : new int[] {R.id.cell0, R.id.cell1, R.id.cell2, R.id.cell3, R.id.cell4}) assertTrue(v.findViewById(id).hasOnClickListeners());
        assertEquals("Registrar humor: Muito desagradável", v.findViewById(R.id.cell0).getContentDescription().toString());
        assertEquals("Registrar humor: Muito agradável", v.findViewById(R.id.cell4).getContentDescription().toString());
        assertEquals(View.GONE, v.findViewById(R.id.label0).getVisibility());
        assertEquals(View.VISIBLE, v.findViewById(R.id.stroke).getVisibility());
        assertEquals(View.GONE, v.findViewById(R.id.blob).getVisibility());
    }

    @Test
    public void moodWidget_tallerShowsLabels_andResizes() throws Exception {
        View v = render(WidgetRenderer.mood(ctx, size(110, 320)), 320, 110, "mood-labels");
        assertEquals(View.VISIBLE, v.findViewById(R.id.label2).getVisibility());
        assertEquals("Intermediário", ((TextView) v.findViewById(R.id.label2)).getText().toString());
        render(WidgetRenderer.mood(ctx, size(48, 200)), 200, 48, "mood-narrow");
        render(WidgetRenderer.mood(ctx, size(150, 320)), 320, 150, "mood-tall");
    }

    @Test
    public void moodWidget_organicStyle_customLabels_dark() throws Exception {
        String cfg = "{\"v\":1,\"appearance\":\"dark\",\"style\":\"organic\",\"labels\":[\"Tempestade\",\"Chuva\",\"Névoa\",\"Brisa\",\"Sol\"],\"variants\":{\"dark\":"
            + variant("#15201B", "#1D2A24", "#E8F2EC", "#B7C9BF", "#33443B", "#27403A", "#3B5A4C", 16, "dark") + ",\"light\":"
            + variant("#EEF6F1", "#FAFDFB", "#1B2A22", "#4B5E54", "#CFE0D6", "#DDEEE5", "#F0D8D4", 16, "light") + "}}";
        writeConfig("dark", "organic", cfg);
        render(WidgetRenderer.mood(ctx, size(56, 320)), 320, 56, "mood-organic-dark-1x");
        View v = render(WidgetRenderer.mood(ctx, size(110, 320)), 320, 110, "mood-organic-dark");
        assertEquals(View.VISIBLE, v.findViewById(R.id.blob).getVisibility());
        assertEquals(View.GONE, v.findViewById(R.id.stroke).getVisibility());
        assertEquals("Tempestade", ((TextView) v.findViewById(R.id.label0)).getText().toString());
        assertEquals("Registrar humor: Sol", v.findViewById(R.id.cell4).getContentDescription().toString());
        assertFiveIcons(v);
    }

    @Test
    public void moodWidget_followsSystemNightMode_whenAppearanceIsSystem() throws Exception {
        String cfg = "{\"v\":1,\"appearance\":\"system\",\"style\":\"minimal\",\"variants\":{\"light\":"
            + variant("#F4EFE6", "#FBF8F2", "#2A2622", "#5A534C", "#E3DCCF", "#E6DED0", "#F2D8C8", 4, "light") + ",\"dark\":"
            + variant("#1C1B1A", "#262422", "#E8E1D5", "#B8B0A4", "#3A3733", "#2E2B28", "#3A2E27", 4, "dark") + "}}";
        writeConfig("system", "minimal", cfg);
        WidgetStore.Config c = WidgetStore.load(ctx);
        assertNotNull(c);
        WidgetStore.Variant v = WidgetStore.pick(ctx, c);
        boolean night = (ctx.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        assertEquals(night ? 0xFF262422 : 0xFFFBF8F2, v.surface);
        render(WidgetRenderer.mood(ctx, size(56, 320)), 320, 56, "mood-system");
    }

    @Test
    public void shortcutsWidget_threeActions() throws Exception {
        View v = render(WidgetRenderer.shortcuts(ctx, size(56, 220)), 220, 56, "shortcuts-default");
        String[] names = {"Registrar humor", "Registrar experiência", "Registrar acontecimento"};
        int[] cells = {R.id.cell0, R.id.cell1, R.id.cell2};
        for (int i = 0; i < 3; i++) {
            assertTrue(v.findViewById(cells[i]).hasOnClickListeners());
            assertEquals(names[i], v.findViewById(cells[i]).getContentDescription().toString());
        }
        assertEquals("Experiência", ((TextView) v.findViewById(R.id.label1)).getText().toString());
        assertTrue(((ImageView) v.findViewById(R.id.icon0)).getDrawable() instanceof BitmapDrawable);
        render(WidgetRenderer.shortcuts(ctx, size(40, 180)), 180, 40, "shortcuts-compact");
        render(WidgetRenderer.shortcuts(ctx, size(100, 260)), 260, 100, "shortcuts-tall");
        render(WidgetRenderer.shortcuts(ctx, size(150, 320)), 320, 150, "shortcuts-huge");
    }

    @Test
    public void actions_roundTripThroughUri() {
        String[] actions = {"mood/-2", "mood/-1", "mood/0", "mood/1", "mood/2", "mood/new", "experience", "event"};
        for (String a : actions) {
            Intent i = new Intent(Intent.ACTION_VIEW, WidgetRenderer.actionUri(a));
            assertEquals(a, PalimpsestoWidgetsPlugin.parse(i));
        }
        assertEquals(null, PalimpsestoWidgetsPlugin.parse(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://example.com/widget/mood/1"))));
        assertEquals(null, PalimpsestoWidgetsPlugin.parse(new Intent()));
    }

    @Test
    public void corruptConfig_fallsBackToDefaults() throws Exception {
        writeConfig("system", "minimal", "{ isto não é json");
        View v = render(WidgetRenderer.mood(ctx, size(56, 320)), 320, 56, "mood-corrupt");
        assertFiveIcons(v);
    }
}
