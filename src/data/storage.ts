/**
 * Adaptadores de armazenamento (chave → texto).
 * - Android: arquivos no diretório privado do app (Capacitor Filesystem, Directory.Data).
 *   Escrita atômica: grava em ".tmp" e renomeia sobre o arquivo final.
 * - Navegador (desenvolvimento/testes visuais): IndexedDB.
 * - Testes: memória.
 */
export interface StorageAdapter {
  read(key: string): Promise<string | null>;
  /** Deve ser atômica: ou o conteúdo antigo, ou o novo — nunca um meio-termo. */
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  readonly kind: 'native' | 'indexeddb' | 'memory';
}

export class MemoryStorage implements StorageAdapter {
  readonly kind = 'memory' as const;
  map = new Map<string, string>();
  failNextWrite = false;
  async read(key: string) {
    return this.map.get(key) ?? null;
  }
  async write(key: string, value: string) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('falha simulada de escrita');
    }
    this.map.set(key, value);
  }
  async remove(key: string) {
    this.map.delete(key);
  }
  async list(prefix: string) {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

export class IndexedDbStorage implements StorageAdapter {
  readonly kind = 'indexeddb' as const;
  private dbp: Promise<IDBDatabase>;
  constructor(name = 'palimpsesto') {
    this.dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Pede ao navegador para não descartar os dados sob pressão de espaço.
    (navigator).storage?.persist?.().catch(() => {});
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbp;
    return new Promise((resolve, reject) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  async read(key: string) {
    const v = await this.tx('readonly', (s) => s.get(key));
    return typeof v === 'string' ? v : null;
  }
  async write(key: string, value: string) {
    await this.tx('readwrite', (s) => s.put(value, key));
  }
  async remove(key: string) {
    await this.tx('readwrite', (s) => s.delete(key));
  }
  async list(prefix: string) {
    const keys = (await this.tx('readonly', (s) => s.getAllKeys())) as IDBValidKey[];
    return keys.map(String).filter((k) => k.startsWith(prefix)).sort();
  }
}
