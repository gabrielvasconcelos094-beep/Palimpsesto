/**
 * Categorias da Trajetória. Cada uma responde a perguntas concretas e diz
 * qual unidade de análise usou e quantos registros sustentam o resultado.
 */
import type { ReactNode } from 'react';
import { Activity, BatteryLow, Brain, CalendarDays, ChartLine, Clock, Flag, GitCompareArrows, Heart, Layers3, Moon, Repeat2 } from 'lucide-react';
import { OscillationPanel } from './Oscillations';
import { useRoute } from '../../app/router';
import { Empty, Page } from '../../ui/components';
import { PeriodBar } from './Trajectory';
import { useTrajectory } from './useTrajectory';
import { DaysBody } from './categories/days';
import { EmotionsBody } from './categories/emotions';
import { EnergyBody } from './categories/energy';
import { ActivitiesBody } from './categories/activities';
import { EvolutionBody } from './categories/evolution';
import { TimelineBody } from './categories/timeline';
import { ContextsBody } from './categories/contexts';
import { CalendarBody } from './categories/calendar';
import { ThoughtsBody } from './categories/thoughts';
import { RegularityBody } from './categories/regularity';
import { SleepBody } from './categories/sleep';

export const CATEGORIES = [
  { id: 'oscilacoes', title: 'Oscilações', question: 'Gráfico em linha: como humor e energia variaram ao longo do tempo?', icon: ChartLine },
  { id: 'dias', title: 'Dias e horários', question: 'Há dias da semana ou horários diferentes dos outros?', icon: Clock },
  { id: 'emocoes', title: 'Emoções', question: 'Quais emoções aparecem, juntas ou separadas?', icon: Heart },
  { id: 'energia', title: 'Energia e disposição', question: 'Como sua energia varia e o que a acompanha?', icon: BatteryLow },
  { id: 'sono', title: 'Sono', question: 'Quanto e com que regularidade você dormiu — e o que acompanhou isso?', icon: Moon },
  { id: 'atividades', title: 'Atividades e estratégias', question: 'O que você fez e como avaliou o que tentou?', icon: Activity },
  { id: 'pensamentos', title: 'Pensamentos', question: 'O que passa pela cabeça nas experiências — e como você tem examinado isso?', icon: Brain },
  { id: 'evolucao', title: 'Evolução e comparação', question: 'Como as coisas mudaram ao longo do tempo?', icon: GitCompareArrows },
  { id: 'linha', title: 'Linha do tempo', question: 'O que estava acontecendo em cada período?', icon: Flag },
  { id: 'contextos', title: 'Padrões por contexto', question: 'Que marcadores aparecem associados a quê?', icon: Layers3 },
  { id: 'calendario', title: 'Calendário emocional', question: 'Mês a mês, o ano dia a dia, semanas, estações e anos.', icon: CalendarDays },
  { id: 'regularidade', title: 'Regularidade dos registros', question: 'Quando você costuma registrar (só descritivo).', icon: Repeat2 },
] as const;

/* ------------------------------------------------------------------------ */
export function TrajectoryCategory() {
  const route = useRoute();
  const cat = CATEGORIES.find((c) => c.id === route.parts[1]);
  const t = useTrajectory();
  if (!cat)
    return (
      <Page back="/trajetoria" noNav title="Categoria não encontrada">
        <span />
      </Page>
    );
  const Body = BODIES[cat.id];
  return (
    <Page back="/trajetoria" noNav kicker="Trajetória" title={cat.title} subtitle={cat.question} ghost={cat.title.split(' ')[0].toLowerCase()}>
      {cat.id !== 'calendario' && <PeriodBar />}
      <div style={{ marginTop: 8 }}>{t.entries.length === 0 && cat.id !== 'linha' && cat.id !== 'atividades' && cat.id !== 'calendario' && cat.id !== 'pensamentos' ? <Empty title="Sem registros neste recorte">Escolha outro período ou ajuste os filtros.</Empty> : <Body />}</div>
    </Page>
  );
}

const BODIES: Record<(typeof CATEGORIES)[number]['id'], () => ReactNode> = {
  oscilacoes: () => <OscillationPanel />,
  dias: DaysBody,
  emocoes: EmotionsBody,
  energia: EnergyBody,
  sono: SleepBody,
  atividades: ActivitiesBody,
  evolucao: EvolutionBody,
  pensamentos: ThoughtsBody,
  linha: TimelineBody,
  contextos: ContextsBody,
  calendario: CalendarBody,
  regularidade: RegularityBody,
};

