import { useEffect, useState } from 'react';
import { Delete, Fingerprint } from 'lucide-react';
import { store, useStoreState } from '../../app/store';
import { toast } from '../../app/toast';
import { hashPin, verifyPin } from '../../data/crypto';
import { biometricAuthenticate, biometricAvailable, setPrivacyScreen } from '../../platform/native';
import { Field, Page, Section, Sheet, Toggle, useConfirm } from '../../ui/components';

export function PrivacyPage() {
  const st = useStoreState();
  const lock = st.device.lock;
  const [pinSheet, setPinSheet] = useState<null | 'set' | 'disable'>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [erase, setErase] = useState('');
  const { ask, node } = useConfirm();
  useEffect(() => {
    biometricAvailable().then(setBioAvailable);
  }, []);

  return (
    <Page back="/ajustes" noNav title="Privacidade e segurança" ghost="sigilo">
      <div className="card soft small" style={{ lineHeight: 1.6 }}>
        <strong>Como seus dados são protegidos</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Ficam na área privada do aplicativo, inacessível a outros apps, e protegidos pela criptografia do próprio Android.</li>
          <li>Não entram no backup automático do Google nem em cópias por cabo (adb).</li>
          <li>O aplicativo não se conecta a nenhum servidor: não há contas, análises nem anúncios, e conexões externas são bloqueadas.</li>
          <li>Backups exportados podem ser cifrados com senha (AES-256).</li>
        </ul>
      </div>

      <Section kicker="Bloqueio do aplicativo">
        <div className="list">
          <Toggle
            label="Pedir PIN ao abrir"
            help={lock.enabled ? 'Ativado' : 'Impede que alguém com o aparelho desbloqueado abra o Palimpsesto.'}
            checked={lock.enabled}
            onChange={(on) => setPinSheet(on ? 'set' : 'disable')}
          />
          {lock.enabled && (
            <>
              {bioAvailable && (
                <Toggle
                  label="Desbloquear com biometria"
                  help="Digital ou rosto, conforme o aparelho. O PIN continua valendo."
                  checked={lock.biometric}
                  onChange={async (on) => {
                    if (on && !(await biometricAuthenticate())) return toast('Biometria não confirmada.');
                    store.setDevice({ lock: { ...lock, biometric: on } });
                  }}
                />
              )}
              <div className="switch-row">
                <div className="grow">
                  <div>Bloquear novamente após</div>
                  <div className="help">Tempo com o app em segundo plano</div>
                </div>
                <select className="select" style={{ width: 150 }} value={lock.timeoutSec} onChange={(e) => store.setDevice({ lock: { ...lock, timeoutSec: Number(e.target.value) } })}>
                  <option value={0}>Imediatamente</option>
                  <option value={60}>1 minuto</option>
                  <option value={300}>5 minutos</option>
                  <option value={900}>15 minutos</option>
                </select>
              </div>
              <button className="list-row" onClick={() => setPinSheet('set')}>
                Trocar PIN
              </button>
            </>
          )}
        </div>
        {lock.enabled && (
          <p className="xs muted" style={{ marginTop: 8 }}>
            Se esquecer o PIN, não há como recuperá-lo: seria preciso apagar os dados do aplicativo nas configurações do Android. Mantenha um backup atualizado.
          </p>
        )}
      </Section>

      <Section kicker="Tela">
        <div className="list">
          <Toggle
            label="Ocultar conteúdo no seletor de apps"
            help="Também impede capturas de tela dentro do Palimpsesto."
            checked={st.device.privacyScreen}
            onChange={(privacyScreen) => {
              store.setDevice({ privacyScreen });
              void setPrivacyScreen(privacyScreen);
            }}
          />
        </div>
      </Section>

      <Section kicker="Apagar tudo">
        <div className="card stack">
          <p className="small" style={{ margin: 0 }}>
            Exclui definitivamente todos os registros, respostas, cartas, temas, cópias de segurança e configurações deste aparelho. Não pode ser desfeito. Backups que você exportou não
            são afetados.
          </p>
          <Field label="Digite APAGAR para confirmar">
            <input className="input" value={erase} onChange={(e) => setErase(e.target.value)} autoCapitalize="characters" />
          </Field>
          <button
            className="btn danger"
            disabled={erase.trim().toUpperCase() !== 'APAGAR'}
            onClick={async () => {
              if (await ask({ title: 'Apagar tudo definitivamente?', body: 'Esta é a última confirmação.', confirm: 'Apagar tudo', danger: true })) {
                await store.eraseEverything();
                location.hash = '#/';
                location.reload();
              }
            }}
          >
            Apagar todos os dados
          </button>
        </div>
      </Section>

      <Sheet open={pinSheet !== null} onClose={() => setPinSheet(null)} title={pinSheet === 'disable' ? 'Desativar bloqueio' : 'Definir PIN'}>
        {pinSheet === 'set' && <SetPin onDone={() => setPinSheet(null)} />}
        {pinSheet === 'disable' && (
          <PinPad
            title="Digite o PIN atual"
            onSubmit={async (pin) => {
              if (await verifyPin(pin, lock)) {
                store.setDevice({ lock: { ...lock, enabled: false, pinHash: '', salt: '', biometric: false } });
                setPinSheet(null);
                toast('Bloqueio desativado.');
                return true;
              }
              return false;
            }}
          />
        )}
      </Sheet>
      {node}
    </Page>
  );
}

