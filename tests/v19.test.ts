import { describe, expect, it } from 'vitest';
import { dayResults, seasonOf, seasonRange, seasonsAll, seasonsRows, weeksOfYear, yearsRows } from '../src/domain/calendar';
import { factorStats } from '../src/domain/sleep';
import { AppDataSchema } from '../src/domain/schema';

const M = (at: string, valence: number) => ({ at, valence }) as any;

describe('estações (sem localização, pelo hemisfério)', () => {
  it('hemisfério Sul: verão atravessa o ano', () => {
    expect(seasonOf('2026-01-10', 'south')).toEqual({ season: 'verao', year: 2025 });
    expect(seasonOf('2025-12-21', 'south')).toEqual({ season: 'verao', year: 2025 });
    expect(seasonOf('2026-03-20', 'south')).toEqual({ season: 'outono', year: 2026 });
    expect(seasonOf('2026-07-01', 'south').season).toBe('inverno');
    expect(seasonOf('2026-10-01', 'south').season).toBe('primavera');
  });
  it('hemisfério Norte: invertido', () => {
    expect(seasonOf('2026-01-10', 'north').season).toBe('inverno');
    expect(seasonOf('2026-07-01', 'north').season).toBe('verao');
    expect(seasonRange('verao', 2025, 'south')).toEqual({ from: '2025-12-21', to: '2026-03-19' });
  });
  it('linhas por estação e todas somadas, com peso igual por data', () => {
    const list = [M('2026-01-05T10:00:00', -2), M('2026-01-05T20:00:00', -2), M('2026-01-06T10:00:00', 0), M('2026-07-01T10:00:00', 2)];
    const rows = seasonsRows(list, 'south');
    expect(rows.map((r) => r.label)).toEqual(['Inverno 2026', 'Verão 2025/26']);
    expect(rows[1].index).toBe(-1); // datas: −2 e 0
    const all = seasonsAll(list, 'south');
    expect(all.find((s) => s.season === 'verao')!.dates).toBe(2);
    expect(all.find((s) => s.season === 'outono')!.index).toBeNull();
  });
});

describe('ano, semanas e anos', () => {
  it('resultado de cada dia', () => {
    const r = dayResults([M('2026-03-01T08:00:00', -2), M('2026-03-01T20:00:00', 1)]);
    expect(r.get('2026-03-01')).toEqual({ result: -1, n: 2 });
  });
  it('semanas do ano começam na semana que começa no ano; até hoje', () => {
    const w = weeksOfYear([M('2026-01-06T10:00:00', 1)], 2026, 1, '2026-01-20');
    expect(w[0].from).toBe('2026-01-05');
    expect(w.map((x) => x.records)).toEqual([1, 0, 0]);
    expect(w[0].result).toBe(1);
  });
  it('anos com índice e contagens', () => {
    const y = yearsRows([M('2025-05-01T10:00:00', 2), M('2026-05-01T10:00:00', -1), M('2026-05-02T10:00:00', -1)]);
    expect(y.map((r) => [r.key, r.index, r.dates])).toEqual([
      ['2026', -1, 2],
      ['2025', 2, 1],
    ]);
  });
});

describe('o que atrapalhou o sono', () => {
  const N = (date: string, quality: number | null, factors: string[]) => ({ date, quality, factors, hours: null, troubles: [] }) as any;
  it('conta noites e compara proporção de noites ruins com e sem o fator, só com amostra mínima', () => {
    const logs = [
      N('2026-01-01', 1, ['screens']),
      N('2026-01-02', 2, ['screens']),
      N('2026-01-03', 4, ['screens']),
      N('2026-01-04', 4, []),
      N('2026-01-05', 5, []),
      N('2026-01-06', 2, []),
      N('2026-01-07', null, ['caffeine']),
    ];
    const f = factorStats(logs);
    expect(f[0]).toEqual({ factor: 'screens', nights: 3, badWith: 2 / 3, badWithout: 1 / 3, clear: false }); // 3 noites: diferença não distinguível do acaso
    expect(f.find((x) => x.factor === 'caffeine')).toEqual({ factor: 'caffeine', nights: 1, badWith: null, badWithout: null, clear: false });
  });
});

describe('esquema 1.9', () => {
  it('campos novos opcionais com padrão (dados antigos continuam válidos)', () => {
    const d = AppDataSchema.parse({
      schemaVersion: 4,
      experiences: [{ id: 'x', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', at: '2026-11-01T10:00:00' }],
      agenda: [{ id: 'a', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', text: 'x' }],
      sleepLogs: [{ id: 's', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', date: '2026-11-01' }],
    });
    expect(d.experiences[0]).toMatchObject({ thoughts: '', distortions: [], beliefBefore: null, alternativeThought: '' });
    expect(d.agenda[0]).toMatchObject({ dates: [], appointmentId: null });
    expect(d.sleepLogs[0].factors).toEqual([]);
    expect(d.preferences.hemisphere).toBe('south');
  });
  it('recusa crença fora de 0–100 e armadilha desconhecida', () => {
    const base = { id: 'x', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', at: '2026-11-01T10:00:00' };
    expect(() => AppDataSchema.parse({ schemaVersion: 4, experiences: [{ ...base, beliefBefore: 120 }] })).toThrow();
    expect(() => AppDataSchema.parse({ schemaVersion: 4, experiences: [{ ...base, distortions: ['inventada'] }] })).toThrow();
  });
});
