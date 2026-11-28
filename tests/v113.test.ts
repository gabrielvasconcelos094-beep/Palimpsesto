/**
 * 1.13: medicamentos com o que não se lembra e observações da interrupção; contexto
 * do humor (resumo descritivo); revisão do conteúdo do Mapa; pergunta do dia em
 * rodízio; "Para este momento" (o Guia de volta no Hoje).
 */
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { parseAppData } from '../src/data/validate';
import { emptyData, initialData, reviseBuiltIns, syncBuiltIns, builtInQuestionId } from '../src/data/defaults';
import { AppDataSchema, MedicationSchema, SCHEMA_VERSION, type AppData, type Medication, type MoodEntry } from '../src/domain/schema';
import { doseLabel, fmtFuzzy, insertDose, isActive, medChanges, pastMeds, periodLabel, precisionOf, stopText } from '../src/domain/care';
import { contextSummary } from '../src/domain/analytics';
import { BUILTIN_SECTIONS, SEED_REVISION } from '../src/domain/seed';
import { dailyQuestion, sectionOfDay } from '../src/domain/daily';
import { supportFor, supportTarget } from '../src/domain/support';

const T = '2026-01-01T00:00:00Z';
const med = (p: Partial<Medication>): Medication =>
  MedicationSchema.parse({ id: 'm', createdAt: T, updatedAt: T, name: 'X', startDate: '2020-01-10', doses: [{ date: '2020-01-10', dose: '50 mg' }], ...p }) as Medication;

describe('medicamentos: o que não se lembra', () => {
  it('migração 3 → 4 preserva os medicamentos e acrescenta os campos vazios', () => {
    const v3 = { schemaVersion: 3, medications: [{ id: 'a', createdAt: T, updatedAt: T, name: 'Sertralina', startDate: '2021-03-01', endDate: '2022-01-01', stopReason: 'efeitos', doses: [{ date: '2021-03-01', dose: '50 mg' }] }] };
    const { data, from } = migrate(v3);
    expect(from).toBe(3);
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(data.medications[0]).toMatchObject({ startDate: '2021-03-01', endDate: '2022-01-01', stopReason: 'efeitos', endUnknown: false, stopNote: '' });
    expect(data.medications[0].doses[0]).toMatchObject({ dose: '50 mg', doseUnknown: false });
    expect(parseAppData(v3).ok).toBe(true);
  });
  it('aceita datas aproximadas e desconhecidas; recusa formatos inventados', () => {
    expect(med({ startDate: '2019' }).startDate).toBe('2019');
    expect(med({ startDate: '2019-03' }).startDate).toBe('2019-03');
    expect(med({ startDate: null }).startDate).toBeNull();
    expect(() => med({ startDate: '03/2019' as any })).toThrow();
    expect(() => med({ startDate: '2019-3' as any })).toThrow();
  });
  it('não se aplica × não me lembro × não informado são estados distintos', () => {
    const emUso = med({});
    const parouSemData = med({ endUnknown: true });
    const parouSemMotivo = med({ endDate: '2021-05-01' });
    const naoLembraMotivo = med({ endDate: '2021-05-01', stopReason: 'nao_lembra' });
    const today = '2026-11-28';
    expect(isActive(emUso, today)).toBe(true);
    expect(isActive(parouSemData, today)).toBe(false);
    expect(periodLabel(parouSemData, today)).toMatch(/fim desconhecido/);
    expect(stopText(parouSemMotivo)).toBe('');
    expect(stopText(naoLembraMotivo)).toBe('Não me lembro');
  });
  it('dose desconhecida nunca vira um valor', () => {
    expect(doseLabel({ dose: '', doseUnknown: true })).toBe('dose desconhecida');
    expect(doseLabel({ dose: '50 mg', doseUnknown: false })).toBe('50 mg');
  });
  it('formata e compara datas aproximadas sem completar dia ou mês', () => {
    expect(fmtFuzzy('2019')).toBe('2019');
    expect(fmtFuzzy('2019-03')).toBe('março de 2019');
    expect(fmtFuzzy('2019-03-07')).toBe('7 de março de 2019');
    expect(fmtFuzzy(null)).toBe('data desconhecida');
    expect(precisionOf('2019-03')).toBe('month');
    // Fim informado só pelo mês atual: já parou.
    expect(isActive(med({ endDate: '2026-11' }), '2026-11-28')).toBe(false);
    // Início desconhecido não impede estar em uso.
    expect(isActive(med({ startDate: null }), '2026-11-28')).toBe(true);
  });
  it('observações da interrupção complementam o motivo (e aparecem nas mudanças do período)', () => {
    const m = med({ endDate: '2026-11-10', stopReason: 'efeitos', stopNote: 'Sonolência excessiva durante o dia e tontura.' });
    expect(stopText(m)).toBe('Efeitos colaterais — Sonolência excessiva durante o dia e tontura.');
    const ch = medChanges([m], '2026-11-01', '2026-11-30');
    expect(ch.find((c) => c.kind === 'stop')!.text).toMatch(/Sonolência/);
  });
  it('mudanças sem data ficam fora dos resumos por período e entram por último no histórico', () => {
    const m = med({ doses: [{ date: '2020-01-10', dose: '50 mg', doseUnknown: false, schedule: '', note: '' }] });
    const withUnknown = insertDose(m.doses, { date: null, dose: '', doseUnknown: true, schedule: '', note: '' });
    expect(withUnknown.map((d) => d.date)).toEqual(['2020-01-10', null]);
    // A mudança sem data fica onde foi registrada; uma datada sem mudança posterior conhecida vai para o fim.
    const dated = insertDose(withUnknown, { date: '2020-06', dose: '100 mg', doseUnknown: false, schedule: '', note: '' });
    expect(dated.map((d) => d.date)).toEqual(['2020-01-10', null, '2020-06']);
    // Uma datada anterior a outra datada entra antes dela.
    const between = insertDose(dated, { date: '2020-03', dose: '75 mg', doseUnknown: false, schedule: '', note: '' });
    expect(between.map((d) => d.date)).toEqual(['2020-01-10', null, '2020-03', '2020-06']);
    expect(medChanges([{ ...m, doses: dated }], '2000-01-01', '2030-01-01').map((c) => c.date)).toEqual(['2020-01-10', '2020-06']);
  });
  it('anteriores: sem nenhuma data conhecida vão por último', () => {
    const a = med({ id: 'a', name: 'A', startDate: null, endUnknown: true });
    const b = med({ id: 'b', name: 'B', endDate: '2022' });
    expect(pastMeds([a, b], '2026-11-28').map((m) => m.name)).toEqual(['B', 'A']);
  });
});

