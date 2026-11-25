/**
 * Formato de backup do Palimpsesto — ver docs/BACKUP_FORMAT.md.
 *
 * Arquivo simples:
 *   { format: "palimpsesto-backup", formatVersion: 1, schemaVersion, appVersion,
 *     exportedAt, counts, checksum: { algorithm: "SHA-256", value }, data }
 * Arquivo protegido por senha:
 *   { format: "palimpsesto-backup-encrypted", formatVersion: 1, kdf, cipher, payload }
 *   em que payload decifrado é exatamente o arquivo simples acima.
 */
import { SCHEMA_VERSION, type AppData, type CollectionName } from '../domain/schema';
import { canonicalJson, decryptText, encryptText, sha256Hex, type EncryptedEnvelope } from './crypto';
import { countData, parseAppData, type IntegrityReport } from './validate';

export const BACKUP_FORMAT = 'palimpsesto-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const APP_VERSION = '1.2.0';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  counts: Record<string, number>;
  checksum: { algorithm: 'SHA-256'; value: string };
  data: AppData;
}

export async function buildBackup(data: AppData, now = new Date().toISOString()): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: data.schemaVersion,
    appVersion: APP_VERSION,
    exportedAt: now,
    counts: countData(data),
    checksum: { algorithm: 'SHA-256', value: await sha256Hex(canonicalJson(data)) },
    data,
  };
}

export async function exportBackupText(data: AppData, password?: string): Promise<string> {
  const file = await buildBackup(data);
  const plain = JSON.stringify(file, null, 2);
  if (!password) return plain;
  return JSON.stringify(await encryptText(plain, password), null, 2);
}

export type BackupInspection =
  | { kind: 'needs-password'; envelope: EncryptedEnvelope }
  | { kind: 'error'; error: string; details?: string[] }
  | {
      kind: 'ok';
      meta: { formatVersion: number; schemaVersion: number; appVersion: string; exportedAt: string; encrypted: boolean };
      data: AppData;
      counts: Record<CollectionName, number>;
      range: { from: string | null; to: string | null };
      integrity: IntegrityReport;
      migratedFrom: number;
    };

/**
 * Valida um arquivo de backup sem tocar nos dados atuais.
 * Etapas: JSON → formato → versão → (senha) → checksum → migração → esquema → integridade.
 */
export async function inspectBackup(textValue: string, password?: string): Promise<BackupInspection> {
  let raw: any;
  try {
    raw = JSON.parse(textValue.replace(/^﻿/, ''));
  } catch {
    return { kind: 'error', error: 'O arquivo não é um JSON válido. Ele pode estar incompleto ou não ser um backup do Palimpsesto.' };
  }
  if (!raw || typeof raw !== 'object') return { kind: 'error', error: 'Arquivo vazio ou irreconhecível.' };

  let encrypted = false;
  if (raw.format === 'palimpsesto-backup-encrypted') {
    if (raw.formatVersion !== 1 || !raw.kdf || !raw.cipher || typeof raw.payload !== 'string')
      return { kind: 'error', error: 'Arquivo protegido com estrutura desconhecida.' };
    if (!password) return { kind: 'needs-password', envelope: raw };
    try {
      raw = JSON.parse(await decryptText(raw, password));
      encrypted = true;
    } catch (e: any) {
      return { kind: 'error', error: e?.message ?? 'Não foi possível abrir o arquivo.' };
    }
  }

  if (raw.format !== BACKUP_FORMAT)
    return { kind: 'error', error: 'Este arquivo não foi reconhecido como um backup do Palimpsesto.' };
  if (typeof raw.formatVersion !== 'number' || raw.formatVersion > BACKUP_FORMAT_VERSION)
    return {
      kind: 'error',
      error: `Formato de backup versão ${raw.formatVersion} não suportado por esta versão do aplicativo. Atualize o Palimpsesto.`,
    };
  if (!raw.data || typeof raw.data !== 'object') return { kind: 'error', error: 'O arquivo não contém dados.' };
  if (typeof raw.data.schemaVersion === 'number' && raw.data.schemaVersion > SCHEMA_VERSION)
    return {
      kind: 'error',
      error: `Backup criado por uma versão mais nova do Palimpsesto (esquema ${raw.data.schemaVersion}). Atualize o aplicativo para importá-lo.`,
    };

  if (raw.checksum?.value) {
    const actual = await sha256Hex(canonicalJson(raw.data));
    if (actual !== raw.checksum.value)
      return {
        kind: 'error',
        error: 'A verificação de integridade falhou: o conteúdo foi alterado ou está corrompido. Nada foi importado.',
      };
  }

  const parsed = parseAppData(raw.data);
  if (!parsed.ok) return { kind: 'error', error: parsed.error, details: parsed.details };

  return {
    kind: 'ok',
    meta: {
      formatVersion: raw.formatVersion,
      schemaVersion: raw.data.schemaVersion,
      appVersion: String(raw.appVersion ?? '?'),
      exportedAt: String(raw.exportedAt ?? ''),
      encrypted,
    },
    data: parsed.data,
    counts: countData(parsed.data),
    range: dateRange(parsed.data),
    integrity: parsed.integrity,
    migratedFrom: parsed.migratedFrom,
  };
}

export function dateRange(data: AppData): { from: string | null; to: string | null } {
  const dates = [...data.moodEntries.map((m) => m.at), ...data.experiences.map((e) => e.at)].sort();
  return { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}
