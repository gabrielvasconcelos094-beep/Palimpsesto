package app.palimpsesto;

import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Configuração visual dos widgets, escrita pelo aplicativo (tema, estilo, símbolos)
 * e lida pelos providers — que rodam mesmo com o app fechado.
 *
 * Arquivos em filesDir/widgets (config.json + PNGs dos ícones). Se o app nunca
 * sincronizou (ex.: widget adicionado logo após atualizar), usa o conjunto padrão
 * empacotado em assets/widget-defaults.
 */
final class WidgetStore {
    static final String DIR = "widgets";
    static final String CONFIG = "config.json";
    static final String ASSET_DIR = "widget-defaults";

    static final class Variant {
        int bg, surface, ink, inkSoft, line, radius;
        /** Cor de cada nível da escala (−2…+2) e quatro matizes pastel do tema. */
        int[] moodColors = new int[5];
        int[] tints = new int[4];
        String title;
        String[] mood = new String[5];
        String[] actions = new String[2];
    }

    static final class Config {
        String appearance = "system";
        String style = "minimal";
        String[] labels = {"Muito desagradável", "Desagradável", "Intermediário", "Agradável", "Muito agradável"};
        final Map<String, Variant> variants = new HashMap<>();
    }

    private WidgetStore() {}

    static File dir(Context c) {
        return new File(c.getFilesDir(), DIR);
    }

    /** Configuração do app; se faltar ou estiver corrompida, o conjunto padrão empacotado. */
    static Config load(Context c) {
        Config cfg = tryParse(readFile(new File(dir(c), CONFIG)));
        if (cfg == null) cfg = tryParse(readAsset(c.getAssets(), ASSET_DIR + "/" + CONFIG));
        return cfg;
    }

    private static Config tryParse(String json) {
        if (json == null) return null;
        try {
            return parse(json);
        } catch (Exception e) {
            return null;
        }
    }

    static Config parse(String json) throws Exception {
        JSONObject o = new JSONObject(json);
        Config cfg = new Config();
        cfg.appearance = o.optString("appearance", "system");
        cfg.style = o.optString("style", "minimal");
        JSONArray labels = o.optJSONArray("labels");
        if (labels != null && labels.length() == 5) for (int i = 0; i < 5; i++) cfg.labels[i] = labels.optString(i, cfg.labels[i]);
        JSONObject vs = o.getJSONObject("variants");
        for (String key : new String[] {"light", "dark"}) {
            JSONObject v = vs.optJSONObject(key);
            if (v == null) continue;
            Variant x = new Variant();
            x.bg = Color.parseColor(v.getString("bg"));
            x.surface = Color.parseColor(v.getString("surface"));
            x.ink = Color.parseColor(v.getString("ink"));
            x.inkSoft = Color.parseColor(v.getString("inkSoft"));
            x.line = Color.parseColor(v.getString("line"));
            x.radius = v.optInt("radius", 12);
            JSONArray mc = v.getJSONArray("moodColors");
            for (int i = 0; i < 5; i++) x.moodColors[i] = Color.parseColor(mc.getString(i));
            JSONArray tn = v.getJSONArray("tints");
            for (int i = 0; i < 4; i++) x.tints[i] = Color.parseColor(tn.getString(i));
            x.title = v.optString("title", null);
            JSONArray m = v.getJSONArray("mood");
            for (int i = 0; i < 5; i++) x.mood[i] = m.getString(i);
            JSONArray a = v.getJSONArray("actions");
            for (int i = 0; i < 2; i++) x.actions[i] = a.getString(i);
            cfg.variants.put(key, x);
        }
        return cfg.variants.isEmpty() ? null : cfg;
    }

    /** Variante a usar agora: fixa (clara/escura) ou a do modo noturno do sistema. */
    static Variant pick(Context c, Config cfg) {
        boolean night = (c.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
            == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        String want = "dark".equals(cfg.appearance) ? "dark" : "light".equals(cfg.appearance) ? "light" : night ? "dark" : "light";
        Variant v = cfg.variants.get(want);
        return v != null ? v : cfg.variants.values().iterator().next();
    }

    static Bitmap bitmap(Context c, String name) {
        if (name == null) return null;
        try {
            File f = new File(dir(c), name);
            if (f.exists()) return BitmapFactory.decodeFile(f.getAbsolutePath());
            try (InputStream in = c.getAssets().open(ASSET_DIR + "/" + name)) {
                return BitmapFactory.decodeStream(in);
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static String readFile(File f) {
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            return readAll(in);
        } catch (Exception e) {
            return null;
        }
    }

    private static String readAsset(AssetManager am, String path) {
        try (InputStream in = am.open(path)) {
            return readAll(in);
        } catch (Exception e) {
            return null;
        }
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }
}
