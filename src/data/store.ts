/**
 * Store central: mantém o documento AppData em memória, expõe operações
 * imutáveis e persiste de forma serializada (uma escrita por vez), com
 * debounce, cópia da sessão anterior e cópias de segurança antes de
 * operações destrutivas.
 */
import {
  SCHEMA_VERSION,
  AppDataSchema,
  CollectionSchemas,
  DeviceSettingsSchema,
  type AppData,
  type CollectionName,
  type DeviceSettings,
  type EntityOf,
  type Known,
  type Preferences,
} from '../domain/schema';
import type { z } from 'zod';
import { newId, nowIso } from '../domain/util';
import { defaultDevice, initialData, syncBuiltIns } from './defaults';
import { parseAppData, repairIntegrity } from './validate';
import type { StorageAdapter } from './storage';

export const KEY_DATA = 'data.json';
export const KEY_PREV = 'data.prev.json';
export const KEY_DEVICE = 'device.json';
export const SAFETY_PREFIX = 'safety-';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface StoreState {
  data: AppData;
  device: DeviceSettings;
  ready: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  /** Mensagem exibida uma vez se foi preciso recuperar dados. */
  recoveryNotice: string | null;
}

type Listener = () => void;
/** Entidade nova: campos com valor padrão no esquema são opcionais. */
type NewEntity<C extends CollectionName> = Omit<Known<z.input<(typeof CollectionSchemas)[C]>>, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<EntityOf<C>, 'id' | 'createdAt' | 'updatedAt'>>;

export class Store {
  private state: StoreState;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private dirtyData = false;
  private dirtyDevice = false;

  constructor(
    private storage: StorageAdapter,
    private debounceMs = 350,
  ) {
    this.state = {
      data: initialData(),
      device: defaultDevice(),
      ready: false,
      saveStatus: 'idle',
      saveError: null,
      recoveryNotice: null,
    };
  }

