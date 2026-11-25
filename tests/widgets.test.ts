import { describe, expect, it } from 'vitest';
import { buildWidgetPayload, symbolSvg, widgetAppearanceKey, type Rasterizer } from '../src/platform/widgets';
import { parseValence, routeForWidgetAction } from '../src/app/widgetActions';
import { PreferencesSchema } from '../src/domain/schema';
import { PRESET_THEMES } from '../src/theme/presets';
import { deriveTokens } from '../src/theme/tokens';
import { contrast } from '../src/theme/color';

const prefs = (p: Record<string, unknown> = {}) => PreferencesSchema.parse(p) as any;
/** Rasterizador falso: devolve o próprio conteúdo para podermos inspecionar o que foi pedido. */
const fake: Rasterizer = async (item) => Buffer.from('svg' in item ? item.svg : `emoji:${item.emoji}`).toString('base64');
const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf8');

describe('ações dos widgets', () => {
  it('cada nível abre o registro de humor com o valor interno (−2…+2)', () => {
    expect([-2, -1, 0, 1, 2].map((v) => routeForWidgetAction(`mood/${v}`))).toEqual([
      '/?novo=humor&v=-2',
      '/?novo=humor&v=-1',
      '/?novo=humor&v=0',
      '/?novo=humor&v=1',
      '/?novo=humor&v=2',
    ]);
  });
  it('atalhos abrem as telas de criação; entradas inválidas são ignoradas', () => {
    expect(routeForWidgetAction('mood/new')).toBe('/?novo=humor');
    expect(routeForWidgetAction('experience')).toBe('/diario/experiencia/nova');
    expect(routeForWidgetAction('event')).toBe('/diario/acontecimento/novo');
    for (const bad of ['mood/3', 'mood/-3', 'mood/x', 'delete', '', 'mood/1; drop', '../ajustes']) expect(routeForWidgetAction(bad)).toBeNull();
  });
  it('valência da URL é validada', () => {
    expect(parseValence('0')).toBe(0);
    expect(parseValence('-2')).toBe(-2);
    expect(parseValence('7')).toBeNull();
    expect(parseValence(null)).toBeNull();
    expect(parseValence('1.5')).toBeNull();
  });
});

