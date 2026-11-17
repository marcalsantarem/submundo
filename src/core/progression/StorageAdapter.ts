import type { SaveProfile } from '../index';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_STORAGE_KEY = 'submundo_save_v1';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}

const memoryStorageFallback: StorageLike = createMemoryStorage();

function isStorageLike(candidate: unknown): candidate is StorageLike {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const maybe = candidate as Partial<StorageLike>;
  return (
    typeof maybe.getItem === 'function' &&
    typeof maybe.setItem === 'function' &&
    typeof maybe.removeItem === 'function'
  );
}

function isValidSaveProfile(value: unknown): value is SaveProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<SaveProfile>;
  return (
    typeof candidate.version === 'number' &&
    typeof candidate.souls === 'number' &&
    typeof candidate.generalEssences === 'number' &&
    typeof candidate.altarLevels === 'object' &&
    candidate.altarLevels !== null &&
    typeof candidate.equipped === 'object' &&
    candidate.equipped !== null &&
    Array.isArray(candidate.stash) &&
    typeof candidate.maxStashSize === 'number' &&
    typeof candidate.itemUpgradeLevels === 'object' &&
    candidate.itemUpgradeLevels !== null &&
    typeof candidate.stats === 'object' &&
    candidate.stats !== null
  );
}

export function getDefaultStorage(): StorageLike {
  try {
    const candidate = (globalThis as { localStorage?: unknown }).localStorage;
    if (isStorageLike(candidate)) {
      return candidate;
    }
  } catch {
    // Fallback para armazenamento em memória quando localStorage não está disponível
  }
  return memoryStorageFallback;
}

export function saveProfileToStorage(
  profile: SaveProfile,
  storage: StorageLike = getDefaultStorage()
): boolean {
  try {
    const serialized = JSON.stringify(profile);
    storage.setItem(SAVE_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadProfileFromStorage(
  storage: StorageLike = getDefaultStorage()
): SaveProfile | null {
  try {
    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSaveProfile(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearProfileStorage(
  storage: StorageLike = getDefaultStorage()
): void {
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignora erros ao limpar storage indisponível
  }
}
