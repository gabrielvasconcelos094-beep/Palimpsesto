package app.palimpsesto;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PalimpsestoSecurityPlugin.class);
        super.onCreate(savedInstanceState);
        // Tela privada ativa desde o início; o app ajusta conforme a preferência ao carregar.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
}