describe('símbolos para os widgets', () => {
  it('SVGs não usam variáveis CSS e têm namespace, em todas as famílias e níveis', async () => {
    const mood = ['#111111', '#222222', '#333333', '#444444', '#555555'];
    for (const set of ['nature', 'faces', 'fine', 'moon', 'weather'] as const)
      for (const v of [-2, -1, 0, 1, 2]) {
        const svg = await symbolSvg(set, v, mood, '#fafafa');
        expect(svg, `${set} ${v}`).not.toMatch(/var\(/);
        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(svg).toContain(mood[v + 2]);
      }
  });
  it('famílias diferentes geram desenhos diferentes', async () => {
    const m = ['#111111', '#222222', '#333333', '#444444', '#555555'];
    const all = new Set<string>();
    for (const set of ['nature', 'faces', 'fine', 'moon', 'weather'] as const) all.add(await symbolSvg(set, 1, m, '#fff'));
    expect(all.size).toBe(5);
  });
});

describe('carga enviada ao nativo', () => {
  it('tema predefinido envia as duas variantes e deixa o modo noturno ao sistema', async () => {
    const p = await buildWidgetPayload(prefs({ themeId: 'lavanda' }), fake);
    expect(p.appearance).toBe('system');
    expect(p.style).toBe('minimal');
    expect(Object.keys(p.variants).sort()).toEqual(['dark', 'light']);
    const { light, dark } = p.variants as any;
    const lav = PRESET_THEMES.find((t) => t.id === 'lavanda')!;
    expect(light.bg.toLowerCase()).toBe(deriveTokens(lav.light, lav).tokens.bg.toLowerCase());
    expect(light.tints.map((x: string) => x.toLowerCase())).toEqual(deriveTokens(lav.light, lav).tokens.tints.map((x) => x.toLowerCase()));
    expect(light.bg).not.toBe(dark.bg);
    expect(light.mood).toHaveLength(5);
    expect(light.actions).toHaveLength(2);
    expect(light.moodColors).toHaveLength(5);
    expect(light.tints).toHaveLength(4);
    expect('title' in light).toBe(false); // widget sem texto
    expect(p.labels).toEqual(['Muito desagradável', 'Desagradável', 'Intermediário', 'Agradável', 'Muito agradável']);
  });
  it('família de símbolos escolhida é a que vai nos ícones (padrão: natureza)', async () => {
    const nat = await buildWidgetPayload(prefs(), fake);
    const moon = await buildWidgetPayload(prefs({ symbolSet: 'moon' }), fake);
    expect(decode(nat.variants.light!.mood[4])).not.toBe(decode(moon.variants.light!.mood[4]));
    expect(decode(nat.variants.light!.mood[4])).toContain('<path'); // folhas
    expect(decode(moon.variants.light!.mood[4])).toContain('<circle');
  });
  it('emojis são enviados como emoji', async () => {
    const p = await buildWidgetPayload(prefs({ symbolSet: 'emoji' }), fake);
    expect(p.variants.light!.mood.map(decode)).toEqual(['emoji:😣', 'emoji:🙁', 'emoji:😐', 'emoji:🙂', 'emoji:😄']);
  });
  it('nomes personalizados da escala acompanham a carga; valores internos não importam', async () => {
    const p = await buildWidgetPayload(prefs({ valenceLabels: ['Tempestade', null, 'Névoa', null, 'Sol'] }), fake);
    expect(p.labels).toEqual(['Tempestade', 'Desagradável', 'Névoa', 'Agradável', 'Sol']);
  });
  it('estilo orgânico usa os tons do humor próprios e informa o estilo', async () => {
    const org = await buildWidgetPayload(prefs({ visualStyle: 'organic', themeId: 'menta' }), fake);
    const min = await buildWidgetPayload(prefs({ themeId: 'menta' }), fake);
    expect(org.style).toBe('organic');
    const menta = PRESET_THEMES.find((t) => t.id === 'menta')!;
    const t = deriveTokens(menta.light, menta, menta.mood?.light).tokens;
    expect(decode(org.variants.light!.mood[4])).toContain(t.moodOrganic[4]);
    expect(decode(min.variants.light!.mood[4])).toContain(t.mood[4]);
  });
  it('tema personalizado: uma só variante, com a aparência definida pelas cores', async () => {
    const now = new Date().toISOString();
    const custom = { id: 'x', name: 'Meu', createdAt: now, updatedAt: now, colors: { primary: '#7a3e9d', accent: '#e0a030', background: '#fbf7ff', surface: '#ffffff', complement1: '#3f6fa0', complement2: '#d8c0ea' }, radius: 8, cardStyle: 'outline', displayFont: 'lora' };
    const p = await buildWidgetPayload(prefs({ themeId: 'x', customThemes: [custom] }), fake);
    expect(Object.keys(p.variants)).toEqual(['light']);
    expect(p.appearance).toBe('light');
    expect(p.variants.light!.radius).toBe(8);
    const dark = await buildWidgetPayload(prefs({ themeId: 'x', customThemes: [{ ...custom, colors: { ...custom.colors, background: '#14101a', surface: '#1f1a28' } }] }), fake);
    expect(Object.keys(dark.variants)).toEqual(['dark']);
    expect(dark.appearance).toBe('dark');
  });
  it('legibilidade: texto e rótulos têm contraste suficiente sobre a superfície em todos os temas', async () => {
    for (const th of PRESET_THEMES) {
      const p = await buildWidgetPayload(prefs({ themeId: th.id }), fake);
      for (const v of Object.values(p.variants)) {
        expect(contrast(v!.ink, v!.surface), th.id).toBeGreaterThanOrEqual(7);
        expect(contrast(v!.inkSoft, v!.surface), th.id).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('cada nível tem a sua cor, e o poço tingido mantém o símbolo legível em todos os temas e estilos', async () => {
    const mixHex = (a: string, b: string, t: number) => {
      const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
      const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
      return '#' + pa.map((x, i) => Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, '0')).join('');
    };
    for (const th of PRESET_THEMES)
      for (const style of ['minimal', 'organic']) {
        const p = await buildWidgetPayload(prefs({ themeId: th.id, visualStyle: style }), fake);
        for (const v of Object.values(p.variants)) {
          expect(new Set(v!.moodColors).size, `${th.id} ${style}`).toBeGreaterThanOrEqual(4);
          for (const mc of v!.moodColors) {
            // Mesmas misturas do renderizador nativo: minimalista = 88% do fundo; orgânico = círculo da superfície.
            const well = style === 'organic' ? v!.surface : mixHex(mc, v!.surface, 0.88);
            expect(contrast(mc, well), `${th.id} ${style} ${mc}`).toBeGreaterThanOrEqual(2.4);
          }
        }
      }
  });
  it('a chave de aparência muda só quando algo visual muda', () => {
    const a = widgetAppearanceKey(prefs());
    expect(widgetAppearanceKey(prefs({ textScale: 1.2, reduceMotion: true, weekStartsOn: 0 }))).toBe(a);
    for (const change of [{ symbolSet: 'moon' }, { themeId: 'menta' }, { visualStyle: 'organic' }, { appearance: 'dark' }, { valenceLabels: ['A', null, null, null, null] }])
      expect(widgetAppearanceKey(prefs(change))).not.toBe(a);
  });
});