function SetPin({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const lock = store.getState().device.lock;
  return first === null ? (
    <PinPad key="a" title="Escolha um PIN de 4 a 8 dígitos" minLength={4} submitLabel="Continuar" onSubmit={async (p) => (setFirst(p), true)} />
  ) : (
    <PinPad
      key="b"
      title="Repita o PIN"
      minLength={4}
      onSubmit={async (p) => {
        if (p !== first) {
          setFirst(null);
          toast('Os PINs não coincidem. Tente de novo.');
          return true;
        }
        const h = await hashPin(p);
        store.setDevice({ lock: { ...lock, enabled: true, pinHash: h.hash, salt: h.salt, iterations: h.iterations }, failedUnlocks: 0, lockedUntil: 0 });
        toast('Bloqueio ativado.');
        onDone();
        return true;
      }}
    />
  );
}

/** Teclado numérico de PIN. `onSubmit` devolve false para indicar PIN incorreto. */
export function PinPad(props: {
  title: string;
  onSubmit: (pin: string) => Promise<boolean>;
  minLength?: number;
  submitLabel?: string;
  disabled?: boolean;
  extra?: React.ReactNode;
  message?: string | null;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const min = props.minLength ?? 4;
  const submit = async () => {
    if (pin.length < min || busy) return;
    setBusy(true);
    const ok = await props.onSubmit(pin);
    setBusy(false);
    if (!ok) {
      setError(true);
      setPin('');
    }
  };
  const press = (d: string) => {
    if (props.disabled) return;
    setError(false);
    if (pin.length < 8) setPin(pin + d);
  };
  return (
    <div className="stack lg" style={{ alignItems: 'center' }}>
      <p className="h3" style={{ textAlign: 'center' }}>
        {props.title}
      </p>
      <div className="pin-dots" aria-label={`${pin.length} dígitos digitados`}>
        {Array.from({ length: Math.max(min, pin.length) }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <p className="small" style={{ minHeight: 20, margin: 0, color: error ? 'var(--danger)' : 'var(--ink-soft)' }} role="status">
        {props.message ?? (error ? 'PIN incorreto.' : busy ? 'Verificando…' : '')}
      </p>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={props.disabled}>
            {d}
          </button>
        ))}
        <div>{props.extra}</div>
        <button onClick={() => press('0')} disabled={props.disabled}>
          0
        </button>
        <button className="plain" aria-label="Apagar dígito" onClick={() => setPin(pin.slice(0, -1))}>
          <Delete size={22} style={{ margin: '0 auto' }} />
        </button>
      </div>
      <button className="btn primary" style={{ minWidth: 200 }} disabled={pin.length < min || busy || props.disabled} onClick={submit}>
        {props.submitLabel ?? 'Confirmar'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tela de bloqueio                                                    */
/* ------------------------------------------------------------------ */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const st = useStoreState();
  const lock = st.device.lock;
  const [now, setNow] = useState(Date.now());
  const waiting = st.device.lockedUntil > now;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);
  const tryBio = async () => {
    if (await biometricAuthenticate()) {
      store.setDevice({ failedUnlocks: 0, lockedUntil: 0 });
      onUnlock();
    }
  };
  useEffect(() => {
    if (lock.biometric) void tryBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="lock">
      <h1 className="page-title" data-ghost="palimpsesto" style={{ textAlign: 'center' }}>
        Palimpsesto
      </h1>
      <PinPad
        title="Digite seu PIN"
        disabled={waiting}
        message={waiting ? `Muitas tentativas. Aguarde ${Math.ceil((st.device.lockedUntil - now) / 1000)} s.` : null}
        extra={
          lock.biometric ? (
            <button className="plain" aria-label="Usar biometria" onClick={tryBio}>
              <Fingerprint size={26} style={{ margin: '0 auto' }} />
            </button>
          ) : null
        }
        onSubmit={async (pin) => {
          if (await verifyPin(pin, lock)) {
            store.setDevice({ failedUnlocks: 0, lockedUntil: 0 });
            onUnlock();
            return true;
          }
          const fails = st.device.failedUnlocks + 1;
          // Após 5 erros, espera crescente: 30 s, 60 s, 120 s… até 15 min.
          const wait = fails >= 5 ? Math.min(900, 30 * 2 ** (fails - 5)) * 1000 : 0;
          store.setDevice({ failedUnlocks: fails, lockedUntil: wait ? Date.now() + wait : 0 });
          setNow(Date.now());
          return false;
        }}
      />
    </div>
  );
}
