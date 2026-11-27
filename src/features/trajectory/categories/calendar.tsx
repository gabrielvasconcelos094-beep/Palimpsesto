import { useMemo, useState } from 'react';
import { dayResults, seasonsAll, seasonsRows, SEASON_LABELS, weeksOfYear, yearsRows } from '../../../domain/calendar';
import { store } from '../../../app/store';
import { ValenceMark } from '../../../ui/pickers';
import { navigate } from '../../../app/router';
import { valenceLabel } from '../../../domain/scales';
import type { MoodEntry } from '../../../domain/schema';
import { Empty, fmtDate, MONTHS_SHORT, Section, Segmented } from '../../../ui/components';
import { CalendarView } from '../../journal/Journal';
import { IndexBars } from '../charts';
import { fmtIndex } from '../../../domain/valence';
import { dayKey as dayKeyOf } from '../../../domain/util';
import { MOOD_COLORS } from '../Trajectory';
import { useTrajectory } from '../useTrajectory';
import { Note } from './shared';

export function CalendarBody() {
  const t = useTrajectory();
  const data = t.data;
  const all = data.moodEntries;
  const [view, setView] = useState<'mes' | 'ano' | 'semanas' | 'estacoes' | 'anos'>('mes');
  const [year, setYear] = useState(new Date().getFullYear());
  const firstYear = all.length ? Number([...all].sort((a, b) => a.at.localeCompare(b.at))[0].at.slice(0, 4)) : year;
  const thisYear = new Date().getFullYear();
  const yearNav = (
    <div className="row between" style={{ marginBottom: 10 }}>
      <button className="icon-btn" aria-label="Ano anterior" disabled={year <= firstYear} onClick={() => setYear(year - 1)}>
        ‹
      </button>
      <div className="h3">{year}</div>
      <button className="icon-btn" aria-label="Próximo ano" disabled={year >= thisYear} onClick={() => setYear(year + 1)}>
        ›
      </button>
    </div>
  );
  return (
    <>
      <div className="chips" role="group" aria-label="Visão do calendário">
        {(
          [
            ['mes', 'Mês'],
            ['ano', 'Ano dia a dia'],
            ['semanas', 'Semanas'],
            ['estacoes', 'Estações'],
            ['anos', 'Anos'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={view === k} onClick={() => setView(k)}>
            {l}
          </button>
        ))}
      </div>
      {all.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <Empty title="Nenhum registro de humor ainda">O calendário se preenche com os seus registros — inclusive os de dias anteriores.</Empty>
        </div>
      ) : view === 'mes' ? (
        <CalendarView entries={all} events={data.events} experiences={data.experiences} onOpen={(id) => navigate(`/diario?registro=${id}`)} />
      ) : view === 'ano' ? (
        <Section title="O ano dia a dia">
          {yearNav}
          <YearPixels entries={all} year={year} />
        </Section>
      ) : view === 'semanas' ? (
        <Section title="Semana a semana">
          {yearNav}
          <WeeksList entries={all} year={year} />
        </Section>
      ) : view === 'estacoes' ? (
        <SeasonsView entries={all} />
      ) : (
        <YearsView entries={all} />
      )}
    </>
  );
}

