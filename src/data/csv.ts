/**
 * Exportação CSV (separador ";" e BOM UTF-8, compatível com planilhas em pt-BR).
 */
import type { AppData } from '../domain/schema';
import { INDICATORS, energyLabel, valenceLabel, OUTCOME_LABELS } from '../domain/scales';
import { INDICATOR_KEYS } from '../domain/schema';

const SEP = ';';

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Evita injeção de fórmulas em planilhas.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(SEP)).join('\r\n') + '\r\n';
}

const localDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, `${p(d.getHours())}:${p(d.getMinutes())}`];
};

export function moodCsv(data: AppData, from?: string, to?: string): string {
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const labels = data.preferences.valenceLabels;
  const header = [
    'id',
    'data',
    'hora',
    'valencia_nivel_1a5',
    'valencia_valor',
    'valencia_rotulo',
    'energia_1a5',
    'energia_rotulo',
    'emocoes',
    ...INDICATOR_KEYS.map((k) => `${k}_1a5`),
    'contexto',
    'observacoes',
  ];
  const rows = data.moodEntries
    .filter((m) => (!from || m.at >= from) && (!to || m.at <= to))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m) => {
      const [d, h] = localDate(m.at);
      return [
        m.id,
        d,
        h,
        m.valence + 3,
        m.valence,
        valenceLabel(m.valence, labels),
        m.energy ?? '',
        m.energy ? energyLabel(m.energy, data.preferences.energyLabels) : '',
        m.emotionIds.map((id) => emo.get(id) ?? id).join(', '),
        ...INDICATOR_KEYS.map((k) => m.indicators[k] ?? ''),
        m.tags.join(', '),
        m.note,
      ];
    });
  return toCsv([header, ...rows]);
}

export function experiencesCsv(data: AppData, from?: string, to?: string): string {
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const items = new Map(data.repertoire.map((i) => [i.id, i.name]));
  const labels = data.preferences.valenceLabels;
  const header = [
    'id',
    'data',
    'titulo',
    'o_que_aconteceu',
    'como_estava_antes',
    'emocoes',
    'o_que_fiz',
    'o_que_ajudou',
    'o_que_piorou',
    'como_fiquei_depois',
    'depois_descricao',
    'aprendizado',
    'estrategias_usadas',
    'marcadores',
  ];
  const rows = data.experiences
    .filter((x) => (!from || x.at >= from) && (!to || x.at <= to))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((x) => {
      const uses = data.uses
        .filter((u) => u.experienceId === x.id)
        .map((u) => `${items.get(u.itemId) ?? '?'} (${OUTCOME_LABELS[u.outcome]})`);
      return [
        x.id,
        localDate(x.at)[0],
        x.title,
        x.whatHappened,
        x.feelingBefore === null ? '' : valenceLabel(x.feelingBefore, labels),
        x.emotionIds.map((id) => emo.get(id) ?? id).join(', '),
        x.whatIDid,
        x.whatHelped,
        x.whatWorsened,
        x.feelingAfter === null ? '' : valenceLabel(x.feelingAfter, labels),
        x.howIFeltAfter,
        x.learned,
        uses.join(' | '),
        x.tags.join(', '),
      ];
    });
  return toCsv([header, ...rows]);
}

export function indicatorHeaderLabels() {
  return INDICATOR_KEYS.map((k) => INDICATORS[k].label);
}
