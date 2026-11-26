/** Seções disponíveis no relatório em PDF (separado para não carregar o jsPDF à toa). */
export const REPORT_SECTIONS = {
  summary: 'Resumo do período',
  valence: 'Valência e evolução',
  oscillations: 'Oscilações de humor e energia (gráfico em linha)',
  energy: 'Energia e indicadores',
  emotions: 'Emoções e contextos',
  experiences: 'Experiências',
  strategies: 'Repertório e estratégias',
  discoveries: 'Descobertas',
  moodLog: 'Lista detalhada dos registros de humor',
  map: 'Respostas do Mapa',
  weekdays: 'Dias da semana e horários',
  activities: 'Atividades nos registros',
  events: 'Acontecimentos da linha do tempo (inclui medicação)',
  assessments: 'Questionários (PHQ-9 e GAD-7)',
  sleep: 'Sono',
  agenda: 'Assuntos para a consulta',
  medications: 'Medicamentos (em uso e mudanças)',
} as const;
export type ReportSection = keyof typeof REPORT_SECTIONS;
export const DEFAULT_SECTIONS: ReportSection[] = ['summary', 'valence', 'oscillations', 'energy', 'emotions', 'events', 'experiences', 'strategies', 'discoveries'];
/** Resumo enxuto para levar à consulta (psiquiatria/psicologia). */
export const CONSULT_SECTIONS: ReportSection[] = ['summary', 'agenda', 'medications', 'assessments', 'oscillations', 'valence', 'sleep', 'energy', 'emotions', 'events'];

