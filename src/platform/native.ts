/**
 * Ponte com a plataforma. Tudo o que depende do Android fica aqui, com
 * alternativas para o navegador (usado no desenvolvimento e nos testes).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { IndexedDbStorage, MemoryStorage, type StorageAdapter } from '../data/storage';

export const isNative = () => Capacitor.isNativePlatform();

/* ------------------------------------------------------------------------ */
/* Armazenamento em arquivos privados do app                                 */
/* ------------------------------------------------------------------------ */
const DIR = 'palimpsesto';

/**
 * Escrita segura sem depender da semântica de "rename sobre arquivo
 * existente": grava em .tmp, remove o antigo e renomeia. Se o processo for
 * interrompido entre esses passos, a leitura recupera o .tmp.
 */
export class NativeFileStorage implements StorageAdapter {
  readonly kind = 'native' as const;
  private ready: Promise<void>;
  constructor() {
    this.ready = Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(() => {});
  }
  private p(key: string) {
    return `${DIR}/${key}`;
  }
  private async readRaw(path: string): Promise<string | null> {
    try {
      const r = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
      return typeof r.data === 'string' ? r.data : await (r.data as Blob).text();
    } catch {
      return null;
    }
  }
  async read(key: string) {
    await this.ready;
    const main = await this.readRaw(this.p(key));
    if (main !== null) return main;
    return this.readRaw(this.p(key) + '.tmp');
  }
  async write(key: string, value: string) {
    await this.ready;
    const path = this.p(key);
    const tmp = path + '.tmp';
    await Filesystem.writeFile({ path: tmp, data: value, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
    // Confere o que foi gravado antes de substituir o arquivo bom.
    const check = await this.readRaw(tmp);
    if (check === null || check.length !== value.length) throw new Error('Falha ao verificar a gravação.');
    await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => {});
    await Filesystem.rename({ from: tmp, to: path, directory: Directory.Data, toDirectory: Directory.Data });
  }
  async remove(key: string) {
    await this.ready;
    await Filesystem.deleteFile({ path: this.p(key), directory: Directory.Data }).catch(() => {});
    await Filesystem.deleteFile({ path: this.p(key) + '.tmp', directory: Directory.Data }).catch(() => {});
  }
  async list(prefix: string) {
    await this.ready;
    try {
      const r = await Filesystem.readdir({ path: DIR, directory: Directory.Data });
      return r.files
        .map((f: any) => (typeof f === 'string' ? f : f.name))
        .filter((n: string) => !n.endsWith('.tmp') && n.startsWith(prefix))
        .sort();
    } catch {
      return [];
    }
  }
}

export function createStorage(): StorageAdapter {
  if (isNative()) return new NativeFileStorage();
  if (typeof indexedDB !== 'undefined') return new IndexedDbStorage();
  return new MemoryStorage();
}

/* ------------------------------------------------------------------------ */
/* Exportar arquivos                                                         */
/* ------------------------------------------------------------------------ */

/**
 * Entrega um arquivo ao usuário. No Android, grava em cache e abre a folha
 * de compartilhamento (Salvar no dispositivo, Drive, e-mail…). No navegador,
 * faz o download.
 */
export async function deliverFile(filename: string, content: string | Uint8Array, mime: string): Promise<'shared' | 'downloaded'> {
  if (isNative()) {
    const isText = typeof content === 'string';
    const data = isText ? (content as string) : bytesToBase64(content as Uint8Array);
    const res = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data,
      directory: Directory.Cache,
      recursive: true,
      ...(isText ? { encoding: Encoding.UTF8 } : {}),
    });
    try {
      await Share.share({ title: filename, files: [res.uri], dialogTitle: 'Salvar ou enviar arquivo' });
    } catch (e: any) {
      // Cancelar a folha de compartilhamento não é erro.
      if (!/cancel/i.test(String(e?.message ?? e))) throw e;
    }
    return 'shared';
  }
  const blob = new Blob([content as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

/** Remove exportações antigas do cache (dados pessoais não devem ficar soltos). */
export async function clearExportCache() {
  if (!isNative()) return;
  await Filesystem.rmdir({ path: 'exports', directory: Directory.Cache, recursive: true }).catch(() => {});
}

function bytesToBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Abre o seletor de arquivos e devolve o texto escolhido. */
export function pickTextFile(accept = '.json,application/json'): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = async () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return resolve(null);
      if (f.size > 60 * 1024 * 1024) return resolve({ name: f.name, text: '' });
      resolve({ name: f.name, text: await f.text() });
    };
    document.body.appendChild(input);
    input.click();
  });
}

/* ------------------------------------------------------------------------ */
/* Segurança (plugin nativo próprio: biometria e tela privada)               */
/* ------------------------------------------------------------------------ */
interface PalimpsestoSecurityPlugin {
  biometricStatus(): Promise<{ available: boolean; reason?: string }>;
  authenticate(o: { title: string; subtitle?: string; cancel: string }): Promise<{ success: boolean; error?: string }>;
  setPrivacyScreen(o: { enabled: boolean }): Promise<void>;
}
const Security = registerPlugin<PalimpsestoSecurityPlugin>('PalimpsestoSecurity');

export async function biometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await Security.biometricStatus()).available;
  } catch {
    return false;
  }
}

export async function biometricAuthenticate(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const r = await Security.authenticate({
      title: 'Desbloquear o Palimpsesto',
      subtitle: 'Use sua biometria ou o bloqueio do aparelho',
      cancel: 'Usar PIN',
    });
    return !!r.success;
  } catch {
    return false;
  }
}

export async function setPrivacyScreen(enabled: boolean) {
  if (!isNative()) return;
  await Security.setPrivacyScreen({ enabled }).catch(() => {});
}
