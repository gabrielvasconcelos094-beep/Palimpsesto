import { useState } from 'react';
import { Database, Eye, EyeOff, Heart, Info, Lock, Palette, Pencil, SlidersHorizontal, Tags, Trash2, Type } from 'lucide-react';
import { navigate } from '../../app/router';
import { store, useData, useStoreState } from '../../app/store';
import { removeWithUndo } from '../../app/undo';
import { toast } from '../../app/toast';
import { DEFAULT_ENERGY_LABELS, DEFAULT_VALENCE_LABELS, INDICATORS } from '../../domain/scales';
import { INDICATOR_KEYS } from '../../domain/schema';
import { APP_VERSION } from '../../data/backup';
import { findPreset } from '../../theme/presets';
import { fmtDate, OptCheck, Page, Row, Section, Toggle, useConfirm } from '../../ui/components';
import { EnergyBars, ValenceMark } from '../../ui/pickers';
import { MoodSymbol, SYMBOL_SETS } from '../../ui/symbols';
import { valenceLabel as vLabel } from '../../domain/scales';

export function SettingsHome() {
  const st = useStoreState();
  const prefs = st.data.preferences;
  const theme = prefs.customThemes.find((t) => t.id === prefs.themeId)?.name ?? findPreset(prefs.themeId)?.name ?? '';
  const icon = (I: typeof Palette) => (
    <span className="ico-tile" aria-hidden>
      <I size={18} strokeWidth={1.8} />
    </span>
  );
  return (
    <Page back="/" noNav title="Ajustes" ghost="ajustes">
      <Section kicker="Aparência">
        <div className="list">
          <Row left={icon(Palette)} title="Temas e cores" meta={theme} onClick={() => navigate('/ajustes/temas')} />
          <Row left={icon(Type)} title="Tipografia e tamanho do texto" meta="Fonte dos títulos, escala do texto, animações" onClick={() => navigate('/ajustes/temas')} />
        </div>
      </Section>
      <Section kicker="Diário">
        <div className="list">
          <Row left={icon(SlidersHorizontal)} title="Escala de humor" meta="Símbolos e nomes das categorias" onClick={() => navigate('/ajustes/escala')} />
          <Row left={icon(Heart)} title="Emoções" meta="Crie, renomeie ou oculte emoções" onClick={() => navigate('/ajustes/emocoes')} />
          <Row left={icon(Tags)} title="Indicadores acompanhados" meta={[...(prefs.trackSleep ? ['Sono'] : []), ...prefs.enabledIndicators.map((k) => INDICATORS[k].label)].join(', ') || 'Nenhum além de valência e energia'} onClick={() => navigate('/ajustes/indicadores')} />
        </div>
      </Section>
      <Section kicker="Seus dados">
        <div className="list">
          <Row
            left={icon(Database)}
            title="Backup, importação e exportação"
            meta={st.device.lastBackupAt ? `Último backup: ${fmtDate(st.device.lastBackupAt, { withYear: true })}` : 'Nenhum backup feito ainda'}
            onClick={() => navigate('/ajustes/dados')}
          />
          <Row left={icon(Lock)} title="Privacidade e segurança" meta={st.device.lock.enabled ? 'Bloqueio ativado' : 'Bloqueio desativado'} onClick={() => navigate('/ajustes/privacidade')} />
        </div>
      </Section>
      <Section kicker="Palimpsesto">
        <div className="list">
          <Row left={icon(Info)} title="Sobre" meta={`Versão ${APP_VERSION}`} onClick={() => navigate('/ajustes/sobre')} />
        </div>
      </Section>
      <p className="xs faint" style={{ textAlign: 'center' }}>
        {st.saveStatus === 'error' ? `Erro ao salvar: ${st.saveError}` : 'Tudo fica guardado apenas neste aparelho.'}
      </p>
    </Page>
  );
}

const METAPHOR_EXAMPLES = [
  ['Tempestade', 'Chuva', 'Nublado', 'Sol entre nuvens', 'Céu aberto'],
  ['Inverno', 'Outono', 'Entretempo', 'Primavera', 'Verão'],
  ['Naufrágio', 'Maré alta', 'Calmaria', 'Brisa', 'Vento a favor'],
];