  /* ------------------------------ assinatura ------------------------------ */
  getState = () => this.state;
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /* ------------------------------ carregamento ---------------------------- */
  async load(): Promise<void> {
    const notices: string[] = [];
    let data: AppData | null = null;

    let migratedFrom = SCHEMA_VERSION;
    let rawMain: string | null = null;
    const tryKey = async (key: string): Promise<AppData | null> => {
      const raw = await this.storage.read(key).catch(() => null);
      if (raw === null) return null;
      try {
        const parsed = parseAppData(JSON.parse(raw));
        if (parsed.ok) {
          migratedFrom = parsed.migratedFrom;
          rawMain = raw;
          return parsed.data;
        }
        throw new Error(parsed.error);
      } catch (e) {
        // Preserva o arquivo problemático para eventual recuperação manual.
        await this.storage.write(`corrupt-${Date.now()}-${key}`, raw).catch(() => {});
        throw e;
      }
    };

    let hadMain = false;
    try {
      hadMain = (await this.storage.read(KEY_DATA).catch(() => null)) !== null;
      data = await tryKey(KEY_DATA);
    } catch (e: any) {
      notices.push(`O arquivo principal não pôde ser lido (${e?.message ?? e}).`);
      try {
        data = await tryKey(KEY_PREV);
        if (data) notices.push('Os dados foram restaurados da cópia da sessão anterior.');
      } catch {
        data = null;
      }
      if (!data) notices.push('Não havia cópia válida; uma cópia do arquivo danificado foi preservada.');
    }

    const fresh = !data;
    data = syncBuiltIns(data ?? initialData());

    let device = defaultDevice();
    const rawDevice = await this.storage.read(KEY_DEVICE).catch(() => null);
    if (rawDevice) {
      try {
        device = DeviceSettingsSchema.parse(JSON.parse(rawDevice));
      } catch {
        notices.push('As configurações do dispositivo foram redefinidas.');
      }
    }

    // Atualização de formato: guarda o arquivo original intacto antes de gravar o novo.
    const migrated = !fresh && migratedFrom < SCHEMA_VERSION;
    if (migrated && rawMain) {
      await this.storage.write(`pre-migration-v${migratedFrom}.json`, rawMain).catch(() => {});
      const key = `${SAFETY_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await this.storage
        .write(key, JSON.stringify({ reason: `Antes da atualização do formato dos dados (v${migratedFrom} → v${SCHEMA_VERSION})`, createdAt: nowIso(), data: JSON.parse(rawMain) }))
        .catch(() => {});
    }

    this.set({ data, device, ready: true, recoveryNotice: notices.length ? notices.join(' ') : null });

    // Cópia da sessão anterior: o último arquivo bom vira data.prev.json.
    if (hadMain && !notices.length && !migrated) {
      await this.storage.write(KEY_PREV, JSON.stringify(data)).catch(() => {});
    }
    if (fresh || notices.length || migrated) {
      this.dirtyData = true;
      await this.flush();
    }
  }

  /* ------------------------------ persistência ---------------------------- */
  private schedule() {
    this.set({ saveStatus: 'pending' });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  /** Grava imediatamente o que estiver pendente. Seguro para chamar várias vezes. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.chain = this.chain.then(async () => {
      if (!this.dirtyData && !this.dirtyDevice) return;
      const writeData = this.dirtyData;
      const writeDevice = this.dirtyDevice;
      this.dirtyData = false;
      this.dirtyDevice = false;
      this.set({ saveStatus: 'saving' });
      try {
        if (writeData) await this.storage.write(KEY_DATA, JSON.stringify(this.state.data));
        if (writeDevice) await this.storage.write(KEY_DEVICE, JSON.stringify(this.state.device));
        this.set({ saveStatus: this.dirtyData || this.dirtyDevice ? 'pending' : 'saved', saveError: null });
      } catch (e: any) {
        // Mantém marcado como sujo para tentar de novo na próxima alteração/flush.
        this.dirtyData ||= writeData;
        this.dirtyDevice ||= writeDevice;
        this.set({ saveStatus: 'error', saveError: e?.message ?? String(e) });
      }
    });
    return this.chain;
  }

  private commitData(data: AppData) {
    this.dirtyData = true;
    this.set({ data });
    this.schedule();
  }

  /* ------------------------------ operações ------------------------------- */
  list<C extends CollectionName>(c: C): EntityOf<C>[] {
    return (this.state.data as any)[c];
  }

  get<C extends CollectionName>(c: C, id: string): EntityOf<C> | undefined {
    return this.list(c).find((e: any) => e.id === id);
  }

  /** Cria ou atualiza uma entidade (validada pelo esquema). Retorna a entidade salva. */
  upsert<C extends CollectionName>(c: C, entity: NewEntity<C> | EntityOf<C>): EntityOf<C> {
    const now = nowIso();
    const prev = entity.id ? this.get(c, entity.id) : undefined;
    const candidate = {
      ...entity,
      id: entity.id ?? newId(),
      createdAt: (prev)?.createdAt ?? entity.createdAt ?? now,
      updatedAt: now,
    };
    const parsed = (CollectionSchemas[c]).parse(candidate) as EntityOf<C>;
    const arr = this.list(c);
    const next = prev ? arr.map((e: any) => (e.id === parsed.id ? parsed : e)) : [...arr, parsed];
    this.commitData({ ...this.state.data, [c]: next });
    return parsed;
  }

  /** Atualização parcial de uma entidade existente. */
  patch<C extends CollectionName>(c: C, id: string, patch: Partial<EntityOf<C>>): EntityOf<C> | undefined {
    const prev = this.get(c, id);
    if (!prev) return undefined;
    return this.upsert(c, { ...prev, ...patch, id } as EntityOf<C>);
  }

  /**
   * Sono da noite que terminou em `date`: cria ou atualiza A noite daquela data
   * (nunca uma segunda). Sem nenhuma informação, a noite é removida.
   */
  setSleep(date: string, patch: { hours?: number | null; quality?: number | null; troubles?: string[]; factors?: string[]; note?: string }) {
    const cur = this.list('sleepLogs').find((s) => s.date === date);
    const next = { hours: null, quality: null, troubles: [], factors: [], note: '', ...cur, ...patch, date } as any;
    const empty = next.hours == null && next.quality == null && !next.troubles.length && !next.factors.length && !next.note.trim();
    if (empty) {
      if (cur) this.remove('sleepLogs', cur.id);
      return undefined;
    }
    return this.upsert('sleepLogs', next);
  }

  /** Remove uma entidade aplicando as regras de cascata. */
  remove(c: CollectionName, id: string) {
    this.commitData(removeWithCascade(this.state.data, c, id));
  }

  /**
   * Remove e devolve uma função que desfaz a exclusão. Se nada mudou desde
   * então, volta exatamente ao estado anterior (inclusive as referências
   * limpas pela cascata); se houve outras alterações, só recoloca o que foi
   * removido, sem desfazer o trabalho feito depois.
   */
  removeUndoable(c: CollectionName, id: string): () => void {
    const before = this.state.data;
    this.remove(c, id);
    const after = this.state.data;
    return () => {
      if (this.state.data === after) return this.commitData(before);
      const next: any = { ...this.state.data };
      for (const k of Object.keys(before) as Array<keyof AppData>) {
        const old = before[k];
        if (!Array.isArray(old)) continue;
        const oldById = new Map((old as Array<{ id: string }>).map((e) => [e.id, e]));
        const afterList = after[k] as Array<{ id: string }>;
        const afterIds = new Set(afterList.map((e) => e.id));
        // Referências limpas pela cascata (ex.: a emoção tirada dos registros) voltam
        // nos itens que NÃO foram mexidos depois da exclusão (mesmo objeto de `after`).
        // Um item editado depois fica como está: o trabalho posterior não é desfeito.
        const touched = new Set(afterList.filter((e) => oldById.has(e.id) && oldById.get(e.id) !== e));
        let cur = (next[k] ?? []) as Array<{ id: string }>;
        if (touched.size) cur = cur.map((e) => (touched.has(e) ? oldById.get(e.id)! : e));
        const ids = new Set(cur.map((e) => e.id));
        const back = (old as Array<{ id: string }>).filter((e) => !ids.has(e.id) && !afterIds.has(e.id));
        if (back.length || touched.size) next[k] = [...cur, ...back];
      }
      // O que voltou pode apontar para algo apagado nesse meio-tempo.
      this.transact(() => repairIntegrity(next).data);
    };
  }

  setPreferences(patch: Partial<Preferences>) {
    const preferences = AppDataSchema.shape.preferences.parse({ ...this.state.data.preferences, ...patch });
    this.commitData({ ...this.state.data, preferences });
  }

  setDevice(patch: Partial<DeviceSettings>) {
    const device = DeviceSettingsSchema.parse({ ...this.state.device, ...patch });
    this.dirtyDevice = true;
    this.set({ device });
    this.schedule();
  }

  /** Mutação livre e atômica sobre o documento (validada antes de aplicar). */
  transact(fn: (d: AppData) => AppData) {
    const next = AppDataSchema.parse(fn(this.state.data));
    this.commitData(next);
  }

  clearRecoveryNotice() {
    this.set({ recoveryNotice: null });
  }

  /* ------------------------- cópias de segurança -------------------------- */
  async createSafetyCopy(reason: string): Promise<string> {
    await this.flush();
    const key = `${SAFETY_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await this.storage.write(key, JSON.stringify({ reason, createdAt: nowIso(), data: this.state.data }));
    // Mantém apenas as 5 mais recentes.
    const all = await this.storage.list(SAFETY_PREFIX);
    for (const old of all.slice(0, Math.max(0, all.length - 5))) await this.storage.remove(old).catch(() => {});
    return key;
  }

  async listSafetyCopies(): Promise<Array<{ key: string; reason: string; createdAt: string }>> {
    const keys = await this.storage.list(SAFETY_PREFIX);
    const out = [];
    for (const key of keys.reverse()) {
      try {
        const raw = JSON.parse((await this.storage.read(key)) ?? '{}');
        out.push({ key, reason: String(raw.reason ?? ''), createdAt: String(raw.createdAt ?? '') });
      } catch {
        /* ignora */
      }
    }
    return out;
  }

  async restoreSafetyCopy(key: string) {
    const raw = await this.storage.read(key);
    if (!raw) throw new Error('Cópia de segurança não encontrada.');
    const parsed = parseAppData(JSON.parse(raw).data);
    if (!parsed.ok) throw new Error(parsed.error);
    await this.replaceAll(parsed.data, 'Antes de restaurar uma cópia de segurança');
  }

  /**
   * Substitui todo o documento (importação/restauração). Os dados recebidos
   * já devem ter sido validados. Uma cópia de segurança do estado atual é
   * criada ANTES, e a gravação é imediata.
   */
  async replaceAll(data: AppData, safetyReason: string) {
    const valid = AppDataSchema.parse(data);
    await this.createSafetyCopy(safetyReason);
    this.dirtyData = true;
    this.set({ data: syncBuiltIns(valid) });
    await this.flush();
    if (this.state.saveStatus === 'error') throw new Error(this.state.saveError ?? 'Falha ao gravar.');
  }

  /** Apaga definitivamente todos os dados pessoais desta instalação. */
  async eraseEverything() {
    for (const k of await this.storage.list('')) await this.storage.remove(k).catch(() => {});
    this.dirtyData = true;
    this.dirtyDevice = true;
    this.set({ data: initialData(), device: defaultDevice() });
    await this.flush();
    // Sobrescreve também a cópia da sessão anterior.
    await this.storage.remove(KEY_PREV).catch(() => {});
  }
}

/* ------------------------------------------------------------------------ */
/* Regras de remoção em cascata                                              */
/* ------------------------------------------------------------------------ */
export function removeWithCascade(data: AppData, c: CollectionName, id: string): AppData {
  const d: any = { ...data, [c]: (data)[c].filter((e: any) => e.id !== id) };
  const strip = (arr: string[]) => arr.filter((x) => x !== id);
  switch (c) {
    case 'emotions':
      d.moodEntries = d.moodEntries.map((m: any) => (m.emotionIds.includes(id) ? { ...m, emotionIds: strip(m.emotionIds) } : m));
      d.experiences = d.experiences.map((m: any) => (m.emotionIds.includes(id) ? { ...m, emotionIds: strip(m.emotionIds) } : m));
      break;
    case 'repertoire':
      d.uses = d.uses.filter((u: any) => u.itemId !== id);
      d.moodEntries = d.moodEntries.map((m: any) => (m.itemIds?.includes(id) ? { ...m, itemIds: strip(m.itemIds) } : m));
      d.situations = d.situations.map((s: any) => ({ ...s, itemIds: strip(s.itemIds) }));
      break;
    case 'experiences':
      d.uses = d.uses.filter((u: any) => u.experienceId !== id);
      d.discoveries = d.discoveries.map((x: any) => ({ ...x, experienceIds: strip(x.experienceIds) }));
      break;
    case 'sections': {
      const qids = new Set(d.questions.filter((q: any) => q.sectionId === id).map((q: any) => q.id));
      const nids = new Set(d.notes.filter((n: any) => n.sectionId === id).map((n: any) => n.id));
      d.questions = d.questions.filter((q: any) => q.sectionId !== id);
      d.answers = d.answers.filter((a: any) => !qids.has(a.questionId));
      d.notes = d.notes.filter((n: any) => n.sectionId !== id);
      d.discoveries = d.discoveries.map((x: any) => (x.sectionId === id ? { ...x, sectionId: null } : x));
      d.situations = d.situations.map((s: any) => ({
        ...s,
        questionIds: s.questionIds.filter((q: string) => !qids.has(q)),
        noteIds: s.noteIds.filter((n: string) => !nids.has(n)),
      }));
      break;
    }
    case 'questions':
      d.answers = d.answers.filter((a: any) => a.questionId !== id);
      d.situations = d.situations.map((s: any) => ({ ...s, questionIds: strip(s.questionIds) }));
      break;
    case 'notes':
      d.situations = d.situations.map((s: any) => ({ ...s, noteIds: strip(s.noteIds) }));
      break;
    case 'discoveries':
      d.situations = d.situations.map((s: any) => ({ ...s, discoveryIds: strip(s.discoveryIds) }));
      break;
    case 'situations':
      d.experiences = d.experiences.map((x: any) => (x.situationId === id ? { ...x, situationId: null } : x));
      d.letters = d.letters.map((x: any) => (x.situationId === id ? { ...x, situationId: null } : x));
      break;
    case 'moodEntries':
      d.discoveries = d.discoveries.map((x: any) => (x.moodEntryIds?.includes(id) ? { ...x, moodEntryIds: strip(x.moodEntryIds) } : x));
      break;
    case 'events':
      d.discoveries = d.discoveries.map((x: any) => (x.eventIds?.includes(id) ? { ...x, eventIds: strip(x.eventIds) } : x));
      break;
    case 'letters':
      d.situations = d.situations.map((s: any) => ({ ...s, letterIds: strip(s.letterIds) }));
      break;
    case 'appointments':
      // Os assuntos da pauta continuam existindo; só deixam de apontar para a consulta.
      d.agenda = d.agenda.map((a: any) => (a.appointmentId === id ? { ...a, appointmentId: null } : a));
      break;
  }
  return d as AppData;
}
