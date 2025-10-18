import { useEffect, useState, useCallback } from "react";

import {
  getStoredTmdbKey,
  removeStoredTmdbKey,
  setStoredTmdbKey,
  subscribeToTmdbKey,
} from "@/services/tmdb/TmdbCredentialService";

export const useTmdbKey = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadKey = async () => {
      try {
        const stored = await getStoredTmdbKey();
        if (isMounted) {
          setApiKey(stored);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadKey();

    const unsubscribe = subscribeToTmdbKey((value) => {
      if (isMounted) {
        setApiKey(value);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const saveKey = useCallback(async (value: string) => {
    await setStoredTmdbKey(value);
  }, []);

  const clearKey = useCallback(async () => {
    await removeStoredTmdbKey();
  }, []);

  return {
    apiKey,
    isLoading,
    saveKey,
    clearKey,
  };
};
