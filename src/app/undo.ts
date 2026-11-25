import type { CollectionName } from '../domain/schema';
import { store } from './store';
import { toast } from './toast';

/** Exclui e oferece "Desfazer" por alguns segundos. */
export function removeWithUndo(c: CollectionName, id: string, message: string) {
  const undo = store.removeUndoable(c, id);
  toast(message, { action: { label: 'Desfazer', run: () => (undo(), toast('Restaurado.')) } });
}
