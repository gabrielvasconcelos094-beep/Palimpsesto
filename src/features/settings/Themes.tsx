import { useMemo, useState, type CSSProperties } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, usePrefs } from '../../app/store';
import { resolveTokens, useSystemDark } from '../../app/theme';
import { toast } from '../../app/toast';
import type { CustomTheme, ThemeColors } from '../../domain/schema';
import { isHex } from '../../theme/color';
import { findPreset, PRESET_THEMES, type CardStyle, type DisplayFont } from '../../theme/presets';
import { deriveTokens, tokensToCss, type Tokens } from '../../theme/tokens';
import { Field, OptCheck, Page, Section, Segmented, Toggle, useConfirm } from '../../ui/components';
import { CHART_PALETTES } from '../../theme/chartPalettes';

function cssVars(t: Tokens, font?: DisplayFont): CSSProperties {
  return tokensToCss(t, { displayFont: font }) as unknown as CSSProperties;
}

/** Miniatura de tema: usa os próprios tokens do tema, isolados no elemento. */
function ThemePreview({ tokens, name, active, onClick, font }: { tokens: Tokens; name: string; active: boolean; onClick: () => void; font?: DisplayFont }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Tema ${name}`}
      style={{
        ...cssVars(tokens, font),
        background: 'var(--bg)',
        color: 'var(--ink)',
        border: active ? '2px solid var(--ink)' : '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 10,
        textAlign: 'left',
        position: 'relative',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--display-weight)', fontSize: 19, lineHeight: 1.1, marginBottom: 8 }}>{name}</div>
      <div
        style={{
          background: 'var(--card-bg)',
          border: 'var(--card-border)',
          boxShadow: 'var(--card-shadow)',
          borderRadius: 'var(--radius-sm)',
          padding: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ width: 12, height: 12, borderRadius: 99, background: `var(--mood-${i})` }} />
          ))}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--ink-soft)', width: '80%', opacity: 0.5 }} />
        <div style={{ height: 6, borderRadius: 3, background: 'var(--ink-soft)', width: '55%', opacity: 0.3, marginTop: 4 }} />
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <span style={{ height: 16, flex: 1, borderRadius: 'var(--radius-pill)', background: 'var(--primary-fill)' }} />
          <span style={{ height: 16, width: 22, borderRadius: 'var(--radius-pill)', background: 'var(--accent-fill)' }} />
        </div>
      </div>
      <OptCheck on={active} corner />
    </button>
  );
}

/** Miniatura ilustrativa de cada estilo, desenhada com os tokens da paleta atual. */
function StylePreview({ kind }: { kind: 'minimal' | 'organic' }) {
  const org = kind === 'organic';
  const card = (bg: string, r: string, extra: CSSProperties = {}) => ({
    background: bg,
    borderRadius: r,
    border: org ? 0 : '1px solid var(--line)',
    height: 34,
    ...extra,
  });
  return (
    <div aria-hidden style={{ height: 116, borderRadius: 10, background: 'var(--bg)', padding: 8, position: 'relative', overflow: 'hidden' }}>
      {org && <div style={{ position: 'absolute', right: -18, top: -18, width: 60, height: 52, borderRadius: '46% 54% 60% 40% / 48% 40% 60% 52%', background: 'var(--tint-2)' }} />}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, position: 'relative' }}>Mapa</div>
      <div style={{ display: 'grid', gridTemplateColumns: org ? '1fr 1fr' : '1fr', gap: 5, marginTop: 6 }}>
        <div style={card(org ? 'var(--tint-1)' : 'var(--surface)', org ? '14px 6px 14px 8px' : '3px')} />
        <div style={card(org ? 'var(--tint-3)' : 'var(--surface)', org ? '6px 14px 8px 14px' : '3px', org ? { marginTop: 10 } : {})} />
        {!org && <div style={card('var(--surface)', '3px', { height: 18 })} />}
      </div>
    </div>
  );
}

export function ThemesPage() {
  const prefs = usePrefs();
  const systemDark = useSystemDark();
  const themeMood = resolveTokens({ ...prefs, chartPalette: 'theme' }, systemDark).mood;
  const dark = prefs.appearance === 'dark' || (prefs.appearance === 'system' && systemDark);
  const previews = useMemo(
    () => PRESET_THEMES.map((p) => ({ p, tokens: deriveTokens(dark ? p.dark : p.light, p, p.mood?.[dark ? 'dark' : 'light']).tokens })),
    [dark],
  );
  const customs = prefs.customThemes.map((c) => ({ c, tokens: deriveTokens(c.colors, c).tokens }));
  const isCustom = prefs.customThemes.some((t) => t.id === prefs.themeId);

  return (
    <Page back="/ajustes" noNav title="Temas" ghost="cores" subtitle="Cada tema tem cores, cantos e tipografia próprios.">
      <Section kicker="Estilo visual">
        <p className="small muted" style={{ marginTop: 0 }}>
          Independente das cores: qualquer estilo combina com qualquer paleta, inclusive as suas.
        </p>
        <div className="grid-2" role="radiogroup" aria-label="Estilo visual">
          {(
            [
              ['minimal', 'Editorial minimalista', 'Contornos finos, alinhamento rigoroso, muito respiro.'],
              ['organic', 'Editorial orgânico', 'Formas curvas, blocos pastel, composição mais livre.'],
            ] as const
          ).map(([id, name, desc]) => (
            <button
              key={id}
              role="radio"
              aria-checked={prefs.visualStyle === id}
              onClick={() => {
                store.setPreferences({ visualStyle: id });
                toast(`${name} aplicado.`);
              }}
              className="opt style-opt"
            >
              <OptCheck on={prefs.visualStyle === id} corner />
              <StylePreview kind={id} />
              <div style={{ fontWeight: 600, marginTop: 8, fontSize: 14 }}>{name}</div>
              <div className="xs muted">{desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Field label="Aparência" help={isCustom ? 'Temas personalizados têm aparência fixa (definida pelas cores escolhidas).' : undefined}>
        <Segmented
          value={prefs.appearance}
          onChange={(appearance) => store.setPreferences({ appearance })}
          options={[
            { value: 'system', label: 'Do sistema' },
            { value: 'light', label: 'Clara' },
            { value: 'dark', label: 'Escura' },
          ]}
        />
      </Field>

      <Section kicker="Cores dos gráficos" title="Paleta dos gráficos">
        <p className="small muted" style={{ marginTop: -4 }}>
          A escala do humor nos gráficos, no calendário, nos símbolos e nos widgets. Vale para qualquer tema, claro ou escuro — o contraste é ajustado automaticamente.
        </p>
        <div className="stack" role="radiogroup" aria-label="Paleta dos gráficos">
          {CHART_PALETTES.map((p) => {
            const sw = p.colors ?? [1, 2, 3, 4, 5].map((i) => `var(--mood-${i})`);
            const on = (prefs.chartPalette ?? 'theme') === p.id;
            return (
              <button key={p.id} role="radio" aria-checked={on} className="card tight row palette-opt opt" onClick={() => store.setPreferences({ chartPalette: p.id })}>
                <span className="palette-sw" aria-hidden>
                  {sw.map((c, i) => (
                    <span key={i} style={{ background: p.id === 'theme' && !on ? themeMood[i] : c }} />
                  ))}
                </span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span style={{ fontWeight: 600, display: 'block' }}>{p.name}</span>
                  <span className="xs muted">{p.description}</span>
                </span>
                <OptCheck on={on} />
              </button>
            );
          })}
        </div>
      </Section>

      <Section kicker="Galeria">
        <div className="grid-2">
          {previews.map(({ p, tokens }) => (
            <ThemePreview key={p.id} tokens={tokens} name={p.name} active={prefs.themeId === p.id} onClick={() => store.setPreferences({ themeId: p.id })} />
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          {findPreset(prefs.themeId)?.description}
        </p>
      </Section>

      <Section kicker="Meus temas" action={<button className="btn ghost sm" onClick={() => navigate(`/ajustes/tema/novo?base=${findPreset(prefs.themeId)?.id ?? 'papel'}`)}><Plus size={14} /> Criar</button>}>
        {customs.length === 0 ? (
          <p className="small muted">Crie sua própria paleta a partir de qualquer tema da galeria. O Palimpsesto ajusta o que for preciso para manter a leitura confortável.</p>
        ) : (
          <div className="grid-2">
            {customs.map(({ c, tokens }) => (
              <div key={c.id} className="stack" style={{ gap: 6 }}>
                <ThemePreview tokens={tokens} name={c.name} active={prefs.themeId === c.id} onClick={() => store.setPreferences({ themeId: c.id })} font={c.displayFont} />
                <button className="btn ghost sm" onClick={() => navigate(`/ajustes/tema/${c.id}`)}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section kicker="Tipografia e movimento">
        <div className="stack lg">
          <Field label="Fonte dos títulos">
            <select className="select" value={prefs.displayFont} onChange={(e) => store.setPreferences({ displayFont: e.target.value as any })}>
              <option value="theme">A do tema</option>
              <option value="fraunces">Fraunces — editorial, macia</option>
              <option value="cormorant">Cormorant Garamond — clássica, literária</option>
              <option value="lora">Lora — de livro, firme</option>
            </select>
          </Field>
          <Field label={`Tamanho do texto · ${Math.round(prefs.textScale * 100)}%`}>
            <input
              type="range"
              min={0.9}
              max={1.3}
              step={0.05}
              value={prefs.textScale}
              onChange={(e) => store.setPreferences({ textScale: Number(e.target.value) })}
              aria-label="Tamanho do texto"
              style={{ accentColor: 'var(--primary-ink)' }}
            />
          </Field>
          <div className="list">
            <Toggle label="Reduzir animações" checked={prefs.reduceMotion} onChange={(reduceMotion) => store.setPreferences({ reduceMotion })} />
          </div>
          <button
            className="btn secondary"
            onClick={() => {
              store.setPreferences({ themeId: 'papel', appearance: 'system', displayFont: 'theme', textScale: 1, reduceMotion: false });
              toast('Aparência original restaurada. Seus temas personalizados continuam salvos.');
            }}
          >
            Restaurar aparência original
          </button>
        </div>
      </Section>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Editor de tema personalizado                                        */
/* ------------------------------------------------------------------ */
const COLOR_FIELDS: Array<[keyof ThemeColors, string, string]> = [
  ['primary', 'Cor principal', 'Botões, destaques de navegação, ênfases.'],
  ['accent', 'Cor de destaque', 'Detalhes, cartas, estados agradáveis no humor.'],
  ['background', 'Fundo', 'A “folha” do aplicativo.'],
  ['surface', 'Superfícies e cartões', 'Onde o conteúdo se apoia.'],
  ['complement1', 'Complementar 1', 'Gráficos e o lado desagradável da escala de humor.'],
  ['complement2', 'Complementar 2', 'Detalhes secundários.'],
];

export function ThemeEditorPage() {
  const route = useRoute();
  const prefs = usePrefs();
  const id = route.parts[2];
  const existing = prefs.customThemes.find((t) => t.id === id);
  const base = findPreset(route.query.get('base') ?? '') ?? findPreset(prefs.themeId) ?? PRESET_THEMES[0];
  const systemDark = useSystemDark();
  const initial = (): Omit<CustomTheme, 'id' | 'createdAt' | 'updatedAt'> =>
    existing
      ? { ...existing }
      : {
          name: `Meu ${base.name.toLowerCase()}`,
          colors: { ...(prefs.appearance === 'dark' || (prefs.appearance === 'system' && systemDark) ? base.dark : base.light) },
          radius: base.radius,
          cardStyle: base.cardStyle,
          displayFont: base.displayFont,
        };
  const [draft, setDraft] = useState(initial);
  const { ask, node } = useConfirm();
  const { tokens, checks } = useMemo(() => deriveTokens(draft.colors, draft), [draft]);
  const valid = (Object.values(draft.colors) as string[]).every(isHex) && draft.name.trim();
  const setColor = (k: keyof ThemeColors, v: string) => setDraft((d) => ({ ...d, colors: { ...d.colors, [k]: v } }));

  const save = (apply: boolean) => {
    const now = new Date().toISOString();
    const theme: CustomTheme = { ...(existing ?? { id: crypto.randomUUID(), createdAt: now }), ...draft, name: draft.name.trim(), updatedAt: now } as CustomTheme;
    const list = existing ? prefs.customThemes.map((t) => (t.id === theme.id ? theme : t)) : [...prefs.customThemes, theme];
    store.setPreferences({ customThemes: list, ...(apply ? { themeId: theme.id } : {}) });
    toast(apply ? 'Tema salvo e aplicado.' : 'Tema salvo.');
    goBack('/ajustes/temas');
  };

  return (
    <Page back="/ajustes/temas" noNav title={existing ? 'Editar tema' : 'Novo tema'} ghost="paleta">
      {/* Pré-visualização isolada: aplica os tokens apenas neste bloco. */}
      <div
        style={{
          ...cssVars(tokens, draft.displayFont),
          background: 'var(--bg)',
          color: 'var(--ink)',
          borderRadius: 'var(--radius)',
          padding: 16,
          border: '1px solid var(--line)',
          position: 'sticky',
          top: 'calc(var(--safe-top) + 4px)',
          zIndex: 5,
        }}
        aria-label="Prévia do tema"
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--display-weight)', fontSize: 24, lineHeight: 1.1 }}>Prévia do tema</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 10px' }}>Texto secundário, como datas e descrições.</div>
        <div style={{ background: 'var(--card-bg)', border: 'var(--card-border)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--radius)', padding: 12 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} style={{ width: 18, height: 18, borderRadius: 99, background: `var(--mood-${i})` }} />
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-ink)', fontWeight: 600 }}>destaque</span>
          </div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: '10px 0' }}>“Descobri que preciso de silêncio pela manhã.”</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: 'var(--primary-fill)', color: 'var(--on-primary)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>Salvar</span>
            <span style={{ background: 'var(--accent-fill)', color: 'var(--on-accent)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>Destaque</span>
            <span style={{ border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 13 }}>#marcador</span>
          </div>
        </div>
      </div>

      <div className="stack lg" style={{ marginTop: 18 }}>
        <Field label="Nome do tema">
          <input className="input" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        {COLOR_FIELDS.map(([k, label, help]) => (
          <Field key={k} label={label} help={help}>
            <div className="row">
              <input
                type="color"
                value={isHex(draft.colors[k]) ? normalize(draft.colors[k]) : '#888888'}
                onChange={(e) => setColor(k, e.target.value)}
                aria-label={label}
                style={{ width: 52, height: 44, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)', background: 'none', padding: 2 }}
              />
              <input
                className="input"
                value={draft.colors[k]}
                onChange={(e) => setColor(k, e.target.value.trim())}
                aria-label={`${label} (hexadecimal)`}
                aria-invalid={!isHex(draft.colors[k])}
                style={{ fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' }}
                maxLength={7}
              />
            </div>
          </Field>
        ))}
        <Field label={`Cantos · ${draft.radius}px`}>
          <input type="range" min={0} max={26} step={1} value={draft.radius} onChange={(e) => setDraft({ ...draft, radius: Number(e.target.value) })} style={{ accentColor: 'var(--primary-ink)' }} aria-label="Arredondamento dos cantos" />
        </Field>
        <Field label="Cartões">
          <Segmented<CardStyle>
            value={draft.cardStyle}
            onChange={(cardStyle) => setDraft({ ...draft, cardStyle })}
            options={[
              { value: 'filled', label: 'Preenchidos' },
              { value: 'outline', label: 'Contorno' },
              { value: 'paper', label: 'Papel' },
            ]}
          />
        </Field>
        <Field label="Fonte dos títulos">
          <select className="select" value={draft.displayFont} onChange={(e) => setDraft({ ...draft, displayFont: e.target.value as DisplayFont })}>
            <option value="fraunces">Fraunces</option>
            <option value="cormorant">Cormorant Garamond</option>
            <option value="lora">Lora</option>
          </select>
        </Field>

        <Section kicker="Legibilidade">
          <div className="list">
            {checks.map((c) => (
              <div key={c.label} className="list-row">
                <div className="grow">
                  <div>{c.label}</div>
                  <div className="meta">
                    Contraste {c.ratio.toFixed(1)}:1 (mínimo {c.min}:1){c.adjusted ? ' · ajustado automaticamente' : ''}
                  </div>
                </div>
                <Check size={18} style={{ color: 'var(--primary-ink)' }} aria-label="atende" />
              </div>
            ))}
          </div>
          {checks.some((c) => c.adjusted) && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Algumas cores foram escurecidas ou clareadas apenas onde aparecem como texto ou sob texto, para que tudo continue legível.
            </p>
          )}
        </Section>

        <div className="row">
          {existing && (
            <button
              className="icon-btn"
              aria-label="Excluir tema"
              style={{ color: 'var(--danger)' }}
              onClick={async () => {
                if (await ask({ title: 'Excluir este tema?', body: 'Se ele estiver em uso, o tema Papel será aplicado.', confirm: 'Excluir', danger: true })) {
                  store.setPreferences({
                    customThemes: prefs.customThemes.filter((t) => t.id !== existing.id),
                    ...(prefs.themeId === existing.id ? { themeId: 'papel' } : {}),
                  });
                  goBack('/ajustes/temas');
                }
              }}
            >
              <Trash2 size={20} />
            </button>
          )}
          <button className="btn secondary" onClick={() => setDraft(initial())}>
            Restaurar
          </button>
          <button className="btn secondary grow" disabled={!valid} onClick={() => save(false)}>
            Salvar
          </button>
          <button className="btn primary grow" disabled={!valid} onClick={() => save(true)}>
            Salvar e usar
          </button>
        </div>
      </div>
      {node}
    </Page>
  );
}

function normalize(hex: string) {
  const m = hex.replace('#', '');
  return '#' + (m.length === 3 ? m.split('').map((c) => c + c).join('') : m).toLowerCase();
}