export function ScalePage() {
  const prefs = useData().preferences;
  const [v, setV] = useState<string[]>(prefs.valenceLabels.map((x) => x ?? ''));
  const [e, setE] = useState<string[]>(prefs.energyLabels.map((x) => x ?? ''));
  const { ask, node } = useConfirm();
  const save = () => {
    store.setPreferences({
      valenceLabels: v.map((x) => x.trim() || null),
      energyLabels: e.map((x) => x.trim() || null),
    });
    toast('Nomes salvos. Registros antigos e gráficos não foram alterados.');
  };
  return (
    <Page back="/ajustes" noNav title="Escala de humor" ghost="nomes">
      <Section kicker="Símbolos">
        <p className="small muted" style={{ marginTop: 0 }}>
          Escolha como os cinco níveis aparecem. É só a aparência: os registros e os gráficos não mudam.
        </p>
        <p className="xs muted" style={{ marginTop: -4 }}>
          Os widgets da tela inicial usam esta família, o estilo e as cores do tema, e se atualizam sozinhos quando você muda algo aqui. Para adicionar: toque e segure na tela
          inicial → Widgets → Palimpsesto.
        </p>
        <div className="stack" role="radiogroup" aria-label="Família de símbolos">
          {SYMBOL_SETS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={prefs.symbolSet === f.id}
              className="card tight opt"
              onClick={() => {
                store.setPreferences({ symbolSet: f.id });
                toast(`Símbolos: ${f.name}.`);
              }}
            >
              <div className="row between">
                <span style={{ fontWeight: 600 }}>{f.name}</span>
                {prefs.symbolSet === f.id && (
                  <span className="row xs" style={{ gap: 6, color: 'var(--ink)', fontWeight: 600 }}>
                    em uso <OptCheck on />
                  </span>
                )}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', margin: '10px 4px 6px' }}>
                {[-2, -1, 0, 1, 2].map((v) => (
                  <MoodSymbol key={v} v={v} set={f.id} size={34} title={vLabel(v, prefs.valenceLabels)} />
                ))}
              </div>
              <div className="xs muted">{f.description}</div>
            </button>
          ))}
        </div>
      </Section>
      <Section kicker="Nomes">
      <p className="small muted">
        Dê às categorias os nomes que fazem sentido para você — metáforas, personagens, expressões suas. Os valores internos continuam fixos (de −2 a +2), então registros antigos e
        gráficos nunca são afetados.
      </p>
      </Section>
      <Section kicker="Valência">
        <div className="stack">
          {DEFAULT_VALENCE_LABELS.map((def, i) => (
            <div key={i} className="row">
              <ValenceMark v={i - 2} size={24} />
              <input
                className="input"
                value={v[i]}
                placeholder={def}
                maxLength={60}
                aria-label={`Nome para o nível ${i + 1} (${def})`}
                onChange={(ev) => setV(v.map((x, j) => (j === i ? ev.target.value : x)))}
              />
            </div>
          ))}
        </div>
        <p className="kicker" style={{ marginTop: 16 }}>
          Ideias
        </p>
        <div className="chips">
          {METAPHOR_EXAMPLES.map((ex) => (
            <button key={ex[0]} className="chip" onClick={() => setV(ex)}>
              {ex[0]} → {ex[4]}
            </button>
          ))}
        </div>
      </Section>
      <Section kicker="Energia">
        <div className="stack">
          {DEFAULT_ENERGY_LABELS.map((def, i) => (
            <div key={i} className="row">
              <EnergyBars e={i + 1} size={20} />
              <input className="input" value={e[i]} placeholder={def} maxLength={60} aria-label={`Nome para energia ${i + 1} (${def})`} onChange={(ev) => setE(e.map((x, j) => (j === i ? ev.target.value : x)))} />
            </div>
          ))}
        </div>
      </Section>
      <div className="row">
        <button
          className="btn secondary"
          onClick={async () => {
            if (await ask({ title: 'Restaurar nomes originais?', body: 'Os nomes personalizados serão substituídos pelos originais.', confirm: 'Restaurar' })) {
              setV(['', '', '', '', '']);
              setE(['', '', '', '', '']);
              store.setPreferences({ valenceLabels: [null, null, null, null, null], energyLabels: [null, null, null, null, null] });
              toast('Nomes originais restaurados.');
            }
          }}
        >
          Restaurar originais
        </button>
        <button className="btn primary grow" onClick={save}>
          Salvar
        </button>
      </div>
      {node}
    </Page>
  );
}

