import { useState } from 'react';
import { store, usePrefs } from '../../app/store';
import { useSystemDark } from '../../app/theme';
import { PRESET_THEMES } from '../../theme/presets';
import { deriveTokens } from '../../theme/tokens';

/** Boas-vindas em três passos curtos — todos podem ser pulados. */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const prefs = usePrefs();
  const dark = useSystemDark();
  const finish = () => store.setDevice({ onboardingDone: true });
  return (
    <main className="page no-nav" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost sm" onClick={finish}>
          Pular
        </button>
      </div>
      <div className="grow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
        {step === 0 && (
          <>
            <h1 className="page-title" data-ghost="camadas" style={{ fontSize: 'calc(var(--fs-2xl) * 1.3)' }}>
              Palimpsesto
            </h1>
            <p className="quote" style={{ margin: 0 }}>
              Um arquivo sobre você, escrito aos poucos — e reescrito quando você muda.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Registre como se sente, guarde o que descobre sobre si, reúna o que ajuda e o que pesa, e consulte tudo isso quando precisar. Use quando quiser: não há sequências, metas
              ou cobranças.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="page-title" data-ghost="sigilo">
              Só seu
            </h1>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Sem conta, sem internet, sem anúncios.</li>
              <li>Tudo fica guardado apenas neste aparelho.</li>
              <li>Você pode exportar, importar e apagar tudo quando quiser.</li>
              <li>Em Ajustes, dá para ativar um PIN de bloqueio.</li>
            </ul>
            <div className="card soft small">
              O Palimpsesto é um espaço de observação e reflexão. Ele não faz diagnósticos e não substitui acompanhamento psicológico ou psiquiátrico.
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="page-title" data-ghost="cores">
              Escolha um tema
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              Você pode mudar quando quiser, ou criar o seu.
            </p>
            <div className="grid-3">
              {PRESET_THEMES.map((p) => {
                const t = deriveTokens(dark ? p.dark : p.light, p, p.mood?.[dark ? 'dark' : 'light']).tokens;
                const active = prefs.themeId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => store.setPreferences({ themeId: p.id })}
                    aria-pressed={active}
                    style={{
                      background: t.bg,
                      color: t.ink,
                      border: active ? `2px solid ${t.ink}` : `1px solid ${t.line}`,
                      borderRadius: Math.max(6, p.radius),
                      padding: '12px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ display: 'flex', gap: 3 }}>
                      {[t.primaryFill, t.accentFill, t.mood[0]].map((c, i) => (
                        <span key={i} style={{ width: 14, height: 14, borderRadius: 99, background: c }} />
                      ))}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <div className="row" style={{ gap: 6 }} aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="dot xs" style={{ background: i === step ? 'var(--ink)' : 'var(--line-strong)' }} />
          ))}
        </div>
        <span className="grow" />
        {step > 0 && (
          <button className="btn ghost" onClick={() => setStep(step - 1)}>
            Voltar
          </button>
        )}
        <button className="btn primary" onClick={() => (step < 2 ? setStep(step + 1) : finish())}>
          {step < 2 ? 'Continuar' : 'Começar'}
        </button>
      </div>
    </main>
  );
}