const M = (p: Partial<MoodEntry>): MoodEntry => ({ id: Math.random().toString(36), createdAt: T, updatedAt: T, at: '2026-11-28T10:00:00', timePrecision: 'exact', valence: 0, energy: null, emotionIds: [], indicators: {}, tags: [], itemIds: [], note: '', ...p }) as MoodEntry;

describe('contexto do registro de humor', () => {
  it('resumo descritivo: frequência, avaliações e emoções por contexto, mais a linha sem contexto', () => {
    const list = [
      M({ tags: ['trabalho'], valence: -1, emotionIds: ['frus'] }),
      M({ tags: ['Trabalho'], valence: 0, emotionIds: ['frus', 'ans'] }),
      M({ tags: ['trabalho', 'sono'], valence: -2, emotionIds: ['frus'], at: '2026-11-27T10:00:00' }),
      M({ tags: [], valence: 2 }),
    ];
    const s = contextSummary(list);
    const w = s.rows.find((r) => r.tag.toLowerCase() === 'trabalho')!;
    expect(w.records).toBe(3);
    expect(w.dates).toBe(2);
    expect(w.valence).toEqual([1, 1, 1, 0, 0]);
    expect(w.emotions[0]).toEqual({ id: 'frus', count: 3, share: 1 });
    expect(s.rows.some((r) => r.tag === 'sono')).toBe(false); // menos de 3 registros
    expect(s.none.records).toBe(1);
    expect(s.withContext).toBe(3);
  });
});

