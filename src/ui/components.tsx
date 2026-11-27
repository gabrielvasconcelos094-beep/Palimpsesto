import { Children, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronRight, X } from 'lucide-react';
import { goBack } from '../app/router';
import { pushOverlay } from '../app/overlays';

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */
export function Page(props: {
  title?: ReactNode;
  ghost?: string;
  subtitle?: ReactNode;
  back?: string | true;
  actions?: ReactNode;
  children: ReactNode;
  noNav?: boolean;
  kicker?: ReactNode;
}) {
  const showTop = props.back || props.actions;
  return (
    <main className={`page${props.noNav ? ' no-nav' : ''}`}>
      {showTop && (
        <div className="topbar">
          {props.back && (
            <button className="icon-btn" aria-label="Voltar" onClick={() => goBack(props.back === true ? '/' : props.back)}>
              <ArrowLeft size={22} strokeWidth={1.6} />
            </button>
          )}
          <div className="spacer" />
          {props.actions}
        </div>
      )}
      {props.title && (
        <header className="page-head">
          <Decor seed={props.ghost ?? String(props.title)} />
          {props.kicker && <p className="kicker">{props.kicker}</p>}
          <h1 className="page-title" data-ghost={props.ghost}>
            {props.title}
          </h1>
          {props.subtitle && <p className="page-sub">{props.subtitle}</p>}
        </header>
      )}
      {props.children}
    </main>
  );
}

