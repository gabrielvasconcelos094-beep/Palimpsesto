import { WebPlugin } from '@capacitor/core';
import type { PalimpsestoWidgetsPlugin, WidgetPayload } from './widgets';

/** Implementação para navegador (desenvolvimento e testes): guarda a última carga e permite simular toques. */
export class WidgetsWeb extends WebPlugin implements Omit<PalimpsestoWidgetsPlugin, 'addListener'> {
  last: WidgetPayload | null = null;
  constructor() {
    super();
    if (import.meta.env.DEV) {
      (window as any).__widgetsWeb = this;
      // Testes: simula o app aberto por um toque no widget (equivale à intent de abertura).
      this.launch = (window as any).__launchAction ?? null;
    }
  }
  launch: string | null = null;
  async updateWidgets(payload: WidgetPayload) {
    this.last = payload;
  }
  async consumeLaunchAction() {
    const action = this.launch;
    this.launch = null;
    return { action };
  }
  /** Simula um toque num widget com o app já aberto. */
  emit(action: string) {
    this.notifyListeners('widgetAction', { action });
  }
}