describe('Mapa: revisão do conteúdo', () => {
  it('instalação nova: nenhuma pergunta retirada é criada; fichas novas na ordem certa', () => {
    const d = initialData(T);
    const retired = BUILTIN_SECTIONS.flatMap((s) => s.questions.map((q, i) => ({ q, id: builtInQuestionId(s.id, i) }))).filter((x) => x.q.retired);
    expect(retired.length).toBeGreaterThan(0);
    for (const r of retired) expect(d.questions.some((q) => q.id === r.id)).toBe(false);
    expect(d.preferences.seedRevision).toBe(SEED_REVISION);
    const order = [...d.sections].sort((a, b) => a.order - b.order).map((s) => s.id);
    expect(order.indexOf('sec.historia')).toBe(1);
    expect(order.indexOf('sec.pensamentos')).toBe(order.indexOf('sec.emocoes') + 1);
    expect(order[order.length - 1]).toBe('sec.existencia');
  });
  it('dados antigos: reformula só o que não foi respondido nem editado; retira só o que não tem resposta', () => {
    // Simula uma instalação anterior: perguntas com o texto antigo e sem revisão aplicada.
    const base = initialData(T);
    const old = (id: string, text: string) => ({ id, sectionId: id.startsWith('q.identidade') ? 'sec.identidade' : 'sec.necessidades', text, hint: '', builtIn: true, favorite: false, hidden: false, order: 0, createdAt: T, updatedAt: T });
    const d: AppData = {
      ...base,
      preferences: { ...base.preferences, seedRevision: 0 },
      questions: [
        ...base.questions.filter((q) => !['q.identidade.02', 'q.identidade.06', 'q.preferencias.03', 'q.necessidades.06'].includes(q.id)),
        old('q.identidade.02', 'Quais são suas principais características?'), // sem resposta → reformula
        old('q.identidade.06', 'Como gostaria que as outras pessoas percebessem você?'), // sem resposta → oculta
        { ...old('q.preferencias.03', 'O que te proporciona prazer?'), sectionId: 'sec.preferencias' }, // respondida → mantém
        old('q.necessidades.06', 'O que te deixa à vontade?'), // respondida → continua visível
      ],
      answers: [
        { id: 'a1', createdAt: T, updatedAt: T, questionId: 'q.preferencias.03', text: 'Café e silêncio', layers: [] },
        { id: 'a2', createdAt: T, updatedAt: T, questionId: 'q.necessidades.06', text: 'Casa arrumada', layers: [] },
      ] as any,
    };
    const r = reviseBuiltIns(AppDataSchema.parse(d) as AppData, T);
    const q = (id: string) => r.questions.find((x) => x.id === id)!;
    expect(q('q.identidade.02').text).toMatch(/Que palavras as pessoas próximas/);
    expect(q('q.identidade.06').hidden).toBe(true);
    expect(q('q.preferencias.03').text).toBe('O que te proporciona prazer?');
    expect(q('q.necessidades.06').hidden).toBe(false);
    expect(r.answers.length).toBe(2);
    expect(r.preferences.seedRevision).toBe(SEED_REVISION);
    // Uma vez aplicada, escolhas posteriores não são desfeitas (ex.: mostrar de novo a retirada).
    const shown = { ...r, questions: r.questions.map((x) => (x.id === 'q.identidade.06' ? { ...x, hidden: false } : x)) };
    expect(syncBuiltIns(shown, T).questions.find((x) => x.id === 'q.identidade.06')!.hidden).toBe(false);
  });
  it('pergunta editada pela pessoa nunca é alterada', () => {
    const base = initialData(T);
    const d = { ...base, preferences: { ...base.preferences, seedRevision: 0 }, questions: base.questions.map((x) => (x.id === 'q.identidade.02' ? { ...x, text: 'Minha versão' } : x)) };
    expect(reviseBuiltIns(d, T).questions.find((x) => x.id === 'q.identidade.02')!.text).toBe('Minha versão');
  });
  it('perguntas nativas sem texto repetido; toda dica com referência é curta o bastante para o campo', () => {
    const all = BUILTIN_SECTIONS.flatMap((s) => s.questions).filter((q) => !q.retired);
    expect(new Set(all.map((q) => q.text.toLowerCase())).size).toBe(all.length);
    for (const q of all) {
      expect(q.text.length).toBeLessThanOrEqual(500);
      expect((q.hint ?? '').length).toBeLessThanOrEqual(400);
    }
  });
});

