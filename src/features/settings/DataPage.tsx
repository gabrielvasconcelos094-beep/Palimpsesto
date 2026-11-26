import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, History, Upload } from 'lucide-react';
import { useRoute } from '../../app/router';
import { store, useStoreState } from '../../app/store';
import { resolveTokens, useSystemDark } from '../../app/theme';
import { toast } from '../../app/toast';
import { exportBackupText, inspectBackup, type BackupInspection } from '../../data/backup';
import { eventsCsv, experiencesCsv, moodCsv, sleepCsv } from '../../data/csv';
import { mergeData, type DuplicateStrategy } from '../../data/merge';
import { COLLECTION_LABELS } from '../../data/validate';
import { periodPreset } from '../../domain/analytics';
import { COLLECTIONS, SCHEMA_VERSION } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { useSharedFilters } from '../../app/filters';
import { activeCount, contextFor, describeFilters, matchMood } from '../../domain/filters';
import { valenceLabel } from '../../domain/scales';
import { clearExportCache, deliverFile, pickTextFile } from '../../platform/native';
import { DEFAULT_SECTIONS, REPORT_SECTIONS, type ReportSection } from '../../report/sections';
import { Field, fmtDate, Page, Section, Segmented, Toggle, useConfirm } from '../../ui/components';

const stamp = () => dayKey(new Date());

