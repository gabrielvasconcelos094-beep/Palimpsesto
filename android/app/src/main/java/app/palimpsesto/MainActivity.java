package app.palimpsesto;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PalimpsestoSecurityPlugin.class);
        registerPlugin(PalimpsestoWidgetsPlugin.class);
        // Activity restaurada (ex.: após o sistema encerrar o processo): a intent original ainda
        // aponta para o widget que abriu o app, mas essa ação já foi tratada. Não repetir.
        if (savedInstanceState != null) getIntent().setData(null);
        super.onCreate(savedInstanceState);
        // Tela privada ativa desde o início; o app ajusta conforme a preferência ao carregar.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        // Fundo do WebView no tom do sistema (claro/escuro) até o tema do app carregar.
        if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().setBackgroundColor(getColor(R.color.app_background));
    }
}
