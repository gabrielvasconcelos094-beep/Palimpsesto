/**
 * Criptografia com WebCrypto (disponível no WebView do Android e no Node).
 * - Backups protegidos: PBKDF2-SHA256 (600 000 iterações) → AES-256-GCM.
 * - PIN de bloqueio: PBKDF2-SHA256 com sal aleatório; guardamos apenas o hash.
 */
const subtle = () => {
  const s = (globalThis).crypto?.subtle as SubtleCrypto | undefined;
  if (!s) throw new Error('WebCrypto indisponível neste dispositivo.');
  return s;
};

export const BACKUP_KDF_ITERATIONS = 600_000;
export const PIN_KDF_ITERATIONS = 210_000;

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n);
  (globalThis).crypto.getRandomValues(b);
  return b;
}

export async function sha256Hex(textValue: string): Promise<string> {
  const buf = await subtle().digest('SHA-256', new TextEncoder().encode(textValue));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveBits(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<ArrayBuffer> {
  const key = await subtle().importKey('raw', new TextEncoder().encode(secret.normalize('NFC')), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

async function aesKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const bits = await deriveBits(password, salt, iterations);
  return subtle().importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface EncryptedEnvelope {
  format: 'palimpsesto-backup-encrypted';
  formatVersion: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  payload: string;
}

export async function encryptText(plain: string, password: string, iterations = BACKUP_KDF_ITERATIONS): Promise<EncryptedEnvelope> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await aesKey(password, salt, iterations);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return {
    format: 'palimpsesto-backup-encrypted',
    formatVersion: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    payload: toBase64(new Uint8Array(ct)),
  };
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Senha incorreta ou arquivo danificado.');
  }
}

export async function decryptText(env: EncryptedEnvelope, password: string): Promise<string> {
  const key = await aesKey(password, fromBase64(env.kdf.salt), env.kdf.iterations);
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(env.cipher.iv) }, key, fromBase64(env.payload));
    return new TextDecoder().decode(pt);
  } catch {
    throw new WrongPasswordError();
  }
}

export async function hashPin(pin: string, saltB64?: string, iterations = PIN_KDF_ITERATIONS) {
  const salt = saltB64 ? fromBase64(saltB64) : randomBytes(16);
  const bits = await deriveBits(pin, salt, iterations);
  return { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt), iterations };
}

/** Comparação em tempo constante. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyPin(pin: string, stored: { pinHash: string; salt: string; iterations: number }) {
  if (!stored.pinHash || !stored.salt) return false;
  const { hash } = await hashPin(pin, stored.salt, stored.iterations || PIN_KDF_ITERATIONS);
  return safeEqual(hash, stored.pinHash);
}

/** JSON canônico: chaves ordenadas, para checksums estáveis. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  const keys = Object.keys(value as object)
    .filter((k) => (value as any)[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(',')}}`;
}
