import { TmdbConnector } from "@/connectors/implementations/TmdbConnector";
import {
  getStoredTmdbKey,
  subscribeToTmdbKey,
} from "@/services/tmdb/TmdbCredentialService";

let cached: {
  key: string;
  connector: TmdbConnector;
} | null = null;

const resetCache = () => {
  cached = null;
};

subscribeToTmdbKey(() => {
  resetCache();
});

export const getTmdbConnector = async (): Promise<TmdbConnector | null> => {
  const key = await getStoredTmdbKey();
  if (!key) {
    resetCache();
    return null;
  }

  if (!cached || cached.key !== key) {
    cached = {
      key,
      connector: new TmdbConnector(key),
    };
  }

  return cached.connector;
};

export const ensureTmdbConnector = async (): Promise<TmdbConnector> => {
  const connector = await getTmdbConnector();
  if (!connector) {
    throw new Error("TMDB API key is not configured.");
  }

  return connector;
};

export const clearTmdbConnectorCache = () => {
  resetCache();
};