describe('pergunta do dia', () => {
  const data = initialData(T);
  const days = Array.from({ length: 120 }, (_, i) => {
    const d = new Date(2026, 0, 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  it('a ficha nunca se repete em dias seguidos e todas aparecem a cada ciclo', () => {
    const secs = [...new Set(data.questions.map((q) => q.sectionId))];
    const seq = days.map((d) => sectionOfDay(secs, d)!);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    const first = new Set(seq.slice(0, secs.length * 2));
    expect(first.size).toBe(secs.length);
  });
  it('determinística por data, só perguntas abertas, favoritas primeiro', () => {
    expect(dailyQuestion(data, days[3])!.id).toBe(dailyQuestion(data, days[3])!.id);
    const fav = { ...data, questions: data.questions.map((q) => (q.id === 'q.valores.01' ? { ...q, favorite: true } : q)) };
    expect(dailyQuestion(fav, days[5])!.id).toBe('q.valores.01');
    const answered = { ...fav, answers: [{ id: 'x', createdAt: T, updatedAt: T, questionId: 'q.valores.01', text: 'ok', layers: [] }] as any };
    expect(dailyQuestion(answered, days[5])!.id).not.toBe('q.valores.01');
  });
});

describe('"Para este momento": o Guia de volta no Hoje', () => {
  const now = new Date(2026, 10, 28, 15, 0);
  const at = (h: number, m = 0) => `2026-11-28T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  const base = (): AppData => {
    const d = emptyData();
    return {
      ...d,
      emotions: [{ id: 'frus', createdAt: T, updatedAt: T, label: 'Frustração', builtIn: true, hidden: false, signals: '', helps: 'Respirar antes de responder.', worsens: '' }],
      repertoire: [
        { id: 'musica', createdAt: T, updatedAt: T, kind: 'resource', name: 'Ouvir música', description: '', category: '', circumstances: 'Durante o trabalho', effect: '', perceivedFrequency: null, notes: '', wantToChange: false, tags: [], archived: false },
        { id: 'pausa', createdAt: T, updatedAt: T, kind: 'strategy', name: 'Pausa curta', description: '', category: '', circumstances: '', effect: '', perceivedFrequency: null, notes: '', wantToChange: false, tags: ['trabalho'], archived: false },
        { id: 'celular', createdAt: T, updatedAt: T, kind: 'strategy', name: 'Rolar o celular', description: '', category: '', circumstances: '', effect: '', perceivedFrequency: null, notes: '', wantToChange: false, tags: ['trabalho'], archived: false },
        { id: 'reuniao', createdAt: T, updatedAt: T, kind: 'drain', name: 'Reuniões longas', description: '', category: '', circumstances: '', effect: '', perceivedFrequency: null, notes: '', wantToChange: false, tags: ['trabalho'], archived: false },
      ],
      uses: [
        { id: 'u1', createdAt: T, updatedAt: T, itemId: 'celular', at: at(9), timePrecision: 'exact', outcome: 'worse', tags: ['trabalho'], note: '', experienceId: null },
        { id: 'u2', createdAt: T, updatedAt: T, itemId: 'pausa', at: at(9), timePrecision: 'exact', outcome: 'worked', tags: ['trabalho'], note: '', experienceId: null },
      ],
      moodEntries: [M({ id: 'e1', at: at(14, 30), valence: 0, emotionIds: ['frus'], tags: ['trabalho'] })],
    } as AppData;
  };

  it('só depois de um registro difícil e recente de hoje', () => {
    const d = base();
    expect(supportTarget(d, now)!.id).toBe('e1');
    expect(supportTarget({ moodEntries: [M({ at: at(14), valence: 1 })] }, now)).toBeNull();
    expect(supportTarget({ moodEntries: [M({ at: '2026-11-27T22:00:00', valence: -2 })] }, now)).toBeNull();
    expect(supportTarget({ moodEntries: [M({ at: at(16), valence: -2 })] }, now)).toBeNull(); // no futuro
  });
  it('o exemplo: música no trabalho, o que ajuda na frustração e a estratégia que funcionou', () => {
    const d = base();
    const s = supportFor(d, d.moodEntries[0]);
    const keys = s.map((x) => x.key);
    expect(keys).toContain('item|pausa'); // funcionou no trabalho
    expect(keys).toContain('emotion|frus'); // escrito em Minhas emoções
    expect(keys).toContain('item|musica'); // "durante o trabalho" nas circunstâncias
    expect(s.find((x) => x.key === 'item|musica')!.text).toBe('Você registrou que faz bem — durante o trabalho.');
    expect(s.find((x) => x.key === 'item|pausa')!.why).toMatch(/1 de 1/);
  });
  it('nunca sugere o que piorou nesse contexto, nem o que desgasta', () => {
    const d = base();
    const keys = supportFor(d, d.moodEntries[0]).map((x) => x.key);
    expect(keys).not.toContain('item|celular');
    expect(keys).not.toContain('item|reuniao');
  });
  it('no máximo 3 sugestões, no máximo 2 do mesmo tipo, cada uma com a origem', () => {
    const d = base();
    d.repertoire.push(
      ...['a', 'b', 'c'].map((id) => ({ ...d.repertoire[1], id, name: `Item ${id}` })),
    );
    const s = supportFor(d, d.moodEntries[0]);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s.filter((x) => x.kind === 'item' || x.kind === 'pattern').length).toBeLessThanOrEqual(2);
    for (const x of s) expect(x.href).toMatch(/^\/(guia|mapa)\//);
  });
  it('sem contexto nem guia da emoção: nada específico, e só registros desagradáveis recebem o geral', () => {
    const d = base();
    const neutro = M({ at: at(14), valence: 0 });
    expect(supportFor(d, neutro)).toEqual([]);
    d.uses.push(...[1, 2, 3].map((i) => ({ ...d.uses[1], id: `g${i}` })));
    const ruim = M({ at: at(14), valence: -1 });
    const s = supportFor(d, ruim);
    expect(s.map((x) => x.key)).toEqual(['item|pausa']);
    expect(s[0].why).toMatch(/em geral/);
  });
});
