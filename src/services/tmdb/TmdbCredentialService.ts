import { secureStorage } from '@/services/storage/SecureStorage';

export const TMDB_API_KEY_STORAGE_KEY = 'tmdb_api_key';

type Listener = (value: string | null) => void;

let cachedKey: string | null | undefined;
const subscribers = new Set<Listener>();

const notify = (value: string | null) => {
  subscribers.forEach((listener) => {
    try {
      listener(value);
    } catch (error) {
      // Swallow listener errors to avoid breaking notifier fan-out.
      console.warn('[TmdbCredentialService] listener error', error);
    }
  });
};

export const subscribeToTmdbKey = (listener: Listener): (() => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const getStoredTmdbKey = async (forceRefresh = false): Promise<string | null> => {
  if (!forceRefresh && typeof cachedKey !== 'undefined') {
    return cachedKey;
  }

  const stored = await secureStorage.getItem(TMDB_API_KEY_STORAGE_KEY);
  cachedKey = stored ?? null;
  return cachedKey;
};

export const setStoredTmdbKey = async (value: string): Promise<void> => {
  cachedKey = value;
  await secureStorage.setItem(TMDB_API_KEY_STORAGE_KEY, value);
  notify(value);
};

export const removeStoredTmdbKey = async (): Promise<void> => {
  cachedKey = null;
  await secureStorage.removeItem(TMDB_API_KEY_STORAGE_KEY);
  notify(null);
};

export const hasStoredTmdbKey = async (): Promise<boolean> => {
  const key = await getStoredTmdbKey();
  return typeof key === 'string' && key.length > 0;
};
