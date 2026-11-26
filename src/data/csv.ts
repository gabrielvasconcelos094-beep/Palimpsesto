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

/** `at` é hora local flutuante: data e hora saem sem conversão de fuso. */
const localDate = (at: string) => [at.slice(0, 10), at.slice(11, 16)];
const PRECISION = { exact: 'exato', period: 'periodo', day: 'sem_horario' } as const;
const created = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function moodCsv(data: AppData, from?: string, to?: string): string {
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const labels = data.preferences.valenceLabels;
  const header = [
    'id',
    'data',
    'hora',
    'precisao_horario',
    'valencia_nivel_1a5',
    'valencia_valor',
    'valencia_rotulo',
    'energia_1a5',
    'energia_rotulo',
    'emocoes',
    ...INDICATOR_KEYS.map((k) => `${k}_1a5`),
    'horas_de_sono',
    'atividades',
    'contexto',
    'observacoes',
    'escrito_em',
    'alterado_em',
  ];
  const items = new Map(data.repertoire.map((i) => [i.id, i.name]));
  const rows = data.moodEntries
    .filter((m) => (!from || m.at.slice(0, 10) >= from.slice(0, 10)) && (!to || m.at.slice(0, 10) <= to.slice(0, 10)))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m) => {
      const [d, h] = localDate(m.at);
      return [
        m.id,
        d,
        m.timePrecision === 'day' ? '' : h,
        PRECISION[m.timePrecision],
        m.valence + 3,
        m.valence,
        valenceLabel(m.valence, labels),
        m.energy ?? '',
        m.energy ? energyLabel(m.energy, data.preferences.energyLabels) : '',
        m.emotionIds.map((id) => emo.get(id) ?? id).join(', '),
        ...INDICATOR_KEYS.map((k) => m.indicators[k] ?? ''),
        m.sleepHours ?? '',
        m.itemIds.map((id) => items.get(id) ?? id).join(', '),
        m.tags.join(', '),
        m.note,
        created(m.createdAt),
        created(m.updatedAt),
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
    'escrito_em',
  ];
  const rows = data.experiences
    .filter((x) => (!from || x.at.slice(0, 10) >= from.slice(0, 10)) && (!to || x.at.slice(0, 10) <= to.slice(0, 10)))
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
        created(x.createdAt),
      ];
    });
  return toCsv([header, ...rows]);
}

export function indicatorHeaderLabels() {
  return INDICATOR_KEYS.map((k) => INDICATORS[k].label);
}

export function eventsCsv(data: AppData): string {
  const header = ['id', 'inicio', 'fim', 'tipo', 'titulo', 'descricao', 'marcadores', 'escrito_em'];
  const rows = [...data.events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [e.id, e.date, e.endDate ?? '', e.category, e.title, e.description, e.tags.join(', '), created(e.createdAt)]);
  return toCsv([header, ...rows]);
}
