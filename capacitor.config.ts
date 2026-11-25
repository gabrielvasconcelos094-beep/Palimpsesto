import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.palimpsesto',
  appName: 'Palimpsesto',
  webDir: 'dist',
  android: {
    // O conteúdo é servido a partir do próprio APK; nada é carregado da rede.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Sem telemetria e sem serviços externos.
  },
};

export default config;
