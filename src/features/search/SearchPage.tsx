import { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { navigate } from '../../app/router';
import { useData } from '../../app/store';
import { searchAll, SEARCH_KIND_LABELS, type SearchKind } from '../../domain/search';
import { PERIOD_LABELS, periodDays, type PeriodKind } from '../../domain/filters';
import { fold } from '../../domain/util';
import { fmtDate, Page } from '../../ui/components';

function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const f = fold(text);
  const marks: Array<[number, number]> = [];
  for (const w of words) {
    let i = f.indexOf(w);
    while (i >= 0) {
      marks.push([i, i + w.length]);
      i = f.indexOf(w, i + w.length);
    }
  }
  if (!marks.length || f.length !== text.length) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  marks.forEach(([a, b], k) => {
    if (a < pos) return;
    out.push(text.slice(pos, a));
    out.push(
      <mark key={k} style={{ background: 'var(--accent-soft)', color: 'inherit', borderRadius: 3 }}>
        {text.slice(a, b)}
      </mark>,
    );
    pos = b;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

export function SearchPage() {
  const data = useData();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [kinds, setKinds] = useState<SearchKind[]>([]);
  const [period, setPeriod] = useState<PeriodKind>('all');
  const range = periodDays({ period, from: null, to: null });
  const hits = useMemo(() => searchAll(data, dq, { kinds, from: range.from, to: range.to }), [data, dq, kinds, range.from, range.to]);
  const words = fold(dq).split(' ').filter((w) => w.length >= 2);
  const groups = useMemo(() => {
    const m = new Map<SearchKind, typeof hits>();
    hits.forEach((h) => m.set(h.kind, [...(m.get(h.kind) ?? []), h]));
    return [...m.entries()];
  }, [hits]);

  return (
    <Page back="/" noNav title="Buscar" ghost="procurar">
      <div className="row" style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: 12, color: 'var(--ink-faint)' }} aria-hidden />
        <input
          className="input"
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Palavras, emoções, atividades, pessoas…"
          aria-label="Buscar em todo o Palimpsesto"
          style={{ paddingLeft: 38 }}
        />
      </div>
      <div className="chips" style={{ marginTop: 12 }} role="group" aria-label="Tipos">
        {(Object.keys(SEARCH_KIND_LABELS) as SearchKind[]).map((k) => (
          <button key={k} className="chip" aria-pressed={kinds.includes(k)} onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
            {SEARCH_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Período">
        {(['all', '30d', '90d', '365d'] as PeriodKind[]).map((p) => (
          <button key={p} className="chip" aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {period !== 'all' && <p className="xs faint">Com período, só aparecem itens datados (registros, experiências, acontecimentos, descobertas, situações).</p>}

      {words.length === 0 ? (
        <p className="small muted" style={{ marginTop: 20 }}>
          A busca percorre todo o aplicativo, neste aparelho: diário, acontecimentos, descobertas, respostas e anotações do Mapa, repertório, situações e cartas (exceto as lacradas).
        </p>
      ) : hits.length === 0 ? (
        <p className="small muted" style={{ marginTop: 20 }}>
          Nada encontrado para “{dq}”.
        </p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p className="xs faint">{hits.length} resultado(s)</p>
          {groups.map(([kind, list]) => (
            <section key={kind} className="section" style={{ margin: '14px 0' }}>
              <p className="kicker">
                {SEARCH_KIND_LABELS[kind]} · {list.length}
              </p>
              <div className="list">
                {list.slice(0, 20).map((h) => (
                  <button key={h.id} className="list-row" onClick={() => navigate(h.route)}>
                    <div className="grow">
                      <div className="title">
                        <Highlight text={h.title} words={words} />
                      </div>
                      {h.snippet && (
                        <div className="meta">
                          <Highlight text={h.snippet} words={words} />
                        </div>
                      )}
                    </div>
                    {h.day && <span className="xs faint" style={{ whiteSpace: 'nowrap' }}>{fmtDate(h.day, { short: true })}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
