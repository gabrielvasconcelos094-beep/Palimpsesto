import { useMemo, useState } from 'react';
import { navigate } from '../../app/router';
import { changes, buildSeries, gapCount, type SeriesMode } from '../../domain/series';
import { Segmented } from '../../ui/components';
import { LineChart, SeriesTable } from './LineChart';
import { useTrajectory } from './useTrajectory';

/**
 * Oscilações de humor e energia ao longo do tempo (gráfico em linha). Respeita o período e os
 * filtros da Trajetória. Na versão compacta (visão geral) mostra só o gráfico.
 */
export function OscillationPanel({ compact }: { compact?: boolean }) {
  const t = useTrajectory();
  const hasEnergy = t.entries.some((m) => m.energy);
  const [showMood, setShowMood] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [mode, setMode] = useState<SeriesMode>('record');
  const points = useMemo(() => buildSeries(t.entries, mode), [t.entries, mode]);
  const energyOn = showEnergy && hasEnergy;
  const moodOn = showMood || !energyOn; // sempre ao menos uma linha
  const nMood = points.filter((p) => p.mood !== null).length;
  const nEnergy = points.filter((p) => p.energy !== null).length;
  const dates = new Set(t.entries.map((m) => m.at.slice(0, 10))).size;
  const cm = changes(points, 'mood');
  const ce = changes(points, 'energy');
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

  return (
    <div className="stack lg">
      <div className="chips" role="group" aria-label="Séries do gráfico">
        <button className="chip" aria-pressed={moodOn} onClick={() => (energyOn ? setShowMood(!showMood) : setShowMood(true))}>
          Humor
        </button>
        <button className="chip" aria-pressed={energyOn} disabled={!hasEnergy} onClick={() => setShowEnergy(!showEnergy)} title={hasEnergy ? undefined : 'Nenhum registro com energia neste recorte'}>
          Energia
        </button>
      </div>
      {!compact && (
        <Segmented
          ariaLabel="Unidade do gráfico"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'record', label: 'Cada registro' },
            { value: 'day', label: 'Resumo por data' },
          ]}
        />
      )}
      <LineChart points={points} showMood={moodOn} showEnergy={energyOn} from={t.range.from} to={t.range.to} mode={mode} height={compact ? 190 : 240} />

      {compact ? (
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => navigate('/trajetoria/oscilacoes')}>
          Ver em detalhe
        </button>
      ) : (
        <>
          <div className="card tight small stack" style={{ gap: 6 }}>
            <div>
              <strong>{t.entries.length}</strong> registro(s) em <strong>{dates}</strong> data(s) neste recorte.
              {mode === 'day' ? ' Cada ponto é o resultado da data: a média dos registros, arredondada ao nível mais próximo (no empate, para longe do neutro).' : ''}
            </div>
            {moodOn && cm.total > 0 && (
              <div>
                <strong>Humor:</strong> entre pontos consecutivos (sem lacuna), subiu em {cm.up} ({pct(cm.up, cm.total)}), desceu em {cm.down} ({pct(cm.down, cm.total)}) e ficou igual em {cm.same} (
                {pct(cm.same, cm.total)}). {gapCount(points, 'mood') ? `${gapCount(points, 'mood')} lacuna(s) de mais de 3 dias.` : ''}
              </div>
            )}
            {energyOn && ce.total > 0 && (
              <div>
                <strong>Energia:</strong> subiu em {ce.up} ({pct(ce.up, ce.total)}), desceu em {ce.down} ({pct(ce.down, ce.total)}) e ficou igual em {ce.same} ({pct(ce.same, ce.total)}).
              </div>
            )}
            {(moodOn ? nMood : nEnergy) < 8 && <div className="faint">Ainda são poucos pontos para ver oscilações com segurança.</div>}
            <div className="faint">Descrição dos seus registros: variações entre um ponto e o seguinte não indicam causa nem padrão clínico.</div>
          </div>
          <SeriesTable points={points} showMood={moodOn} showEnergy={energyOn} />
        </>
      )}
    </div>
  );
}
