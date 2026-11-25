import { useSyncExternalStore } from 'react';
import { Store, type StoreState } from '../data/store';
import { createStorage } from '../platform/native';

export const store = new Store(createStorage());

export function useStoreState(): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useData() {
  return useStoreState().data;
}

export function usePrefs() {
  return useStoreState().data.preferences;
}
