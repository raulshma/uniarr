import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/services/logger/LoggerService';
import type { NotificationMessage } from '@/models/notification.types';

const TOKEN_STORAGE_KEY = 'PushNotificationService:expoPushToken';

class PushNotificationService {
  private static instance: PushNotificationService | null = null;

  private isInitialized = false;

  private expoPushToken: string | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }

    return PushNotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFFFFF',
        sound: 'default',
      });
    }

    try {
      this.expoPushToken = (await AsyncStorage.getItem(TOKEN_STORAGE_KEY)) ?? null;
    } catch (error) {
      await logger.warn('Failed to load stored Expo push token.', {
        location: 'PushNotificationService.initialize',
        error: error instanceof Error ? error.message : String(error),
      });
      this.expoPushToken = null;
    }

    this.isInitialized = true;
  }

  getStoredExpoToken(): string | null {
    return this.expoPushToken;
  }

  async ensureRegistered(): Promise<string | null> {
    await this.initialize();

    if (this.expoPushToken) {
      return this.expoPushToken;
    }

    const granted = await this.requestPermissions();
    if (!granted) {
      return null;
    }

    try {
      const projectId = this.resolveProjectId();
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      this.expoPushToken = tokenResponse.data;
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, tokenResponse.data);

      await logger.info('Expo push token acquired.', {
        location: 'PushNotificationService.ensureRegistered',
      });

      return tokenResponse.data;
    } catch (error) {
      await logger.error('Unable to register for push notifications.', {
        location: 'PushNotificationService.ensureRegistered',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async unregister(): Promise<void> {
    this.expoPushToken = null;

    try {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      await logger.warn('Failed to clear stored Expo push token.', {
        location: 'PushNotificationService.unregister',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async presentImmediateNotification(message: NotificationMessage): Promise<void> {
    await this.initialize();

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
          data: {
            category: message.category,
            ...(message.data ?? {}),
          },
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      await logger.error('Failed to schedule notification.', {
        location: 'PushNotificationService.presentImmediateNotification',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async requestPermissions(): Promise<boolean> {
    try {
      const currentPermissions = await Notifications.getPermissionsAsync();

      if (currentPermissions.granted) {
        return true;
      }

      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) {
        await logger.warn('Push notification permission denied by user.', {
          location: 'PushNotificationService.requestPermissions',
        });
        return false;
      }

      return true;
    } catch (error) {
      await logger.error('Failed to request push notification permissions.', {
        location: 'PushNotificationService.requestPermissions',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private resolveProjectId(): string | undefined {
    const easProjectId = Constants?.expoConfig?.extra?.eas?.projectId;
    if (typeof easProjectId === 'string' && easProjectId.length > 0) {
      return easProjectId;
    }

    const constantsProjectId = Constants?.easConfig?.projectId;
    if (typeof constantsProjectId === 'string' && constantsProjectId.length > 0) {
      return constantsProjectId;
    }

    return undefined;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
