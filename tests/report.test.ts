import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../src/data/storage';
import { Store } from '../src/data/store';
import { buildReport } from '../src/report/pdf';
import { REPORT_SECTIONS, type ReportSection } from '../src/report/sections';
import { deriveTokens } from '../src/theme/tokens';
import { PRESET_THEMES } from '../src/theme/presets';
import { seedSample } from '../src/dev/sample';

describe('relatório em PDF', () => {
  it('gera um PDF válido com todas as seções, inclusive registros retroativos e acontecimentos', async () => {
    const s = new Store(new MemoryStorage(), 0);
    await s.load();
    seedSample(s);
    const p = PRESET_THEMES[0];
    const tokens = deriveTokens(p.light, p).tokens;
    const to = new Date();
    const from = new Date(to.getTime() - 120 * 86400000);
    const all = Object.keys(REPORT_SECTIONS) as ReportSection[];
    const bytes = buildReport(s.getState().data, { from, to }, all, tokens);
    const head = new TextDecoder().decode(bytes.slice(0, 8));
    expect(head.startsWith('%PDF-')).toBe(true);
    expect(bytes.length).toBeGreaterThan(5000);
    const filtered = buildReport(s.getState().data, { from, to }, ['summary'], tokens, { entryFilter: (m) => m.valence < 0, filterLabel: 'só desagradáveis' });
    expect(filtered.length).toBeGreaterThan(1000);
  });
});
