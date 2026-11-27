import { useEffect, useRef, useState } from 'react';
import { store } from '../app/store';
import type { CollectionName, EntityOf } from '../domain/schema';

/**
 * Salvamento automático de editores: nada se perde ao voltar, e nada é
 * criado enquanto o rascunho estiver vazio.
 *
 * - `draft` é o estado do editor (sem id para itens novos).
 * - `meaningful(draft)` decide se já vale gravar.
 * - `transform(prev, draft)` permite criar camadas/revisões antes de gravar.
 */
export function useAutosave<C extends CollectionName>(
  collection: C,
  draft: any,
  opts: {
    initialId: string | null;
    meaningful: (d: any) => boolean;
    transform?: (prev: EntityOf<C> | undefined, next: any) => any;
    delay?: number;
    onCreated?: (id: string) => void;
  },
) {
  const idRef = useRef<string | null>(opts.initialId);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const latest = useRef(draft);
  const dirty = useRef(false);
  const first = useRef(true);
  const cancelled = useRef(false);
  latest.current = draft;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const saveNow = () => {
    if (cancelled.current || !dirty.current) return idRef.current;
    const d = latest.current;
    const o = optsRef.current;
    if (!o.meaningful(d)) return idRef.current;
    const prev = idRef.current ? store.get(collection, idRef.current) : undefined;
    const value = o.transform ? o.transform(prev, d) : d;
    const saved = store.upsert(collection, { ...prev, ...value, id: idRef.current ?? undefined });
    const created = !idRef.current;
    idRef.current = saved.id;
    dirty.current = false;
    setSavedAt(Date.now());
    if (created) o.onCreated?.(saved.id);
    return saved.id;
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    const t = setTimeout(saveNow, opts.delay ?? 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Ao sair do editor, grava o que estiver pendente.
  useEffect(() => () => void saveNow(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Impede gravações futuras (ex.: após excluir o item). */
  const cancel = () => {
    cancelled.current = true;
  };

  return { id: idRef, saveNow, savedAt, cancel };
}

/** Acrescenta uma camada quando um texto já assentado é reescrito. */
export const LAYER_AFTER_MS = 60 * 60 * 1000;
export function withLayer<T extends { text: string; updatedAt: string; layers: Array<{ text: string; at: string }> }>(
  prev: T | undefined,
  nextText: string,
  now = Date.now(),
): Array<{ text: string; at: string }> {
  if (!prev) return [];
  const settled = now - new Date(prev.updatedAt).getTime() > LAYER_AFTER_MS;
  if (settled && prev.text.trim() && prev.text.trim() !== nextText.trim()) {
    return [...prev.layers, { text: prev.text, at: prev.updatedAt }];
  }
  return prev.layers;
}
