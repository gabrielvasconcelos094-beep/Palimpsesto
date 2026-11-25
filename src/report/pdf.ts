/**
 * Relatório pessoal em PDF, gerado no aparelho (jsPDF, sem rede).
 * Usa as fontes padrão do PDF (Times/Helvetica, codificação WinAnsi, que
 * cobre o português); caracteres fora dela são substituídos.
 */
import { jsPDF } from 'jspdf';
import type { AppData } from '../domain/schema';
import {
  buckets,
  emotionFrequency,
  energyCounts,
  inPeriod,
  indicatorCounts,
  mostUsedItems,
  shares,
  tagFrequency,
  valenceCounts,
  type Period,
} from '../domain/analytics';
import { CONFIDENCE_LABELS, energyLabel, INDICATORS, OUTCOME_LABELS, OUTCOME_ORDER, valenceLabel } from '../domain/scales';
import type { Tokens } from '../theme/tokens';
import { activityStats, dayPartStats, shareBy, weekdayHighlight, weekdayStats, WEEKDAYS_FULL } from '../domain/insights';
import { dayKey as dayStr } from '../domain/util';
import { changes, recordSeries, segments, timeTicks } from '../domain/series';

import { type ReportSection } from './sections';

const clean = (s: string) =>
  s
    .replace(/[−–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '');

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmt = (iso: string) => {
  const d = iso.length <= 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const hex = (h: string): [number, number, number] => {
  const m = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)) as [number, number, number];
};