function YearPixels({ entries, year }: { entries: MoodEntry[]; year: number }) {
  const labels = useTrajectory().data.preferences.valenceLabels;
  const res = useMemo(() => dayResults(entries.filter((m) => m.at.startsWith(String(year)))), [entries, year]);
  const today = dayKeyOf(new Date());
  const n = res.size;
  return (
    <div className="card stack">
      <div className="pixels" role="grid" aria-label={`Humor de cada dia em ${year}`}>
        <div className="px-row" aria-hidden>
          <span className="px-m" />
          {Array.from({ length: 31 }, (_, d) => (
            <span key={d} className="px-h">
              {(d + 1) % 5 === 0 || d === 0 ? d + 1 : ''}
            </span>
          ))}
        </div>
        {MONTHS_SHORT.map((mName, m) => {
          const days = new Date(year, m + 1, 0).getDate();
          return (
            <div key={m} className="px-row" role="row">
              <span className="px-m">{mName}</span>
              {Array.from({ length: 31 }, (_, d) => {
                if (d >= days) return <span key={d} className="px none" aria-hidden />;
                const k = `${year}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
                const r = res.get(k);
                return r ? (
                  <button
                    key={d}
                    role="gridcell"
                    className="px"
                    style={{ background: `var(--mood-${r.result + 3})` }}
                    aria-label={`${d + 1} de ${mName}: ${valenceLabel(r.result, labels)}${r.n > 1 ? ` (${r.n} registros)` : ''}`}
                    onClick={() => navigate(`/diario?de=${k}&ate=${k}`)}
                  />
                ) : (
                  <span key={d} role="gridcell" className={`px empty${k > today ? ' future' : ''}`} aria-label={`${d + 1} de ${mName}: sem registro`} />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="chart-legend">
        {[-2, -1, 0, 1, 2].map((v) => (
          <span key={v}>
            <span className="dot xs" style={{ background: `var(--mood-${v + 3})` }} />
            {valenceLabel(v, labels)}
          </span>
        ))}
      </div>
      <Note>
        {n} dia(s) com registro em {year}. Cada quadrado é o resultado do dia (a média dos registros arredondada ao nível mais próximo). Dias vazios ficam vazios — não contam como neutros. Toque
        num dia para ver os registros.
      </Note>
    </div>
  );
}

function WeeksList({ entries, year }: { entries: MoodEntry[]; year: number }) {
  const ws = useTrajectory().data.preferences.weekStartsOn;
  const labels = useTrajectory().data.preferences.valenceLabels;
  const rows = useMemo(() => weeksOfYear(entries, year, ws).reverse(), [entries, year, ws]);
  if (!rows.length) return <p className="small muted">Nenhuma semana neste ano até hoje.</p>;
  return (
    <div className="card stack" style={{ gap: 0 }}>
      {rows.map((w) => (
        <button key={w.key} className="week-row" disabled={!w.records} onClick={() => navigate(`/diario?de=${w.from}&ate=${w.to}`)} aria-label={`Semana de ${fmtDate(w.from, { short: true })}: ${w.result === null ? 'sem registros' : `${valenceLabel(w.result, labels)}, índice ${fmtIndex(w.index)}`}`}>
          <span className="small" style={{ width: 120 }}>
            {fmtDate(w.from, { short: true })} – {fmtDate(w.to, { short: true })}
          </span>
          <span style={{ width: 28, display: 'inline-grid', placeItems: 'center' }}>{w.result !== null ? <ValenceMark v={w.result} size={22} /> : <span className="faint">·</span>}</span>
          <span className="stackbar grow" style={{ height: 8, opacity: w.records ? 1 : 0.25 }}>
            {w.shares.map((x, i) => (x ? <div key={i} style={{ width: `${x * 100}%`, background: MOOD_COLORS[i] }} /> : null))}
          </span>
          <span className="xs muted" style={{ width: 92, textAlign: 'right' }}>
            {w.records ? `${fmtIndex(w.index)} · ${w.dates} d` : '—'}
          </span>
        </button>
      ))}
      <Note>Símbolo e índice da semana: média das datas (cada data pesa igual), arredondada. A barra mostra os cinco níveis. “d” = datas com registro.</Note>
    </div>
  );
}

function SeasonsView({ entries }: { entries: MoodEntry[] }) {
  const data = useTrajectory().data;
  const hemi = data.preferences.hemisphere;
  const labels = data.preferences.valenceLabels;
  const rows = useMemo(() => seasonsRows(entries, hemi), [entries, hemi]);
  const allS = useMemo(() => seasonsAll(entries, hemi), [entries, hemi]);
  const years = new Set(entries.map((m) => m.at.slice(0, 4))).size;
  return (
    <>
      <Section title="As estações">
        <div className="card stack lg">
          <Segmented
            ariaLabel="Hemisfério"
            value={hemi}
            onChange={(hemisphere) => store.setPreferences({ hemisphere })}
            options={[
              { value: 'south', label: 'Hemisfério Sul' },
              { value: 'north', label: 'Hemisfério Norte' },
            ]}
          />
          <IndexBars
            rows={allS.map((s) => ({
              label: SEASON_LABELS[s.season],
              index: s.index,
              note: `${s.dates} data(s) · ${s.years} ano(s)`,
              dim: s.dates < 10,
            }))}
          />
          <Note>
            Todos os anos somados (cada data pesa igual). Estações pelas datas astronômicas aproximadas do hemisfério escolhido — sem usar sua localização. Com menos de 10 datas, a estação
            aparece esmaecida.
          </Note>
        </div>
      </Section>
      <Section title="Estação a estação">
        <div className="card stack" style={{ gap: 0 }}>
          {rows.map((r) => (
            <button key={r.key} className="week-row" onClick={() => navigate(`/diario?de=${r.from}&ate=${r.to}`)} aria-label={`${r.label}: ${r.result === null ? 'sem registros' : valenceLabel(r.result, labels)}`}>
              <span className="small" style={{ width: 120 }}>
                {r.label}
              </span>
              <span style={{ width: 28, display: 'inline-grid', placeItems: 'center' }}>{r.result !== null && <ValenceMark v={r.result} size={22} />}</span>
              <span className="stackbar grow" style={{ height: 8 }}>
                {r.shares.map((x, i) => (x ? <div key={i} style={{ width: `${x * 100}%`, background: MOOD_COLORS[i] }} /> : null))}
              </span>
              <span className="xs muted" style={{ width: 92, textAlign: 'right' }}>
                {fmtIndex(r.index)} · {r.dates} d
              </span>
            </button>
          ))}
        </div>
      </Section>
      <div className="notice calm small">
        <strong>Sobre padrões sazonais:</strong> a depressão com padrão sazonal só é considerada quando o mesmo padrão se repete por pelo menos dois anos seguidos — e é uma avaliação
        clínica. {years < 2 ? 'Seus registros ainda cobrem menos de dois anos. ' : ''}Perto do equador, as estações mudam pouco a luz do dia. Use isto para observar e levar à consulta, não
        para concluir.
      </div>
    </>
  );
}

function YearsView({ entries }: { entries: MoodEntry[] }) {
  const rows = useMemo(() => yearsRows(entries), [entries]);
  return (
    <Section title="Ano a ano">
      <div className="card stack lg">
        <IndexBars rows={rows.map((r) => ({ label: r.label, index: r.index, note: `${r.records} reg. · ${r.dates} data(s)`, dim: r.dates < 10 }))} />
        {rows.map((r) => (
          <div key={r.key} className="stack" style={{ gap: 4 }}>
            <span className="xs muted">{r.label}</span>
            <div className="stackbar" style={{ height: 10 }}>
              {r.shares.map((x, i) => (x ? <div key={i} style={{ width: `${x * 100}%`, background: MOOD_COLORS[i] }} /> : null))}
            </div>
          </div>
        ))}
        <Note>Índice de −2 a +2 e distribuição dos cinco níveis de cada ano, com peso igual por data. Anos com poucas datas aparecem esmaecidos — compare com cautela.</Note>
      </div>
    </Section>
  );
}