export function DataPage() {
  const st = useStoreState();
  const route = useRoute();
  const reportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (route.query.get('secao') === 'relatorio') setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 250);
  }, [route.query]);
  useEffect(() => () => void clearExportCache(), []);

  return (
    <Page back="/ajustes" noNav title="Seus dados" ghost="arquivo" subtitle="Tudo fica neste aparelho. Aqui você leva seus dados para onde quiser.">
      <ExportBackup lastBackupAt={st.device.lastBackupAt} />
      <ImportBackup />
      <CsvExport />
      <div ref={reportRef}>
        <PdfReport />
      </div>
      <SafetyCopies />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
function ExportBackup({ lastBackupAt }: { lastBackupAt: string | null }) {
  const [protect, setProtect] = useState(true);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !protect || (pw.length >= 8 && pw === pw2);
  const run = async () => {
    setBusy(true);
    try {
      await store.flush();
      const text = await exportBackupText(store.getState().data, protect ? pw : undefined);
      await deliverFile(`palimpsesto-backup-${stamp()}${protect ? '-protegido' : ''}.json`, text, 'application/json');
      store.setDevice({ lastBackupAt: new Date().toISOString() });
      toast('Backup gerado.');
      setPw('');
      setPw2('');
    } catch (e: any) {
      toast(`Não foi possível exportar: ${e?.message ?? e}`, 5000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Backup completo" kicker="Exportar">
      <div className="card stack lg">
        <p className="small muted" style={{ margin: 0 }}>
          Um único arquivo JSON com tudo: mapa, respostas e suas camadas, diário, emoções personalizadas, nomes da escala, repertório, descobertas, situações, cartas, temas e
          preferências. Serve para guardar uma cópia ou mudar de aparelho.
          {lastBackupAt && <> Último backup: {fmtDate(lastBackupAt, { withYear: true })}.</>}
        </p>
        <div className="list">
          <Toggle
            label="Proteger com senha"
            help="Recomendado: o arquivo sai do aparelho (Drive, e-mail…). Sem a senha, não há como recuperá-lo."
            checked={protect}
            onChange={setProtect}
          />
        </div>
        {protect && (
          <div className="grid-2">
            <Field label="Senha" help="Mínimo de 8 caracteres">
              <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Repita a senha" help={pw2 && pw !== pw2 ? 'As senhas não coincidem' : undefined}>
              <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
        )}
        <button className="btn primary" disabled={!ok || busy} onClick={run}>
          <Download size={16} /> {busy ? 'Preparando…' : 'Exportar backup'}
        </button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
type ImportState =
  | { step: 'idle' }
  | { step: 'password'; name: string; text: string; error?: string }
  | { step: 'checking' }
  | { step: 'error'; name: string; error: string; details?: string[] }
  | { step: 'ready'; name: string; res: Extract<BackupInspection, { kind: 'ok' }> }
  | { step: 'done'; message: string };

function ImportBackup() {
  const [s, setS] = useState<ImportState>({ step: 'idle' });
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [dup, setDup] = useState<DuplicateStrategy>('newest');
  const [prefs, setPrefs] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { ask, node } = useConfirm();

  const inspect = async (name: string, text: string, password?: string) => {
    setS({ step: 'checking' });
    if (!text) return setS({ step: 'error', name, error: 'Arquivo vazio ou grande demais.' });
    const res = await inspectBackup(text, password);
    if (res.kind === 'needs-password') return setS({ step: 'password', name, text });
    if (res.kind === 'error') {
      if (password) return setS({ step: 'password', name, text, error: res.error });
      return setS({ step: 'error', name, error: res.error, details: res.details });
    }
    setMode('merge');
    setConfirmText('');
    setS({ step: 'ready', name, res });
  };

  const pick = async () => {
    const f = await pickTextFile('.json,application/json,text/plain');
    if (f) await inspect(f.name, f.text);
  };

  const preview = useMemo(() => {
    if (s.step !== 'ready' || mode !== 'merge') return null;
    return mergeData(store.getState().data, s.res.data, dup, { importPreferences: prefs }).report;
  }, [s, mode, dup, prefs]);

  const apply = async () => {
    if (s.step !== 'ready') return;
    try {
      if (mode === 'replace') {
        const ok = await ask({
          title: 'Substituir todos os dados?',
          body: 'Tudo o que está neste aparelho será trocado pelo conteúdo do arquivo. Uma cópia de segurança dos dados atuais será criada antes e poderá ser restaurada nesta tela.',
          confirm: 'Substituir',
          danger: true,
        });
        if (!ok) return;
        await store.replaceAll(s.res.data, `Antes de substituir pelos dados de ${s.name}`);
        setS({ step: 'done', message: 'Dados substituídos com sucesso. Uma cópia do estado anterior foi guardada.' });
      } else {
        const { data, report } = mergeData(store.getState().data, s.res.data, dup, { importPreferences: prefs });
        await store.replaceAll(data, `Antes de mesclar ${s.name}`);
        setS({
          step: 'done',
          message: `Mesclagem concluída: ${report.totalAdded} registro(s) novo(s) e ${report.totalUpdated} atualizado(s). Uma cópia do estado anterior foi guardada.`,
        });
      }
    } catch (e: any) {
      setS({ step: 'error', name: s.name, error: `A importação foi interrompida e seus dados não foram alterados. (${e?.message ?? e})` });
    }
  };

  return (
    <Section title="Importar backup" kicker="Restaurar ou mesclar">
      <div className="card stack lg">
        {s.step === 'idle' || s.step === 'done' ? (
          <>
            {s.step === 'done' && (
              <div className="notice calm row" style={{ alignItems: 'flex-start' }}>
                <CheckCircle2 size={18} style={{ flex: 'none' }} /> {s.message}
              </div>
            )}
            <p className="small muted" style={{ margin: 0 }}>
              Escolha um arquivo exportado pelo Palimpsesto. Ele será verificado antes de qualquer alteração — nada muda até você confirmar.
            </p>
            <button className="btn secondary" onClick={pick}>
              <Upload size={16} /> Escolher arquivo
            </button>
          </>
        ) : s.step === 'checking' ? (
          <p className="small muted">Verificando o arquivo…</p>
        ) : s.step === 'password' ? (
          <>
            <p className="small" style={{ margin: 0 }}>
              <strong>{s.name}</strong> está protegido por senha.
            </p>
            {s.error && <div className="notice danger">{s.error}</div>}
            <Field label="Senha do backup">
              <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && inspect(s.name, s.text, pw)} />
            </Field>
            <div className="row">
              <button className="btn ghost" onClick={() => setS({ step: 'idle' })}>
                Cancelar
              </button>
              <button className="btn primary grow" disabled={!pw} onClick={() => inspect(s.name, s.text, pw)}>
                Abrir
              </button>
            </div>
          </>
        ) : s.step === 'error' ? (
          <>
            <div className="notice danger row" style={{ alignItems: 'flex-start' }}>
              <AlertTriangle size={18} style={{ flex: 'none' }} />
              <div>
                <strong>{s.name}</strong>: {s.error}
                {s.details && (
                  <ul className="xs" style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                    {s.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Seus dados atuais não foram alterados.
            </p>
            <button className="btn secondary" onClick={pick}>
              Escolher outro arquivo
            </button>
          </>
        ) : (
          <>
            <div className="notice calm row" style={{ alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} style={{ flex: 'none' }} />
              <div>
                Arquivo válido e íntegro{s.res.meta.encrypted ? ' (protegido por senha)' : ''}.<br />
                <span className="xs">
                  Exportado em {s.res.meta.exportedAt ? fmtDate(s.res.meta.exportedAt, { withYear: true }) : '?'} · app {s.res.meta.appVersion} · formato {s.res.meta.formatVersion} · esquema{' '}
                  {s.res.meta.schemaVersion}
                  {s.res.migratedFrom < SCHEMA_VERSION ? ` (convertido do esquema ${s.res.migratedFrom} para o ${SCHEMA_VERSION})` : ''}
                </span>
              </div>
            </div>
            {s.res.range.from && (
              <p className="small" style={{ margin: 0 }}>
                Registros de {fmtDate(s.res.range.from, { withYear: true })} a {fmtDate(s.res.range.to!, { withYear: true })}.
              </p>
            )}
            <div className="list">
              {COLLECTIONS.filter((c) => s.res.counts[c]).map((c) => (
                <div key={c} className="list-row" style={{ minHeight: 40, padding: '8px 14px' }}>
                  <span className="grow small">{COLLECTION_LABELS[c]}</span>
                  <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {s.res.counts[c]}
                  </span>
                  {preview && (
                    <span className="xs faint" style={{ minWidth: 88, textAlign: 'right' }}>
                      +{preview.perCollection[c].added} novo(s)
                    </span>
                  )}
                </div>
              ))}
            </div>
            {s.res.integrity.notes.map((n) => (
              <p key={n} className="xs muted" style={{ margin: 0 }}>
                {n}
              </p>
            ))}
            <Field label="Como importar">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'merge', label: 'Mesclar' },
                  { value: 'replace', label: 'Substituir' },
                ]}
              />
            </Field>
            {mode === 'merge' ? (
              <>
                <p className="small muted" style={{ margin: 0 }}>
                  Registros novos são acrescentados. Quando o mesmo registro existe nos dois lados (mesmo identificador) e eles diferem:
                </p>
                <div className="stack" style={{ gap: 6 }} role="radiogroup">
                  {(
                    [
                      ['newest', 'Manter a versão editada mais recentemente (recomendado)'],
                      ['keepCurrent', 'Manter sempre a versão deste aparelho'],
                      ['preferImported', 'Usar sempre a versão do arquivo'],
                    ] as Array<[DuplicateStrategy, string]>
                  ).map(([v, l]) => (
                    <label key={v} className="row small" style={{ gap: 10 }}>
                      <input type="radio" name="dup" checked={dup === v} onChange={() => setDup(v)} /> {l}
                    </label>
                  ))}
                </div>
                {preview && (
                  <p className="xs muted" style={{ margin: 0 }}>
                    Prévia: {preview.totalAdded} novo(s), {preview.totalUpdated} atualizado(s).
                  </p>
                )}
                <div className="list">
                  <Toggle label="Usar também as preferências do arquivo" help="Tema ativo, nomes da escala e indicadores. Temas personalizados são sempre mesclados." checked={prefs} onChange={setPrefs} />
                </div>
              </>
            ) : (
              <>
                <div className="notice danger small">
                  <strong>Substituir apaga os dados atuais deste aparelho</strong> e coloca no lugar exatamente o conteúdo do arquivo (inclusive tema e nomes da escala). Antes, uma cópia de
                  segurança é criada automaticamente e pode ser restaurada abaixo, em “Cópias de segurança”. As configurações de bloqueio deste aparelho são mantidas.
                </div>
                <Field label="Para confirmar, digite SUBSTITUIR">
                  <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters" />
                </Field>
              </>
            )}
            <div className="row">
              <button className="btn ghost" onClick={() => setS({ step: 'idle' })}>
                Cancelar
              </button>
              <button
                className={`btn ${mode === 'replace' ? 'danger' : 'primary'} grow`}
                disabled={mode === 'replace' && confirmText.trim().toUpperCase() !== 'SUBSTITUIR'}
                onClick={apply}
              >
                {mode === 'replace' ? 'Substituir dados' : 'Mesclar dados'}
              </button>
            </div>
          </>
        )}
      </div>
      {node}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
function CsvExport() {
  const [range, setRange] = useState<'all' | '365d' | '90d'>('all');
  const from = range === 'all' ? undefined : dayKey(periodPreset(range).from);
  const run = async (kind: 'mood' | 'exp' | 'event' | 'sleep') => {
    const data = store.getState().data;
    const csv = kind === 'mood' ? moodCsv(data, from) : kind === 'exp' ? experiencesCsv(data, from) : kind === 'sleep' ? sleepCsv(data, from) : eventsCsv(data);
    await deliverFile(`palimpsesto-${{ mood: 'humor', exp: 'experiencias', event: 'acontecimentos', sleep: 'sono' }[kind]}-${stamp()}.csv`, csv, 'text/csv');
  };
  return (
    <Section title="Planilhas (CSV)" kicker="Exportar registros">
      <div className="card stack lg">
        <p className="small muted" style={{ margin: 0 }}>
          Para abrir em planilhas. Separador “;” e acentuação preservada. Os rótulos usam seus nomes atuais; os valores numéricos são fixos.
        </p>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: '90d', label: '90 dias' },
            { value: '365d', label: '12 meses' },
            { value: 'all', label: 'Tudo' },
          ]}
        />
        <div className="grid-2">
          <button className="btn secondary" onClick={() => run('mood')}>
            Diário de humor
          </button>
          <button className="btn secondary" onClick={() => run('exp')}>
            Experiências
          </button>
          <button className="btn secondary" onClick={() => run('event')}>
            Acontecimentos
          </button>
          <button className="btn secondary" onClick={() => run('sleep')}>
            Sono
          </button>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
function PdfReport() {
  const st = useStoreState();
  const systemDark = useSystemDark();
  const [from, setFrom] = useState(dayKey(periodPreset('30d').from));
  const [to, setTo] = useState(dayKey(new Date()));
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [filters] = useSharedFilters();
  const [useFilters, setUseFilters] = useState(false);
  const hasFilters = activeCount(filters, false) > 0;
  const [busy, setBusy] = useState(false);
  const preset = (k: '30d' | '90d' | '365d') => {
    setFrom(dayKey(periodPreset(k).from));
    setTo(dayKey(new Date()));
  };
  const run = async () => {
    setBusy(true);
    try {
      const period = { from: new Date(from + 'T00:00:00'), to: new Date(to + 'T23:59:59.999') };
      const { buildReport } = await import('../../report/pdf');
      const ctx = contextFor(st.data);
      const f = { ...filters, type: 'mood' as const, period: 'all' as const };
      const bytes = buildReport(st.data, period, sections, resolveTokens({ ...st.data.preferences, appearance: 'light' }, systemDark), {
        entryFilter: useFilters && hasFilters ? (m) => matchMood(m, f, ctx) : undefined,
        filterLabel: useFilters && hasFilters ? describeFilters({ ...filters, type: 'all' }, st.data, (v) => valenceLabel(v, st.data.preferences.valenceLabels), false).join(', ') : undefined,
      });
      await deliverFile(`palimpsesto-relatorio-${from}-a-${to}.pdf`, bytes, 'application/pdf');
    } catch (e: any) {
      toast(`Não foi possível gerar o relatório: ${e?.message ?? e}`, 5000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Relatório em PDF" kicker="Exportar">
      <div className="card stack lg">
        <div className="chips">
          <button className="chip" onClick={() => preset('30d')}>
            30 dias
          </button>
          <button className="chip" onClick={() => preset('90d')}>
            3 meses
          </button>
          <button className="chip" onClick={() => preset('365d')}>
            12 meses
          </button>
        </div>
        <div className="grid-2">
          <Field label="De">
            <input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </Field>
          <Field label="Até">
            <input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="Incluir">
          <div className="stack" style={{ gap: 8 }}>
            {(Object.keys(REPORT_SECTIONS) as ReportSection[]).map((k) => (
              <label key={k} className="row small" style={{ gap: 10 }}>
                <input type="checkbox" checked={sections.includes(k)} onChange={(e) => setSections(e.target.checked ? [...sections, k] : sections.filter((x) => x !== k))} />
                {REPORT_SECTIONS[k]}
              </label>
            ))}
          </div>
        </Field>
        {hasFilters && (
          <div className="list">
            <Toggle
              label="Aplicar os filtros atuais da Trajetória"
              help={describeFilters({ ...filters, type: 'all' }, st.data, (v) => valenceLabel(v, st.data.preferences.valenceLabels), false).join(' · ')}
              checked={useFilters}
              onChange={setUseFilters}
            />
          </div>
        )}
        <p className="xs muted" style={{ margin: 0 }}>
          Nada sai do aparelho sem você escolher: o PDF é gerado aqui e você decide com quem compartilhar.
        </p>
        <button className="btn primary" disabled={!sections.length || busy} onClick={run}>
          <FileText size={16} /> {busy ? 'Gerando…' : 'Gerar PDF'}
        </button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
function SafetyCopies() {
  const [list, setList] = useState<Array<{ key: string; reason: string; createdAt: string }>>([]);
  const { ask, node } = useConfirm();
  const st = useStoreState();
  useEffect(() => {
    store.listSafetyCopies().then(setList).catch(() => setList([]));
  }, [st.data]);
  return (
    <Section title="Cópias de segurança" kicker="Automáticas">
      <p className="small muted">Criadas antes de cada importação ou restauração. As cinco mais recentes ficam guardadas neste aparelho.</p>
      {list.length === 0 ? (
        <p className="small faint">Nenhuma cópia ainda.</p>
      ) : (
        <div className="list">
          {list.map((c) => (
            <div key={c.key} className="list-row">
              <History size={18} className="faint" />
              <div className="grow">
                <div className="title small">{c.reason}</div>
                <div className="meta">{c.createdAt ? `${fmtDate(c.createdAt, { withYear: true })}, ${new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
              </div>
              <button
                className="btn ghost sm"
                onClick={async () => {
                  if (
                    await ask({
                      title: 'Restaurar esta cópia?',
                      body: 'Os dados atuais serão substituídos por esta cópia. Antes, o estado atual também será guardado como cópia.',
                      confirm: 'Restaurar',
                    })
                  ) {
                    try {
                      await store.restoreSafetyCopy(c.key);
                      toast('Cópia restaurada.');
                    } catch (e: any) {
                      toast(`Falha ao restaurar: ${e?.message ?? e}`, 5000);
                    }
                  }
                }}
              >
                Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
      {node}
    </Section>
  );
}
