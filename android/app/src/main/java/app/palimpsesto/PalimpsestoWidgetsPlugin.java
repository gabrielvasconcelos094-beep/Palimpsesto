package app.palimpsesto;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Ponte entre o aplicativo e os widgets:
 *  - updateWidgets: grava a aparência (cores, estilo, ícones PNG) e redesenha os widgets;
 *  - consumeLaunchAction / evento "widgetAction": entrega ao app o toque feito num widget.
 * Nenhum dado pessoal passa por aqui — só aparência e a ação escolhida.
 */
@CapacitorPlugin(name = "PalimpsestoWidgets")
public class PalimpsestoWidgetsPlugin extends Plugin {

    @PluginMethod
    public void updateWidgets(PluginCall call) {
        try {
            JSObject payload = call.getData();
            Context c = getContext();
            File dir = WidgetStore.dir(c);
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("Não foi possível criar a pasta dos widgets.");

            String gen = "g" + System.currentTimeMillis() + "_";
            JSONObject cfg = new JSONObject();
            cfg.put("v", 1);
            cfg.put("appearance", payload.optString("appearance", "system"));
            cfg.put("style", payload.optString("style", "minimal"));
            cfg.put("labels", payload.optJSONArray("labels"));
            JSONObject outVariants = new JSONObject();
            JSONObject variants = payload.getJSONObject("variants");
            Iterator<String> keys = variants.keys();
            Set<String> keep = new HashSet<>();
            keep.add(WidgetStore.CONFIG);
            while (keys.hasNext()) {
                String key = keys.next();
                JSONObject v = variants.getJSONObject(key);
                JSONObject o = new JSONObject();
                for (String k : new String[] {"bg", "surface", "ink", "inkSoft", "line"}) o.put(k, v.getString(k));
                o.put("radius", v.optInt("radius", 12));
                o.put("moodColors", v.getJSONArray("moodColors"));
                o.put("tints", v.getJSONArray("tints"));
                if (v.has("title")) {
                    JSONArray t = new JSONArray();
                    t.put(v.getString("title"));
                    o.put("title", writeImages(dir, gen + key + "_t", t, keep).getString(0));
                }
                o.put("mood", writeImages(dir, gen + key + "_m", v.getJSONArray("mood"), keep));
                o.put("actions", writeImages(dir, gen + key + "_a", v.getJSONArray("actions"), keep));
                outVariants.put(key, o);
            }
            cfg.put("variants", outVariants);
            // A configuração é trocada por último e de forma atômica: nunca há meio-termo.
            writeAtomic(new File(dir, WidgetStore.CONFIG), cfg.toString().getBytes("UTF-8"));
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) if (!keep.contains(f.getName())) f.delete();

            refreshAll(c);
            call.resolve();
        } catch (Exception e) {
            call.reject("Falha ao atualizar os widgets: " + e.getMessage());
        }
    }

    private static JSONArray writeImages(File dir, String prefix, JSONArray b64, Set<String> keep) throws Exception {
        JSONArray names = new JSONArray();
        for (int i = 0; i < b64.length(); i++) {
            String name = prefix + i + ".png";
            byte[] bytes = android.util.Base64.decode(b64.getString(i), android.util.Base64.DEFAULT);
            if (bytes.length < 8 || bytes[1] != 'P' || bytes[2] != 'N' || bytes[3] != 'G') throw new Exception("imagem inválida");
            writeAtomic(new File(dir, name), bytes);
            keep.add(name);
            names.put(name);
        }
        return names;
    }

    private static void writeAtomic(File target, byte[] bytes) throws Exception {
        File tmp = new File(target.getParentFile(), target.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(bytes);
            out.getFD().sync();
        }
        if (!tmp.renameTo(target)) {
            target.delete();
            if (!tmp.renameTo(target)) throw new Exception("não foi possível gravar " + target.getName());
        }
    }

    static void refreshAll(Context c) {
        MoodWidgetProvider.updateAll(c);
        ShortcutsWidgetProvider.updateAll(c);
    }

    /** Lê (e consome) a ação do widget que abriu o app, se houver. */
    @PluginMethod
    public void consumeLaunchAction(PluginCall call) {
        JSObject ret = new JSObject();
        Intent intent = getActivity() != null ? getActivity().getIntent() : null;
        String action = parse(intent);
        if (action != null) intent.setData(null);
        ret.put("action", action);
        call.resolve(ret);
    }

    /** App já aberto: um toque no widget chega como nova intent. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        String action = parse(intent);
        if (action == null) return;
        intent.setData(null);
        JSObject data = new JSObject();
        data.put("action", action);
        notifyListeners("widgetAction", data, true);
    }

    static String parse(Intent intent) {
        if (intent == null) return null;
        Uri u = intent.getData();
        if (u == null || !WidgetRenderer.SCHEME.equals(u.getScheme()) || !WidgetRenderer.HOST.equals(u.getHost())) return null;
        String p = u.getPath();
        return p == null || p.length() < 2 ? null : p.substring(1);
    }
}