export function EmotionsPage() {
  const data = useData();
  const [label, setLabel] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const { ask, node } = useConfirm();
  const usage = (id: string) => data.moodEntries.filter((m) => m.emotionIds.includes(id)).length + data.experiences.filter((x) => x.emotionIds.includes(id)).length;
  return (
    <Page back="/ajustes" noNav title="Emoções" ghost="sentir">
      <p className="small muted">Ocultar uma emoção a tira das sugestões sem afetar registros antigos. Renomear também é seguro: os registros apontam para a emoção, não para o nome.</p>
      <div className="row" style={{ margin: '16px 0' }}>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nova emoção" maxLength={60} />
        <button
          className="btn primary"
          disabled={!label.trim()}
          onClick={() => {
            store.upsert('emotions', { label: label.trim(), builtIn: false, hidden: false });
            setLabel('');
          }}
        >
          Criar
        </button>
      </div>
      <div className="list">
        {data.emotions.map((e) => (
          <div key={e.id} className="list-row">
            {editing === e.id ? (
              <>
                <input className="input grow" value={editText} onChange={(ev) => setEditText(ev.target.value)} maxLength={60} autoFocus />
                <button
                  className="btn primary sm"
                  disabled={!editText.trim()}
                  onClick={() => {
                    store.patch('emotions', e.id, { label: editText.trim() });
                    setEditing(null);
                  }}
                >
                  Salvar
                </button>
              </>
            ) : (
              <>
                <div className="grow" style={{ minWidth: 0, ...(e.hidden ? { color: 'var(--ink-faint)' } : {}) }}>
                  <div className="title row" style={{ gap: 8 }}>
                    {e.label}
                    {e.hidden && <span className="chip static">oculta</span>}
                  </div>
                  <div className="meta">
                    {e.builtIn ? 'Sugestão inicial' : 'Criada por você'} · usada {usage(e.id)} vez(es)
                  </div>
                </div>
                <div className="row" style={{ gap: 2, flex: 'none' }}>
                  <button
                    className="icon-btn"
                    aria-label="Renomear"
                    onClick={() => {
                      setEditing(e.id);
                      setEditText(e.label);
                    }}
                  >
                    <Pencil size={18} strokeWidth={1.7} />
                  </button>
                  <button className="icon-btn" aria-label={e.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => store.patch('emotions', e.id, { hidden: !e.hidden })}>
                    {e.hidden ? <Eye size={18} strokeWidth={1.7} /> : <EyeOff size={18} strokeWidth={1.7} />}
                  </button>
                  {!e.builtIn && (
                    <button
                      className="icon-btn"
                      aria-label="Excluir"
                      style={{ color: 'var(--danger)' }}
                      onClick={async () => {
                        const n = usage(e.id);
                        if (
                          await ask({
                            title: `Excluir “${e.label}”?`,
                            body: n ? `Ela será removida de ${n} registro(s). Se quiser preservar o histórico, prefira ocultar.` : 'Ela não está em nenhum registro.',
                            confirm: 'Excluir',
                            danger: true,
                          })
                        )
                          removeWithUndo('emotions', e.id, 'Emoção excluída.');
                      }}
                    >
                      <Trash2 size={18} strokeWidth={1.7} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {node}
    </Page>
  );
}

export function IndicatorsPage() {
  const prefs = useData().preferences;
  const toggle = (k: (typeof INDICATOR_KEYS)[number], on: boolean) =>
    store.setPreferences({ enabledIndicators: on ? [...prefs.enabledIndicators, k] : prefs.enabledIndicators.filter((x) => x !== k) });
  return (
    <Page back="/ajustes" noNav title="Indicadores" ghost="medidas">
      <p className="small muted">
        Escolha o que acompanhar além da valência. Os campos aparecem como opcionais em “Indicadores”, no fim do registro, para ele continuar rápido.
      </p>
      <Section kicker="No registro de humor">
        <div className="list">
          <Toggle label="Nível de energia" help="Aparece logo abaixo das emoções." checked={prefs.showEnergy} onChange={(showEnergy) => store.setPreferences({ showEnergy })} />
          {INDICATOR_KEYS.map((k) => (
            <Toggle key={k} label={INDICATORS[k].label} help={`De “${INDICATORS[k].low}” a “${INDICATORS[k].high}”`} checked={prefs.enabledIndicators.includes(k)} onChange={(on) => toggle(k, on)} />
          ))}
          <Toggle
            label="Sono"
            help="Uma vez por noite: horas dormidas, qualidade e dificuldades. Aparece no registro de humor e no início, sem duplicar quando há vários registros no dia."
            checked={prefs.trackSleep}
            onChange={(trackSleep) => store.setPreferences({ trackSleep })}
          />
        </div>
      </Section>
      <Section kicker="Calendário e tela inicial">
        <div className="list">
          <Toggle label="Semana começa na segunda-feira" checked={prefs.weekStartsOn === 1} onChange={(on) => store.setPreferences({ weekStartsOn: on ? 1 : 0 })} />
          <Toggle
            label="Mostrar “camadas antigas” no início"
            help="Um texto seu de mais de 30 dias, para reler — nunca uma cobrança."
            checked={prefs.resurfacing}
            onChange={(resurfacing) => store.setPreferences({ resurfacing })}
          />
          <Toggle
            label="Lembrar do que já ajudou, em momentos difíceis"
            help="Depois de um registro difícil, o início mostra o que você mesmo(a) registrou no Guia para aquele contexto ou emoção."
            checked={prefs.supportSuggestions}
            onChange={(supportSuggestions) => store.setPreferences({ supportSuggestions })}
          />
        </div>
      </Section>
    </Page>
  );
}

export function AboutPage() {
  return (
    <Page back="/ajustes" noNav title="Sobre" ghost="palimpsesto">
      <div className="stack lg">
        <p className="quote" style={{ margin: 0 }}>
          Palimpsesto: manuscrito cuja escrita foi raspada para dar lugar a outra — mas onde as camadas antigas continuam, discretamente, visíveis.
        </p>
        <p>
          Este aplicativo é um espaço para observar, registrar e organizar o que você vai descobrindo sobre si. Respostas, descobertas e anotações podem ser reescritas; as versões
          anteriores ficam guardadas como camadas.
        </p>
        <div className="card soft small">
          <strong>Não é um instrumento clínico.</strong> O Palimpsesto não faz diagnósticos e não substitui acompanhamento psicológico ou psiquiátrico. As perguntas são reflexivas — algumas
          inspiradas em ideias da psicologia — e não são testes validados. Os padrões mostrados na Trajetória são associações nos seus registros, não causas.
        </div>
        <div className="card small">
          <strong>Precisa de apoio agora?</strong> No Brasil, o CVV (Centro de Valorização da Vida) atende 24 horas pelo telefone <strong>188</strong>, gratuitamente, e em cvv.org.br. Em
          emergências, ligue <strong>192</strong> (SAMU).{' '}
          <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => navigate('/guia/plano')}>
            Meu plano de segurança
          </button>
        </div>
        <Section kicker="Privacidade">
          <ul className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
            <li>Sem conta, sem assinatura, sem anúncios e sem rastreamento.</li>
            <li>Funciona totalmente sem internet; o aplicativo não envia dados para lugar nenhum.</li>
            <li>Os dados ficam na área privada do aplicativo neste aparelho e não entram no backup automático do Android.</li>
            <li>Você pode exportar tudo, importar em outra instalação e apagar tudo definitivamente.</li>
          </ul>
        </Section>
        <Section kicker="Criação">
          <p className="small" style={{ margin: 0 }}>
            Criado por <strong>Antonio Gabriel Pereira Vasconcelos</strong>
            <br />
            <a href="mailto:gabrielvasconcelos094@gmail.com" style={{ color: 'var(--primary-ink)' }}>
              gabrielvasconcelos094@gmail.com
            </a>
          </p>
        </Section>
        <Section kicker="Feito com">
          <p className="small muted" style={{ margin: 0 }}>
            React, Capacitor, Zod, jsPDF, Lucide (ícones) e as fontes Fraunces, Cormorant Garamond, Lora e Inter — todos de código aberto. Versão {APP_VERSION}.
          </p>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Questionários: PHQ-9 e GAD-7, de R. L. Spitzer, K. Kroenke, J. B. W. Williams e colaboradores, desenvolvidos com apoio da Pfizer Inc. — uso livre, sem necessidade de
            permissão. São instrumentos de rastreio e acompanhamento, não de diagnóstico.
          </p>
        </Section>
      </div>
    </Page>
  );
}
