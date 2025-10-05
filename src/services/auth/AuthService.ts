import { isClerkAPIResponseError, type TokenCache } from '@clerk/clerk-expo';
import type { UserResource } from '@clerk/types';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { logger } from '@/services/logger/LoggerService';

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  displayName: string;
}

const TOKEN_CACHE_KEY_PREFIX = 'ClerkToken:';
const CLERK_PUBLISHABLE_KEY_ENV = 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY';

const getStorageKey = (key: string): string => `${TOKEN_CACHE_KEY_PREFIX}${key}`;

export const clerkTokenCache: TokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(getStorageKey(key));
    } catch (error) {
      void logger.warn('Failed to read Clerk token from secure storage.', {
        location: 'AuthService.clerkTokenCache.getToken',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
  saveToken: async (key: string, token: string): Promise<void> => {
    try {
      if (!token) {
        await SecureStore.deleteItemAsync(getStorageKey(key));
        return;
      }

      await SecureStore.setItemAsync(getStorageKey(key), token);
    } catch (error) {
      void logger.error('Failed to persist Clerk token to secure storage.', {
        location: 'AuthService.clerkTokenCache.saveToken',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  clearToken: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(getStorageKey(key));
    } catch (error) {
      void logger.warn('Failed to clear Clerk token from secure storage.', {
        location: 'AuthService.clerkTokenCache.clearToken',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

export const getClerkPublishableKey = (): string => {
  const envValue = process.env[CLERK_PUBLISHABLE_KEY_ENV];
  const configValue =
    typeof Constants.expoConfig?.extra?.clerkPublishableKey === 'string'
      ? Constants.expoConfig.extra.clerkPublishableKey
      : undefined;

  const key = envValue ?? configValue;

  if (!key || key.trim().length === 0) {
    throw new Error(
      'Clerk publishable key is not configured. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before running the app.',
    );
  }

  return key;
};

export const mapClerkUser = (user: UserResource | null | undefined): AuthUser | null => {
  if (!user) {
    return null;
  }

  const primaryEmail =
    user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;

  const displayName =
    user.fullName ?? user.username ?? primaryEmail ?? user.id;

  return {
    id: user.id,
    email: primaryEmail,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    imageUrl: user.imageUrl ?? null,
    displayName,
  };
};

export const getClerkErrorMessage = (
  error: unknown,
  fallbackMessage = 'Unable to complete the request. Please try again.',
): string => {
  if (isClerkAPIResponseError(error)) {
    const firstError = error.errors?.[0];
    if (firstError?.message) {
      return firstError.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};
