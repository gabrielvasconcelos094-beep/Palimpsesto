import { useMemo, useState } from 'react';
import { ChevronRight, EyeOff, FileText, Lightbulb, Settings2, SlidersHorizontal } from 'lucide-react';
import { navigate } from '../../app/router';
import { store } from '../../app/store';
import { toast } from '../../app/toast';
import { valenceCounts } from '../../domain/analytics';
import { activeCount, describeFilters, NO_FILTERS, PERIOD_LABELS, type PeriodKind } from '../../domain/filters';
import { buildInsights, distributionBy, type Unit } from '../../domain/insights';
import { valenceLabel } from '../../domain/scales';
import { Empty, fmtDate, Page, Section, Segmented, Sheet, Toggle } from '../../ui/components';
import { FilterSheet, FilterSummary } from '../../ui/FilterSheet';
import { ValenceMark } from '../../ui/pickers';
import { Distribution } from './charts';
import { CATEGORIES } from './categories';
import { OscillationPanel } from './Oscillations';
import { useTrajectory } from './useTrajectory';

export const MOOD_COLORS = [1, 2, 3, 4, 5].map((i) => `var(--mood-${i})`);
export const ENERGY_COLORS = [1, 2, 3, 4, 5].map((i) => `var(--energy-${i})`);

/** Seletor de período + filtros (reutilizado nas categorias). */
export function PeriodBar() {
  const t = useTrajectory();
  const [open, setOpen] = useState(false);
  const labels = t.data.preferences.valenceLabels;
  const p = t.period;
  return (
    <>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="chips grow" role="group" aria-label="Período">
          {(['7d', '30d', '90d', '365d', 'all', 'custom'] as PeriodKind[]).map((k) => (
            <button key={k} className="chip" aria-pressed={p.kind === k} onClick={() => t.setPeriod({ ...p, kind: k, from: p.from ?? t.range.from, to: p.to ?? t.range.to })}>
              {PERIOD_LABELS[k]}
            </button>
          ))}
        </div>
        <button className="icon-btn" aria-label={`Filtrar registros${activeCount(t.filters, false) ? ' (ativos)' : ''}`} onClick={() => setOpen(true)} style={activeCount(t.filters, false) ? { color: 'var(--primary-ink)' } : undefined}>
          <SlidersHorizontal size={20} strokeWidth={1.6} />
        </button>
      </div>
      {p.kind === 'custom' && (
        <div className="grid-2" style={{ marginTop: 8 }}>
          <input type="date" className="input" aria-label="De" value={p.from ?? ''} max={p.to ?? undefined} onChange={(e) => e.target.value && t.setPeriod({ ...p, from: e.target.value })} />
          <input type="date" className="input" aria-label="Até" value={p.to ?? ''} min={p.from ?? undefined} onChange={(e) => e.target.value && t.setPeriod({ ...p, to: e.target.value })} />
        </div>
      )}
      <p className="xs faint" style={{ margin: '8px 0 0' }}>
        {fmtDate(t.range.from, { short: true, withYear: true })} a {fmtDate(t.range.to, { short: true, withYear: true })} · considera a data em que cada registro aconteceu
      </p>
      <FilterSummary items={describeFilters({ ...t.filters, type: 'all' }, t.data, (v) => valenceLabel(v, labels), false)} onClear={() => t.setFilters(NO_FILTERS)} />
      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        value={t.filters}
        onChange={t.setFilters}
        showType={false}
        showPeriod={false}
        resultLabel={`Ver estatísticas de ${t.entries.length} registro(s)`}
      />
    </>
  );
}