const BLOBS = [
  'M46 8C70 -2 104 6 116 30C128 54 112 86 84 94C56 102 22 92 10 68C-2 44 22 18 46 8Z',
  'M30 14C52 0 92 2 110 22C128 42 120 78 94 92C68 106 30 98 14 76C-2 54 8 28 30 14Z',
  'M58 4C86 4 118 22 116 52C114 82 84 100 56 96C28 92 4 74 6 46C8 18 30 4 58 4Z',
];
/** Forma abstrata do cabeçalho — só visível no Editorial orgânico. */
function Decor({ seed }: { seed: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const d = BLOBS[h % BLOBS.length];
  const c = ['var(--tint-2)', 'var(--tint-3)', 'var(--tint-1)'][(h >>> 3) % 3];
  return (
    <svg className="decor" viewBox="0 0 130 110" aria-hidden>
      <path d={d} fill={c} transform={`rotate(${(h % 40) - 20} 64 52)`} />
    </svg>
  );
}

export function Section(props: { title?: ReactNode; kicker?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`section ${props.className ?? ''}`}>
      {(props.title || props.action || props.kicker) && (
        <div className="section-head">
          <div>
            {props.kicker && <p className="kicker" style={{ marginBottom: 2 }}>{props.kicker}</p>}
            {props.title && <h2 className="h2">{props.title}</h2>}
          </div>
          {props.action}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Row(props: {
  title: ReactNode;
  meta?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const content = (
    <>
      {props.left}
      <div className="grow">
        <div className="title">{props.title}</div>
        {props.meta && <div className="meta">{props.meta}</div>}
      </div>
      {props.right}
      {props.onClick && props.chevron !== false && <ChevronRight className="chev" size={18} />}
    </>
  );
  return props.onClick ? (
    <button className="list-row" onClick={props.onClick}>
      {content}
    </button>
  ) : (
    <div className="list-row">{content}</div>
  );
}

export function Empty(props: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty card dashed">
      <p className="h3">{props.title}</p>
      {props.children && <div className="small">{props.children}</div>}
      {props.action && <div style={{ marginTop: 14 }}>{props.action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulário                                                          */
/* ------------------------------------------------------------------ */
export function Field(props: { label: ReactNode; optional?: boolean; help?: ReactNode; children: ReactNode }) {
  const id = useId();
  const helpId = props.help ? `${id}-help` : undefined;
  // Associa o rótulo ao controle (leitores de tela) e ao grupo, quando há vários.
  let labelled = 0;
  const children = Children.map(props.children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === 'input' || child.type === 'textarea' || child.type === 'select') {
      labelled++;
      return cloneElement(child as any, { 'aria-labelledby': id, 'aria-describedby': helpId });
    }
    if (child.type === AutoText) {
      labelled++;
      return cloneElement(child as any, { ariaLabelledBy: id });
    }
    return child;
  });
  const group = labelled !== 1;
  return (
    <div className="field" role={group ? 'group' : undefined} aria-labelledby={group ? id : undefined}>
      <span className="label" id={id}>
        {props.label} {props.optional && <span className="opt">· opcional</span>}
      </span>
      {children}
      {props.help && (
        <span className="help" id={helpId}>
          {props.help}
        </span>
      )}
    </div>
  );
}

/** Textarea que cresce com o conteúdo. */
export function AutoText(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  writing?: boolean;
  minRows?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      className={`textarea${props.writing ? ' writing' : ''}`}
      value={props.value}
      placeholder={props.placeholder}
      rows={props.minRows ?? 3}
      autoFocus={props.autoFocus}
      aria-label={props.ariaLabel}
      aria-labelledby={props.ariaLabel ? undefined : props.ariaLabelledBy}
      maxLength={props.maxLength ?? 20000}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function Toggle(props: { label: ReactNode; help?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label className="switch-row" htmlFor={id}>
      <div className="grow">
        <div>{props.label}</div>
        {props.help && <div className="help">{props.help}</div>}
      </div>
      <input id={id} type="checkbox" role="switch" className="switch" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  );
}

/**
 * Selo de "selecionado" das opções em cartão (.opt). Fica visível em qualquer estilo
 * e tema — o contorno sozinho não basta (o estilo orgânico não tem contornos).
 */
export function OptCheck({ on, corner }: { on: boolean; corner?: boolean }) {
  if (!on) return null;
  return (
    <span className={`opt-check${corner ? ' corner' : ''}`} aria-hidden>
      <Check size={14} strokeWidth={2.6} />
    </span>
  );
}

export function Segmented<T extends string>(props: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="segmented" role="group" aria-label={props.ariaLabel}>
      {props.options.map((o) => (
        <button key={o.value} aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sobreposições                                                       */
/* ------------------------------------------------------------------ */
function useOverlay(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const pop = pushOverlay(() => closeRef.current());
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      pop();
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function Sheet(props: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; label?: string }) {
  useOverlay(props.open, props.onClose);
  if (!props.open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={props.onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={props.label ?? (typeof props.title === 'string' ? props.title : undefined)}>
        <div className="grab" />
        {props.title && (
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 className="h2">{props.title}</h2>
            <button className="icon-btn" aria-label="Fechar" onClick={props.onClose}>
              <X size={20} />
            </button>
          </div>
        )}
        {props.children}
      </div>
    </>,
    document.body,
  );
}

export function Dialog(props: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; actions?: ReactNode }) {
  useOverlay(props.open, props.onClose);
  if (!props.open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={props.onClose} />
      <div className="dialog" role="alertdialog" aria-modal="true">
        <h2 className="h2" style={{ marginBottom: 10 }}>
          {props.title}
        </h2>
        <div className="muted">{props.children}</div>
        {props.actions && (
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18, flexWrap: 'wrap' }}>
            {props.actions}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

/** Diálogo de confirmação com promessa. */
export function useConfirm() {
  const [state, setState] = useState<null | {
    title: string;
    body: ReactNode;
    confirm: string;
    danger?: boolean;
    resolve: (v: boolean) => void;
  }>(null);
  const ask = (o: { title: string; body: ReactNode; confirm?: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => setState({ ...o, confirm: o.confirm ?? 'Confirmar', resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const node = (
    <Dialog
      open={!!state}
      onClose={() => close(false)}
      title={state?.title ?? ''}
      actions={
        <>
          <button className="btn ghost" onClick={() => close(false)}>
            Cancelar
          </button>
          <button className={`btn ${state?.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>
            {state?.confirm}
          </button>
        </>
      }
    >
      {state?.body}
    </Dialog>
  );
  return { ask, node };
}

/* ------------------------------------------------------------------ */
/* Camadas                                                             */
/* ------------------------------------------------------------------ */
export function Layers(props: { layers: Array<{ text: string; at: string }>; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!props.layers.length) return null;
  return (
    <div>
      <button className="btn ghost sm" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Ocultar' : 'Ver'} {props.layers.length} camada{props.layers.length > 1 ? 's' : ''} anterior
        {props.layers.length > 1 ? 'es' : ''}
      </button>
      {open && (
        <div className="layers">
          {[...props.layers].reverse().map((l, i) => (
            <div className="layer" key={i}>
              <div className="when">{fmtDate(l.at, { withYear: true })}</div>
              <div className="layer-text">{l.text || '(em branco)'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtDate(iso: string, o: { withYear?: boolean; weekday?: boolean; short?: boolean } = {}) {
  const d = iso.length <= 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (isNaN(d.getTime())) return '';
  const m = o.short ? MONTHS_SHORT[d.getMonth()] : MONTHS[d.getMonth()];
  const showYear = o.withYear || d.getFullYear() !== new Date().getFullYear();
  return `${o.weekday ? WEEKDAYS[d.getDay()] + ', ' : ''}${d.getDate()} de ${m}${showYear ? ` de ${d.getFullYear()}` : ''}`;
}
export function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fmtMonth(d: Date) {
  return `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}
export function relativeDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  );
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return fmtDate(iso, { weekday: true });
}
/** Converte ISO em valor para <input type="datetime-local">. */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
export { MONTHS, MONTHS_SHORT, WEEKDAYS };