export function buildReport(
  data: AppData,
  period: Period,
  sections: ReportSection[],
  tokens: Tokens,
  opts: { entryFilter?: (m: AppData['moodEntries'][number]) => boolean; filterLabel?: string } = {},
): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 18;
  const CW = W - 2 * M;
  let y = M;
  const ink = hex(tokens.dark ? '#222222' : tokens.ink);
  const soft: [number, number, number] = [110, 110, 110];
  const accent = hex(tokens.dark ? '#555555' : tokens.primaryInk);
  const mood = tokens.mood.map(hex);
  const prefs = data.preferences;
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const entries = data.moodEntries.filter((m) => inPeriod(m.at, period) && (!opts.entryFilter || opts.entryFilter(m))).sort((a, b) => a.at.localeCompare(b.at));
  const exps = data.experiences.filter((x) => inPeriod(x.at, period)).sort((a, b) => a.at.localeCompare(b.at));

  const ensure = (h: number) => {
    if (y + h > 297 - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, o: { size?: number; font?: 'times' | 'helvetica'; style?: string; color?: [number, number, number]; gap?: number; x?: number; width?: number } = {}) => {
    const size = o.size ?? 10;
    doc.setFont(o.font ?? 'helvetica', o.style ?? 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(o.color ?? ink));
    const lines = doc.splitTextToSize(clean(s), o.width ?? CW) as string[];
    const lh = size * 0.42;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, o.x ?? M, y + lh * 0.8);
      y += lh;
    }
    y += o.gap ?? 1.5;
  };
  const heading = (s: string) => {
    ensure(20);
    y += 4;
    text(s, { size: 16, font: 'times', style: 'bold', color: accent, gap: 1 });
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + 24, y);
    y += 5;
  };
  const sub = (s: string) => {
    ensure(10);
    text(s, { size: 11, style: 'bold', gap: 1.5 });
  };
  const barRows = (labels: string[], counts: number[], colors: Array<[number, number, number]>) => {
    const sh = shares(counts);
    const max = Math.max(...sh, 0.0001);
    for (let i = 0; i < labels.length; i++) {
      ensure(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(clean(labels[i]).slice(0, 34), M, y + 3.5);
      doc.setFillColor(235, 235, 235);
      doc.roundedRect(M + 58, y + 1, CW - 82, 3.6, 1.5, 1.5, 'F');
      if (counts[i]) {
        doc.setFillColor(...colors[i % colors.length]);
        doc.roundedRect(M + 58, y + 1, Math.max(1.2, ((CW - 82) * sh[i]) / max), 3.6, 1.5, 1.5, 'F');
      }
      doc.setTextColor(...soft);
      doc.text(`${counts[i]} (${Math.round(sh[i] * 100)}%)`, W - M, y + 3.5, { align: 'right' });
      y += 6.2;
    }
    y += 2;
  };

  /* Capa */
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...ink);
  doc.text('Palimpsesto', M, y + 10);
  y += 16;
  text('Relatório pessoal', { size: 13, font: 'times', style: 'italic', color: soft, gap: 4 });
  text(`Período: ${fmt(period.from.toISOString())} a ${fmt(period.to.toISOString())}`, { size: 10 });
  text(`Gerado em ${fmt(new Date().toISOString())}, no próprio aparelho.`, { size: 9, color: soft, gap: opts.filterLabel ? 1 : 4 });
  if (opts.filterLabel) text(`Registros de humor filtrados: ${opts.filterLabel}.`, { size: 9, color: soft, gap: 4 });
  text(
    'Este relatório reúne registros pessoais de auto-observação. Não é um documento clínico nem um diagnóstico. As escalas são ordinais: os números indicam contagens e proporções, não médias. Associações não indicam causa.',
    { size: 8.5, color: soft, gap: 6 },
  );

  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, prefs.valenceLabels));
  const custom = prefs.valenceLabels.some(Boolean);

  if (sections.includes('summary')) {
    heading('Resumo do período');
    const days = new Set(entries.map((e) => e.at.slice(0, 10))).size;
    text(`Registros de humor: ${entries.length}, em ${days} dia(s).`);
    text(`Experiências registradas: ${exps.length}.`);
    text(`Descobertas ativas: ${data.discoveries.filter((d) => d.status === 'active').length}.`);
    const uses = data.uses.filter((u) => inPeriod(u.at, period));
    text(`Usos de estratégias e recursos avaliados: ${uses.length}.`);
    if (custom) text(`Nomes personalizados da escala: ${vLabels.join(' / ')} (valores fixos de -2 a +2).`, { size: 9, color: soft });
  }

  if (sections.includes('valence') && entries.length) {
    heading('Valência');
    sub('Distribuição');
    barRows(vLabels, valenceCounts(entries), mood);
    const b = buckets(entries, period, (e) => e.valence + 2, prefs.weekStartsOn);
    const items = b.items.slice(-26);
    sub(`Evolução (${b.unit === 'day' ? 'por dia' : b.unit === 'week' ? 'por semana' : 'por mês'})`);
    const H = 34;
    ensure(H + 10);
    const max = Math.max(1, ...items.map((i) => i.total));
    const colW = CW / items.length;
    const bw = Math.min(6, colW * 0.7);
    doc.setDrawColor(200, 200, 200);
    doc.line(M, y + H, M + CW, y + H);
    items.forEach((it, i) => {
      let top = y + H;
      it.counts.forEach((c, k) => {
        if (!c) return;
        const h = (c / max) * H;
        top -= h;
        doc.setFillColor(...mood[k]);
        doc.rect(M + i * colW + (colW - bw) / 2, top + 0.3, bw, Math.max(0.4, h - 0.6), 'F');
      });
      if (i % Math.ceil(items.length / 8) === 0) {
        doc.setFontSize(7);
        doc.setTextColor(...soft);
        doc.text(clean(it.label), M + i * colW + colW / 2, y + H + 4, { align: 'center' });
      }
    });
    y += H + 8;
    // legenda
    let x = M;
    doc.setFontSize(8);
    vLabels.forEach((l, i) => {
      doc.setFillColor(...mood[i]);
      doc.circle(x + 1.5, y + 1.5, 1.4, 'F');
      doc.setTextColor(...ink);
      doc.text(clean(l), x + 4.5, y + 2.6);
      x += doc.getTextWidth(clean(l)) + 10;
      if (x > W - M - 30) {
        x = M;
        y += 5;
      }
    });
    y += 8;
  }

  if (sections.includes('oscillations') && entries.length) {
    ensure(58 + 56); // título, gráfico e legenda juntos na mesma página
    heading('Oscilações de humor e energia');
    text('Cada ponto é um registro; a linha é interrompida quando passam mais de 3 dias sem registro (ausência não é neutro). Humor e energia usam o mesmo eixo de 5 níveis.', { size: 8.5, color: soft });
    const pts = recordSeries(entries);
    y += 4;
    const H = 58;
    const X0 = M + 8;
    const XW = CW - 10;
    ensure(H + 22);
    const fromMs = new Date(dayStr(period.from) + 'T00:00:00').getTime();
    const toMs = Math.max(new Date(dayStr(period.to) + 'T23:59:59').getTime(), fromMs + 86400000);
    const px = (t: number) => X0 + ((t - fromMs) / (toMs - fromMs)) * XW;
    const py = (lv: number) => y + ((5 - lv) / 4) * H;
    doc.setLineWidth(0.15);
    for (let lv = 1; lv <= 5; lv++) {
      doc.setDrawColor(215, 215, 215);
      doc.line(X0, py(lv), X0 + XW, py(lv));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...soft);
      doc.text(String(lv), M + 3, py(lv) + 1, { align: 'center' });
    }
    // energia (tracejada) por baixo; humor (contínua) por cima
    const drawLine = (key: 'mood' | 'energy') => {
      for (const seg of segments(pts, key)) {
        doc.setLineWidth(0.5);
        doc.setDrawColor(...(key === 'mood' ? ink : accent));
        doc.setLineDashPattern(key === 'energy' ? [1.8, 1.2] : [], 0);
        for (let i = 1; i < seg.points.length; i++) doc.line(px(seg.points[i - 1].t), py(seg.points[i - 1].v), px(seg.points[i].t), py(seg.points[i].v));
        doc.setLineDashPattern([], 0);
      }
    };
    if (pts.some((p) => p.energy !== null)) drawLine('energy');
    drawLine('mood');
    const dense = pts.length > 90;
    for (const p of pts) {
      if (dense) break;
      if (p.energy !== null) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.3);
        doc.rect(px(p.t) - 0.9, py(p.energy) - 0.9, 1.8, 1.8, 'FD');
      }
      if (p.mood !== null) {
        doc.setFillColor(...mood[p.mood - 1]);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.25);
        doc.circle(px(p.t), py(p.mood), 1.1, 'FD');
      }
    }
    doc.setFontSize(7);
    doc.setTextColor(...soft);
    for (const t of timeTicks(fromMs, toMs, 6)) {
      const d = new Date(t);
      doc.text(`${d.getDate()} ${MONTHS[d.getMonth()]}`, px(t), y + H + 4, { align: 'center' });
    }
    y += H + 8;
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.text(`Humor (linha contínua): 1 = ${vLabels[0]} ... 5 = ${vLabels[4]}`, M, y);
    y += 4;
    if (pts.some((p) => p.energy !== null)) {
      doc.text(`Energia (tracejada): 1 = ${energyLabel(1, prefs.energyLabels)} ... 5 = ${energyLabel(5, prefs.energyLabels)}`, M, y);
      y += 4;
    }
    const cm = changes(pts, 'mood');
    if (cm.total) text(`Entre pontos consecutivos (sem lacuna), o humor subiu ${cm.up} vez(es), desceu ${cm.down} e ficou igual ${cm.same}.`, { size: 8.5, color: soft, gap: 3 });
  }

  if (sections.includes('energy') && entries.length) {
    const ec = energyCounts(entries);
    if (ec.some(Boolean) || prefs.enabledIndicators.length) heading('Energia e indicadores');
    if (ec.some(Boolean)) {
      sub('Energia');
      barRows([1, 2, 3, 4, 5].map((e) => energyLabel(e, prefs.energyLabels)), ec, [hex(tokens.dark ? '#666666' : tokens.primaryInk)]);
    }
    for (const k of prefs.enabledIndicators) {
      const c = indicatorCounts(entries, k);
      if (!c.some(Boolean)) continue;
      sub(INDICATORS[k].label);
      barRows(INDICATORS[k].levels, c, [hex(tokens.dark ? '#666666' : tokens.comp1Ink)]);
    }
  }

  if (sections.includes('emotions') && entries.length) {
    heading('Emoções e contextos');
    const ef = emotionFrequency(entries).slice(0, 12);
    if (ef.length) {
      sub('Emoções mais presentes (em quantos registros apareceram)');
      ef.forEach((e) => text(`${emo.get(e.id) ?? '?'}: ${e.count} (${Math.round(e.share * 100)}%)`, { size: 9.5, gap: 0.6 }));
      y += 2;
    }
    const tf = tagFrequency(entries).slice(0, 12);
    if (tf.length) {
      sub('Contextos mais marcados');
      text(tf.map((t) => `${t.tag} (${t.count})`).join(' · '), { size: 9.5 });
    }
  }

  if (sections.includes('events')) {
    const from = dayStr(period.from);
    const to = dayStr(period.to);
    const evs = data.events.filter((e) => (e.endDate ?? e.date) >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    if (evs.length) {
      heading('Acontecimentos');
      text('O que estava acontecendo no período. Estar no mesmo período não indica relação de causa com o humor.', { size: 8.5, color: soft });
      for (const e of evs) {
        const during = entries.filter((m) => m.at.slice(0, 10) >= e.date && m.at.slice(0, 10) <= (e.endDate ?? e.date));
        text(`${fmt(e.date)}${e.endDate && e.endDate !== e.date ? ` a ${fmt(e.endDate)}` : ''} - ${e.title}`, { size: 10.5, style: 'bold', gap: 0.6 });
        if (e.description) text(e.description.slice(0, 500), { size: 9.5, gap: 0.6 });
        if (during.length) {
          const c = valenceCounts(during);
          text(`${during.length} registro(s) de humor no período: ${c.map((n, i) => (n ? `${vLabels[i]} ${n}` : '')).filter(Boolean).join(', ')}.`, { size: 8.5, color: soft, gap: 2.5 });
        } else y += 2;
      }
    }
  }

  if (sections.includes('weekdays') && entries.length) {
    heading('Dias da semana e horários');
    const ws = weekdayStats(entries);
    text('Proporção de avaliações agradáveis por dia da semana (cada data pesa o mesmo).', { size: 8.5, color: soft });
    for (const d of [1, 2, 3, 4, 5, 6, 0]) {
      const s = ws[d];
      text(
        `${WEEKDAYS_FULL[d]}: ${s.records ? `${Math.round(shareBy(s.entries, (m) => m.valence >= 1, 'day') * 100)}% agradáveis` : 'sem registros'} (${s.records} registro(s), ${s.dates} data(s))${s.dates < 3 && s.records ? ' - poucos dados' : ''}`,
        { size: 9.5, gap: 0.5 },
      );
    }
    const best = weekdayHighlight(entries, (m) => m.valence >= 1, 'day');
    y += 2;
    text(best.ok ? `Nos registros disponíveis, ${best.h.label} apresentou a maior proporção de avaliações agradáveis (${Math.round(best.h.share * 100)}%). Isso descreve os dados, não estabelece um melhor dia.` : best.reason, { size: 9, gap: 3 });
    const parts = dayPartStats(entries);
    for (const p of parts.parts) if (p.records) text(`${p.label}: ${p.records} registro(s), ${Math.round((p.entries.filter((m) => m.valence >= 1).length / p.records) * 100)}% agradáveis`, { size: 9.5, gap: 0.5 });
    if (parts.untimed) text(`${parts.untimed} registro(s) sem horário não entram nos períodos do dia.`, { size: 8.5, color: soft });
  }

  if (sections.includes('activities')) {
    const acts = activityStats(entries).filter((a) => data.repertoire.some((i) => i.id === a.itemId));
    if (acts.length) {
      heading('Atividades nos registros');
      text('Proporção de registros agradáveis com cada atividade e nos demais registros. Associação, não efeito.', { size: 8.5, color: soft });
      for (const a of acts.slice(0, 15))
        text(
          `${data.repertoire.find((i) => i.id === a.itemId)!.name}: ${a.records} registro(s) em ${a.dates} data(s) - ${Math.round(a.pleasantShare * 100)}% agradáveis (demais: ${Math.round(a.othersPleasantShare * 100)}%)${a.records < 5 ? ' - poucos dados' : ''}`,
          { size: 9.5, gap: 0.6 },
        );
    }
  }

  if (sections.includes('experiences') && exps.length) {
    heading('Experiências');
    for (const x of exps) {
      ensure(18);
      text(`${fmt(x.at)} - ${x.title || 'Experiência'}`, { size: 11, font: 'times', style: 'bold', gap: 0.8 });
      if (x.whatHappened) text(x.whatHappened.slice(0, 900), { size: 9.5, gap: 0.8 });
      const fb = x.feelingBefore !== null ? valenceLabel(x.feelingBefore, prefs.valenceLabels) : null;
      const fa = x.feelingAfter !== null ? valenceLabel(x.feelingAfter, prefs.valenceLabels) : null;
      if (fb || fa) text(`Antes: ${fb ?? '-'} · Depois: ${fa ?? '-'}`, { size: 9, color: soft, gap: 0.8 });
      if (x.whatHelped) text(`Ajudou: ${x.whatHelped.slice(0, 400)}`, { size: 9.5, gap: 0.8 });
      if (x.whatWorsened) text(`Piorou: ${x.whatWorsened.slice(0, 400)}`, { size: 9.5, gap: 0.8 });
      if (x.learned) text(`Aprendizado: ${x.learned.slice(0, 600)}`, { size: 9.5, font: 'times', style: 'italic', gap: 0.8 });
      y += 3;
    }
  }

  if (sections.includes('strategies')) {
    const used = mostUsedItems(data, period);
    if (used.length) {
      heading('Repertório e estratégias');
      text('Avaliações registradas no período, por item.', { size: 9, color: soft });
      for (const u of used) {
        ensure(10);
        text(u.item!.name, { size: 10.5, style: 'bold', gap: 0.6 });
        text(
          OUTCOME_ORDER.filter((o) => u.counts[o])
            .map((o) => `${OUTCOME_LABELS[o]}: ${u.counts[o]}`)
            .join(' · '),
          { size: 9.5, gap: 2.5 },
        );
      }
    }
  }

  if (sections.includes('discoveries')) {
    const ds = data.discoveries.filter((d) => d.status === 'active').sort((a, b) => b.at.localeCompare(a.at));
    if (ds.length) {
      heading('Descobertas');
      for (const d of ds) {
        ensure(12);
        text(d.title, { size: 11, font: 'times', style: 'bold', gap: 0.6 });
        text(`${CONFIDENCE_LABELS[d.confidence].label} · ${fmt(d.at)}`, { size: 8.5, color: soft, gap: 0.8 });
        if (d.description) text(d.description.slice(0, 700), { size: 9.5, gap: 3 });
        else y += 2;
      }
    }
  }

  if (sections.includes('moodLog') && entries.length) {
    heading('Registros de humor');
    for (const m of entries) {
      const d = new Date(m.at);
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const parts = [
        valenceLabel(m.valence, prefs.valenceLabels),
        m.energy ? energyLabel(m.energy, prefs.energyLabels) : '',
        m.emotionIds.map((i) => emo.get(i)).filter(Boolean).join(', '),
        m.tags.length ? `#${m.tags.join(' #')}` : '',
      ].filter(Boolean);
      const retro = dayStr(new Date(m.createdAt)) > m.at.slice(0, 10) ? ` (escrito em ${fmt(m.createdAt)})` : '';
      text(`${fmt(m.at)} ${m.timePrecision === 'day' ? '' : time} - ${parts.join(' · ')}${retro}`, { size: 9, gap: 0.4 });
      if (m.note) text(m.note.slice(0, 500), { size: 8.5, color: soft, x: M + 4, width: CW - 4, gap: 1 });
    }
  }

  if (sections.includes('map')) {
    const qMap = new Map(data.questions.map((q) => [q.id, q]));
    const answered = data.answers.filter((a) => a.text.trim());
    if (answered.length) {
      heading('Respostas do Mapa');
      for (const s of [...data.sections].sort((a, b) => a.order - b.order)) {
        const list = answered.filter((a) => qMap.get(a.questionId)?.sectionId === s.id);
        if (!list.length) continue;
        sub(s.title);
        for (const a of list) {
          text(qMap.get(a.questionId)!.text, { size: 9, color: soft, gap: 0.6 });
          text(a.text.slice(0, 1500), { size: 10, font: 'times', gap: 3 });
        }
      }
    }
  }

  // Rodapé com numeração
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...soft);
    doc.text(`Palimpsesto · ${i}/${pages}`, W - M, 297 - 8, { align: 'right' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
