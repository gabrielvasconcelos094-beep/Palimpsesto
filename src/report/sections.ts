/** Seções disponíveis no relatório em PDF (separado para não carregar o jsPDF à toa). */
export const REPORT_SECTIONS = {
  summary: 'Resumo do período',
  valence: 'Valência e evolução',
  energy: 'Energia e indicadores',
  emotions: 'Emoções e contextos',
  experiences: 'Experiências',
  strategies: 'Repertório e estratégias',
  discoveries: 'Descobertas',
  moodLog: 'Lista detalhada dos registros de humor',
  map: 'Respostas do Mapa',
} as const;
export type ReportSection = keyof typeof REPORT_SECTIONS;
export const DEFAULT_SECTIONS: ReportSection[] = ['summary', 'valence', 'energy', 'emotions', 'experiences', 'strategies', 'discoveries'];