export function Trajectory() {
  const t = useTrajectory();
  const prefs = t.data.preferences;
  const [unit, setUnit] = useState<Unit>('record');
  const [view, setView] = useState<'dist' | 'line'>('dist');
  const [custom, setCustom] = useState(false);
  const labels = prefs.valenceLabels;
  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, labels));
  const daysWith = new Set(t.entries.map((m) => m.at.slice(0, 10))).size;
  const dist = useMemo(() => {
    const vals = t.entries.map((m) => ({ day: m.at.slice(0, 10), v: m.valence + 2 }));
    const pvals = t.prevEntries.map((m) => ({ day: m.at.slice(0, 10), v: m.valence + 2 }));
    // Distribution espera contagens; para "por dia" usamos proporções × 1000 (só as proporções são exibidas).
    const scale = (c: number[]) => c.map((x) => Math.round(x * 1000)) as [number, number, number, number, number];
    return unit === 'record'
      ? { counts: valenceCounts(t.entries), prev: t.period.compare ? valenceCounts(t.prevEntries) : null }
      : { counts: scale(distributionBy(vals, 'day')), prev: t.period.compare ? scale(distributionBy(pvals, 'day')) : null };
  }, [t.entries, t.prevEntries, unit, t.period.compare]);
  const insights = useMemo(() => (prefs.showInsights ? buildInsights(t.data, t.entries, t.uses) : []), [t.data, t.entries, t.uses, prefs.showInsights]);
  const visibleCats = CATEGORIES.filter((c) => !prefs.trajectoryHidden.includes(c.id));

  return (
    <Page title="Trajetória" ghost="caminho" subtitle="O que seus registros mostram — sem julgamento e sem pressa.">
      <PeriodBar />

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card tight stat">
          <span className="n">{t.entries.length}</span>
          <span className="l">registros de humor</span>
        </div>
        <div className="card tight stat">
          <span className="n">{daysWith}</span>
          <span className="l">datas com registro</span>
        </div>
        <div className="card tight stat">
          <span className="n">{t.experiences.length}</span>
          <span className="l">experiências</span>
        </div>
      </div>

      {t.entries.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <Empty title="Sem registros neste recorte">Escolha outro período, ajuste os filtros ou faça um registro — inclusive de dias anteriores. Lacunas não são problema.</Empty>
        </div>
      ) : (
        <Section title={view === 'line' ? 'Oscilações' : 'Valência'} kicker={view === 'line' ? 'Humor e energia ao longo do tempo' : 'Como você tem se sentido'}>
          <div className="card stack lg">
            <Segmented
              ariaLabel="Tipo de gráfico"
              value={view}
              onChange={setView}
              options={[
                { value: 'dist', label: 'Distribuição' },
                { value: 'line', label: 'Linha do tempo' },
              ]}
            />
            {view === 'line' ? (
              <OscillationPanel compact />
            ) : (
              <>
            <Segmented
              ariaLabel="Unidade de análise"
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'record', label: 'Por registro' },
                { value: 'day', label: 'Por data' },
              ]}
            />
            <Distribution
              labels={vLabels}
              colors={MOOD_COLORS}
              counts={dist.counts}
              compare={dist.prev && dist.prev.some(Boolean) ? dist.prev : null}
              marks={(i) => <ValenceMark v={i - 2} size={16} />}
              hideCounts={unit === 'day'}
            />
            <p className="xs muted" style={{ margin: 0 }}>
              {unit === 'record'
                ? `Cada um dos ${t.entries.length} registros conta uma vez.`
                : `Cada uma das ${daysWith} datas pesa o mesmo, mesmo que tenha vários registros.`}{' '}
              Dias sem registro não entram na conta.
            </p>
            <Toggle
              label="Comparar com o período anterior"
              help={t.period.compare ? `${fmtDate(t.prevRange.from, { short: true })} a ${fmtDate(t.prevRange.to, { short: true })} · ${t.prevEntries.length} registro(s)` : undefined}
              checked={t.period.compare}
              onChange={(compare) => t.setPeriod({ ...t.period, compare })}
            />
              </>
            )}
          </div>
        </Section>
      )}

      {prefs.showInsights && (
        <Section title="O que seus registros mostram" kicker="Observações descritivas — você decide o que faz sentido">
          {insights.length === 0 ? (
            <div className="card dashed small muted">
              Nenhuma observação com dados suficientes neste recorte. Elas aparecem sozinhas quando houver registros bastantes para uma comparação cuidadosa.
            </div>
          ) : (
            <div className="stack">
              {insights.slice(0, 5).map((i) => (
                <div key={i.id} className="card tight" style={{ borderLeft: '3px solid var(--comp1-ink)' }}>
                  <p style={{ margin: 0 }}>{i.text}</p>
                  <p className="xs faint" style={{ margin: '6px 0 0' }}>
                    {i.basis}
                  </p>
                  <div className="row wrap" style={{ marginTop: 6, gap: 4 }}>
                    <button
                      className="btn ghost sm"
                      style={{ paddingLeft: 0 }}
                      onClick={() => navigate(`/mapa/descoberta/nova?origem=padrao&titulo=${encodeURIComponent(i.hypothesis)}&texto=${encodeURIComponent(`${i.text}\n\n${i.basis}`)}`)}
                    >
                      <Lightbulb size={14} /> Transformar em hipótese
                    </button>
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        store.setPreferences({ dismissedInsights: [...prefs.dismissedInsights, i.id] });
                        toast('Observação ocultada.');
                      }}
                    >
                      <EyeOff size={14} /> Ocultar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {prefs.dismissedInsights.length > 0 && (
            <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => store.setPreferences({ dismissedInsights: [] })}>
              Mostrar {prefs.dismissedInsights.length} observação(ões) ocultada(s)
            </button>
          )}
        </Section>
      )}

      <Section
        title="Explorar"
        action={
          <button className="btn ghost sm" onClick={() => setCustom(true)}>
            <Settings2 size={14} /> Personalizar
          </button>
        }
      >
        <div className="list">
          {visibleCats.map((c) => (
            <button key={c.id} className="list-row" onClick={() => navigate(`/trajetoria/${c.id}`)}>
              <c.icon size={20} strokeWidth={1.6} className="faint" />
              <div className="grow">
                <div className="title">{c.title}</div>
                <div className="meta">{c.question}</div>
              </div>
              <ChevronRight className="chev" size={18} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Relatório">
        <button className="card row" onClick={() => navigate('/ajustes/dados?secao=relatorio')}>
          <FileText size={22} />
          <div className="grow">
            <div className="h3">Gerar relatório em PDF</div>
            <div className="small muted">Você escolhe o período, as seções e os registros incluídos.</div>
          </div>
        </button>
      </Section>

      <Sheet open={custom} onClose={() => setCustom(false)} title="Personalizar a Trajetória">
        <div className="stack lg">
          <div className="list">
            <Toggle
              label="O que seus registros mostram"
              help="Observações sugeridas a partir dos seus dados. Nunca enviam avisos."
              checked={prefs.showInsights}
              onChange={(showInsights) => store.setPreferences({ showInsights })}
            />
          </div>
          <p className="kicker" style={{ margin: 0 }}>
            Categorias visíveis
          </p>
          <div className="list">
            {CATEGORIES.map((c) => (
              <Toggle
                key={c.id}
                label={c.title}
                checked={!prefs.trajectoryHidden.includes(c.id)}
                onChange={(on) => store.setPreferences({ trajectoryHidden: on ? prefs.trajectoryHidden.filter((x) => x !== c.id) : [...prefs.trajectoryHidden, c.id] })}
              />
            ))}
          </div>
        </div>
      </Sheet>
    </Page>
  );
}
