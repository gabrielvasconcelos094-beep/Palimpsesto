import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative } from './native';

export function onAppPause(fn: () => void) {
  const vis = () => document.visibilityState === 'hidden' && fn();
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('pagehide', fn);
  let off: (() => void) | undefined;
  if (isNative()) {
    App.addListener('pause', fn).then((h) => (off = () => h.remove()));
  }
  return () => {
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('pagehide', fn);
    off?.();
  };
}

export function onAppResume(fn: () => void) {
  const vis = () => document.visibilityState === 'visible' && fn();
  document.addEventListener('visibilitychange', vis);
  let off: (() => void) | undefined;
  if (isNative()) App.addListener('resume', fn).then((h) => (off = () => h.remove()));
  return () => {
    document.removeEventListener('visibilitychange', vis);
    off?.();
  };
}

export function onBackButton(fn: () => void) {
  if (!isNative()) return () => {};
  let off: (() => void) | undefined;
  App.addListener('backButton', fn).then((h) => (off = () => h.remove()));
  return () => off?.();
}

export function exitApp() {
  if (isNative()) App.minimizeApp().catch(() => App.exitApp());
}

export async function syncStatusBar(bg: string, dark: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', bg);
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
  } catch {
    /* sem barra de status */
  }
}
