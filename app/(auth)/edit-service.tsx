import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import {
  HelperText,
  Text,
  TextInput,
  useTheme,
  Portal,
  Modal,
  Divider,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import axios from 'axios';

import { Button } from '@/components/common/Button';
import { DebugPanel, type DebugStep } from '@/components/common/DebugPanel';
import type { ConnectionResult } from '@/connectors/base/IConnector';
import { ConnectorFactory } from '@/connectors/factory/ConnectorFactory';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { AppTheme } from '@/constants/theme';
import type { ServiceConfig, ServiceType } from '@/models/service.types';
import { queryKeys } from '@/hooks/queryKeys';
import { logger } from '@/services/logger/LoggerService';
import { secureStorage } from '@/services/storage/SecureStorage';
import { spacing } from '@/theme/spacing';
import {
  serviceConfigSchema,
  type ServiceConfigInput,
} from '@/utils/validation.utils';
import { testApiKeyFormat } from '@/utils/api-key-validator';
import { debugLogger } from '@/utils/debug-logger';

const allServiceTypes: ServiceType[] = ['sonarr', 'radarr', 'jellyseerr', 'qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget', 'rtorrent', 'prowlarr', 'bazarr'];

const serviceTypeLabels: Record<ServiceType, string> = {
  sonarr: 'Sonarr',
  radarr: 'Radarr',
  jellyseerr: 'Jellyseerr',
  qbittorrent: 'qBittorrent',
  transmission: 'Transmission',
  deluge: 'Deluge',
  sabnzbd: 'SABnzbd',
  nzbget: 'NZBGet',
  rtorrent: 'rTorrent',
  prowlarr: 'Prowlarr',
  bazarr: 'Bazarr',
};

const normalizeSensitiveValue = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const buildServiceConfig = (values: ServiceConfigInput, existingConfig: ServiceConfig): ServiceConfig => {
  const now = new Date();
  const cleanedUrl = values.url.trim().replace(/\/+$/, '');

  return {
    ...existingConfig,
    name: values.name.trim(),
    url: cleanedUrl,
    apiKey: normalizeSensitiveValue(values.apiKey),
    username: normalizeSensitiveValue(values.username),
    password: normalizeSensitiveValue(values.password),
    updatedAt: now,
  };
};

const EditServiceScreen = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme<AppTheme>();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();

  const [existingConfig, setExistingConfig] = useState<ServiceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supportedTypes = useMemo(() => ConnectorFactory.getSupportedTypes(), []);
  const supportedTypeSet = useMemo(() => new Set(supportedTypes), [supportedTypes]);

  useEffect(() => {
    const loadServiceConfig = async () => {
      if (!serviceId) {
        Alert.alert('Error', 'Service ID is required', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      try {
        const configs = await secureStorage.getServiceConfigs();
        const config = configs.find((c) => c.id === serviceId);

        if (!config) {
          Alert.alert('Error', 'Service not found', [
            { text: 'OK', onPress: () => router.back() },
          ]);
          return;
        }

        setExistingConfig(config);
      } catch (error) {
        Alert.alert('Error', 'Failed to load service configuration', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadServiceConfig();
  }, [serviceId, router]);

  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ServiceConfigInput>({
    resolver: zodResolver(serviceConfigSchema),
    defaultValues: {
      name: '',
      type: 'sonarr',
      url: '',
      apiKey: '',
      username: '',
      password: '',
    },
    mode: 'onChange',
  });

  // Update form values when existingConfig is loaded
  useEffect(() => {
    if (existingConfig) {
      reset({
        name: existingConfig.name,
        type: existingConfig.type,
        url: existingConfig.url,
        apiKey: existingConfig.apiKey || '',
        username: existingConfig.username || '',
        password: existingConfig.password || '',
      });
    }
  }, [existingConfig, reset]);

  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [urlValidation, setUrlValidation] = useState<{
    status: 'idle' | 'validating' | 'success' | 'error';
    message?: string | null;
  }>({ status: 'idle', message: null });
  const urlValidationController = useRef<AbortController | null>(null);
  const [serviceTypeModalVisible, setServiceTypeModalVisible] = useState(false);
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Subscribe to debug logger
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((steps) => {
      setDebugSteps(steps);
    });
    return unsubscribe;
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.surface,
        },
        headerBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.outlineVariant,
        },
        headerTitle: {
          color: theme.colors.onSurface,
          fontWeight: '600',
        },
        content: {
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.xl,
        },
        hero: {
          gap: spacing.xs,
        },
        heroTitle: {
          color: theme.colors.onSurface,
          fontWeight: '600',
        },
        heroSubtitle: {
          color: theme.colors.onSurfaceVariant,
        },
        formCard: {
          gap: spacing.lg,
        },
        formField: {
          gap: spacing.xs,
        },
        sectionLabel: {
          color: theme.colors.onSurface,
          fontWeight: '600',
        },
        input: {
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
        },
        outline: {
          borderRadius: 16,
          borderWidth: 1,
        },
        dropdownAnchor: {
          justifyContent: 'center',
        },
        modalContent: {
          marginHorizontal: spacing.lg,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          paddingVertical: spacing.sm,
        },
        optionItem: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        optionText: {
          color: theme.colors.onSurface,
        },
        optionDisabled: {
          opacity: 0.5,
        },
        helperText: {
          marginTop: spacing.xs,
        },
        diagnosticsCard: {
          marginTop: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 12,
        },
        diagnosticsError: {
          backgroundColor: theme.colors.errorContainer,
        },
        diagnosticsSuccess: {
          backgroundColor: theme.colors.tertiaryContainer,
        },
        diagnosticsText: {
          color: theme.colors.onSurface,
        },
        actions: {
          marginTop: spacing.lg,
          gap: spacing.md,
        },
        testButton: {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.primary,
          borderWidth: 1,
        },
        testButtonLabel: {
          color: theme.colors.primary,
        },
        saveButton: {
          backgroundColor: theme.colors.primary,
        },
        saveButtonLabel: {
          color: theme.colors.onPrimary,
        },
      }),
    [theme],
  );

  const inputTheme = useMemo(
    () => ({
      colors: {
        primary: theme.colors.primary,
        onSurface: theme.colors.onSurface,
        outline: theme.colors.outlineVariant,
        placeholder: theme.colors.onSurfaceVariant,
        background: 'transparent',
      },
    }),
    [
      theme.colors.onSurface,
      theme.colors.onSurfaceVariant,
      theme.colors.outlineVariant,
      theme.colors.primary,
    ],
  );

  const placeholderColor = theme.colors.onSurfaceVariant;

  const resetDiagnostics = useCallback(() => {
    setTestResult(null);
    setTestError(null);
    setFormError(null);
    setUrlValidation({ status: 'idle', message: null });
    try {
      urlValidationController.current?.abort();
    } catch {
      // ignore
    }
    urlValidationController.current = null;
  }, []);

  const runConnectionTest = useCallback(
    async (config: ServiceConfig): Promise<ConnectionResult> => {
      const connector = ConnectorFactory.create(config);

      try {
        return await connector.testConnection();
      } finally {
        connector.dispose();
      }
    },
    [],
  );

  const handleTestConnection = useCallback(
    async (values: ServiceConfigInput) => {
      if (!existingConfig) {
        debugLogger.addError('No existing config', 'Cannot test connection without existing service configuration');
        return;
      }

      resetDiagnostics();
      debugLogger.clear();
      setShowDebugPanel(true);

      if (!supportedTypeSet.has(values.type)) {
        debugLogger.addError('Service type not supported', `Selected service type '${values.type}' is not available yet.`);
        setTestError('Selected service type is not available yet.');
        return;
      }

      setIsTesting(true);

      try {
        const config = buildServiceConfig(values, existingConfig);
        
        // Validate API key format first
        if (values.apiKey && values.type !== 'qbittorrent') {
          const apiKeyTest = testApiKeyFormat(values.apiKey, values.type as 'sonarr' | 'radarr' | 'qbittorrent' | 'jellyseerr' | 'prowlarr' | 'transmission' | 'deluge' | 'sabnzbd' | 'nzbget' | 'rtorrent' | 'bazarr');
          debugLogger.addApiKeyValidation(apiKeyTest.isValid, apiKeyTest.message, apiKeyTest.suggestions);

          if (!apiKeyTest.isValid) {
            setTestError(`${apiKeyTest.message}. ${apiKeyTest.suggestions.join(' ')}`);
            return;
          }
        }
        
        const result = await runConnectionTest(config);

        if (result.success) {
          setTestResult(result);
        } else {
          setTestError(result.message ?? 'Unable to connect to the selected service.');
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to test the connection. Check the configuration and try again.';
        debugLogger.addError('Connection test failed', message);
        setTestError(message);

        void logger.warn('Service connection test failed.', {
          location: 'EditServiceScreen.handleTestConnection',
          serviceType: values.type,
          message,
        });
      } finally {
        setIsTesting(false);
      }
    },
    [existingConfig, resetDiagnostics, runConnectionTest, supportedTypeSet],
  );

  const handleSave = useCallback(
    async (values: ServiceConfigInput) => {
      console.log('💾 [Edit] Starting save service with values:', values);
      if (!existingConfig) {
        console.log('❌ [Edit] No existing config for save');
        return;
      }

      resetDiagnostics();

      if (!supportedTypeSet.has(values.type)) {
        console.log('❌ [Edit] Service type not supported:', values.type);
        setFormError('This service type is not supported yet.');
        return;
      }

      const config = buildServiceConfig(values, existingConfig);
      console.log('📋 [Edit] Built config for save:', config);

      try {
        console.log('🔍 [Edit] Checking existing services...');
        const existingServices = await secureStorage.getServiceConfigs();
        console.log('📋 [Edit] Existing services:', existingServices.length);

        // Check for name conflicts (excluding current service)
        if (existingServices.some((service) => service.id !== config.id && service.name.trim().toLowerCase() === config.name.toLowerCase())) {
          console.log('❌ [Edit] Service name already exists');
          setFormError('A service with this name already exists. Choose a different name.');
          return;
        }

        // Check for duplicate configurations (excluding current service)
        if (
          existingServices.some(
            (service) => service.id !== config.id && service.type === config.type && service.url.toLowerCase() === config.url.toLowerCase(),
          )
        ) {
          console.log('❌ [Edit] Service already configured');
          setFormError('This service is already configured.');
          return;
        }

        console.log('🔄 [Edit] Testing connection before save...');
        const testOutcome = await runConnectionTest(config);
        console.log('✅ [Edit] Connection test result for save:', testOutcome);

        if (!testOutcome.success) {
          setFormError(testOutcome.message ?? 'Unable to verify the connection.');
          return;
        }

        console.log('💾 [Edit] Adding connector to manager...');
        const manager = ConnectorManager.getInstance();
        await manager.addConnector(config);
        console.log('✅ [Edit] Connector added to manager');

        console.log('🔄 [Edit] Invalidating queries...');
        await queryClient.invalidateQueries({ queryKey: queryKeys.services.overview });
        console.log('✅ [Edit] Queries invalidated');

        console.log('🎉 [Edit] Service updated successfully, showing alert...');
        Alert.alert('Service updated', `${serviceTypeLabels[config.type]} has been updated successfully.`, [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } catch (error) {
        console.error('❌ [Edit] Save service error:', error);
        const message =
          error instanceof Error ? error.message : 'Something went wrong while updating the service configuration.';
        setFormError(message);

        void logger.error('Failed to update service configuration.', {
          location: 'EditServiceScreen.handleSave',
          serviceType: config.type,
          message,
        });
      }
    },
    [existingConfig, queryClient, resetDiagnostics, router, runConnectionTest, supportedTypeSet],
  );

  const serviceOptions = useMemo(
    () =>
      allServiceTypes.map((type, index) => ({
        type,
        label: serviceTypeLabels[type],
        supported: supportedTypeSet.has(type),
        isLast: index === allServiceTypes.length - 1,
      })),
    [supportedTypeSet],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Edit Service
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!existingConfig) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Edit Service
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Service not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Edit Service
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.hero}>
          <Text variant="titleMedium" style={styles.heroTitle}>
            Update service configuration
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Modify the connection details for your {serviceTypeLabels[existingConfig.type]} service.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formField}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Service Type
            </Text>
            <Controller
              name="type"
              control={control}
              render={({ field: { value, onChange } }) => (
                <>
                  <Pressable
                    onPress={() => setServiceTypeModalVisible(true)}
                    style={styles.dropdownAnchor}
                    accessibilityRole="button"
                  >
                    <TextInput
                      value={serviceTypeLabels[value]}
                      mode="outlined"
                      style={styles.input}
                      outlineStyle={styles.outline}
                      theme={inputTheme}
                      placeholderTextColor={placeholderColor}
                      right={
                        <TextInput.Icon
                          icon="chevron-down"
                          onPress={() => setServiceTypeModalVisible(true)}
                        />
                      }
                      editable={false}
                    />
                  </Pressable>

                  <Portal>
                    <Modal
                      visible={serviceTypeModalVisible}
                      onDismiss={() => setServiceTypeModalVisible(false)}
                      contentContainerStyle={styles.modalContent}
                    >
                      {serviceOptions.map((option) => (
                        <View key={option.type}>
                          <Pressable
                            onPress={() => {
                              if (option.supported) {
                                resetDiagnostics();
                                onChange(option.type);
                                setServiceTypeModalVisible(false);
                              }
                            }}
                            style={({ pressed }) => [
                              styles.optionItem,
                              option.supported ? null : styles.optionDisabled,
                              pressed ? { opacity: 0.7 } : null,
                            ]}
                            accessibilityRole={option.supported ? 'button' : 'text'}
                          >
                            <Text style={styles.optionText}>
                              {option.supported ? option.label : `${option.label} (coming soon)`}
                            </Text>
                          </Pressable>
                          {!option.isLast && <Divider />}
                        </View>
                      ))}
                    </Modal>
                  </Portal>
                </>
              )}
            />
            {errors.type ? (
              <HelperText type="error" visible style={styles.helperText}>
                {errors.type.message}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.formField}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Service Name
            </Text>
            <Controller
              name="name"
              control={control}
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  value={value}
                  onChangeText={(text) => {
                    resetDiagnostics();
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  mode="outlined"
                  autoCapitalize="words"
                  style={styles.input}
                  outlineStyle={styles.outline}
                  theme={inputTheme}
                  accessibilityLabel="Service name"
                  placeholder="My Media Server"
                  placeholderTextColor={placeholderColor}
                />
              )}
            />
            {errors.name ? (
              <HelperText type="error" visible style={styles.helperText}>
                {errors.name.message}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.formField}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Service URL
            </Text>
            <Controller
              name="url"
              control={control}
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  value={value}
                  onChangeText={(text) => {
                    resetDiagnostics();
                    // Clear any previous URL validation state while user edits
                    setUrlValidation({ status: 'idle', message: null });
                    onChange(text);
                  }}
                  onBlur={async () => {
                    onBlur();

                    // If there is already a synchronous validation error from zod, skip async validation
                    if (errors.url) return;

                    const trimmed = value?.trim();
                    if (!trimmed) return;

                    // Abort any in-flight validation
                    try {
                      urlValidationController.current?.abort();
                    } catch {
                      // ignore
                    }

                    const controller = new AbortController();
                    urlValidationController.current = controller;

                    setUrlValidation({ status: 'validating', message: 'Validating URL...' });

                    try {
                      const response = await axios.get(trimmed, {
                        timeout: 5000,
                        signal: controller.signal,
                        // Accept any HTTP status — we only care that the host responded
                        validateStatus: () => true,
                      });

                      // If the request was aborted, do nothing
                      if (controller.signal.aborted) return;

                      if (response && typeof response.status === 'number') {
                        setUrlValidation({ status: 'success', message: 'URL is reachable.' });
                        clearErrors('url');
                      } else {
                        const msg = 'No response from the host.';
                        setUrlValidation({ status: 'error', message: msg });
                        setError('url', { type: 'validate', message: msg });
                      }
                    } catch (error) {
                      // If canceled, ignore
                      if ((error as any)?.name === 'CanceledError') return;

                      const message = error instanceof Error ? error.message : 'Unable to reach the specified URL.';
                      setUrlValidation({ status: 'error', message });
                      setError('url', { type: 'validate', message });
                    } finally {
                      urlValidationController.current = null;
                    }
                  }}
                  mode="outlined"
                  autoCapitalize="none"
                  keyboardType="url"
                  style={styles.input}
                  outlineStyle={styles.outline}
                  theme={inputTheme}
                  accessibilityLabel="Service URL"
                  placeholder="http://192.168.1.100:8989"
                  placeholderTextColor={placeholderColor}
                />
              )}
            />
            {errors.url ? (
              <HelperText type="error" visible style={styles.helperText}>
                {errors.url.message}
              </HelperText>
            ) : urlValidation.status === 'validating' ? (
              <HelperText type="info" visible style={styles.helperText}>
                {urlValidation.message}
              </HelperText>
            ) : urlValidation.status === 'success' ? (
              <HelperText type="info" visible style={styles.helperText}>
                {urlValidation.message}
              </HelperText>
            ) : urlValidation.status === 'error' ? (
              <HelperText type="error" visible style={styles.helperText}>
                {urlValidation.message}
              </HelperText>
            ) : null}
          </View>

          <Controller
            name="type"
            control={control}
            render={({ field: { value: serviceType } }) => {
              if (serviceType === 'qbittorrent') {
                return (
                  <>
                    <View style={styles.formField}>
                      <Text variant="labelLarge" style={styles.sectionLabel}>
                        Username
                      </Text>
                      <Controller
                        name="username"
                        control={control}
                        render={({ field: { value, onChange, onBlur } }) => (
                          <TextInput
                            value={value}
                            onChangeText={(text) => {
                              resetDiagnostics();
                              onChange(text);
                            }}
                            onBlur={onBlur}
                            mode="outlined"
                            autoCapitalize="none"
                            style={styles.input}
                            outlineStyle={styles.outline}
                            theme={inputTheme}
                            accessibilityLabel="Username"
                            placeholder="Enter your username"
                            placeholderTextColor={placeholderColor}
                          />
                        )}
                      />
                      {errors.username ? (
                        <HelperText type="error" visible style={styles.helperText}>
                          {errors.username.message}
                        </HelperText>
                      ) : null}
                    </View>

                    <View style={styles.formField}>
                      <Text variant="labelLarge" style={styles.sectionLabel}>
                        Password
                      </Text>
                      <Controller
                        name="password"
                        control={control}
                        render={({ field: { value, onChange, onBlur } }) => (
                          <TextInput
                            value={value}
                            onChangeText={(text) => {
                              resetDiagnostics();
                              onChange(text);
                            }}
                            onBlur={onBlur}
                            mode="outlined"
                            autoCapitalize="none"
                            secureTextEntry
                            style={styles.input}
                            outlineStyle={styles.outline}
                            theme={inputTheme}
                            accessibilityLabel="Password"
                            placeholder="Enter your password"
                            placeholderTextColor={placeholderColor}
                          />
                        )}
                      />
                      {errors.password ? (
                        <HelperText type="error" visible style={styles.helperText}>
                          {errors.password.message}
                        </HelperText>
                      ) : null}
                    </View>
                  </>
                );
              }

              return (
                <View style={styles.formField}>
                  <Text variant="labelLarge" style={styles.sectionLabel}>
                    API Key
                  </Text>
                  <Controller
                    name="apiKey"
                    control={control}
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextInput
                        value={value}
                        onChangeText={(text) => {
                          resetDiagnostics();
                          onChange(text);
                        }}
                        onBlur={onBlur}
                        mode="outlined"
                        autoCapitalize="none"
                        secureTextEntry
                        style={styles.input}
                        outlineStyle={styles.outline}
                        theme={inputTheme}
                        accessibilityLabel="Service API key"
                        placeholder="Enter your API key"
                        placeholderTextColor={placeholderColor}
                      />
                    )}
                  />
                  {errors.apiKey ? (
                    <HelperText type="error" visible style={styles.helperText}>
                      {errors.apiKey.message}
                    </HelperText>
                  ) : null}
                </View>
              );
            }}
          />

          {formError ? (
            <View style={[styles.diagnosticsCard, styles.diagnosticsError]}>
              <Text variant="bodySmall" style={styles.diagnosticsText}>
                {formError}
              </Text>
            </View>
          ) : null}

          {testError ? (
            <View style={[styles.diagnosticsCard, styles.diagnosticsError]}>
              <Text variant="bodySmall" style={styles.diagnosticsText}>
                {testError}
              </Text>
            </View>
          ) : null}

          {testResult && !testError ? (
            <View style={[styles.diagnosticsCard, styles.diagnosticsSuccess]}>
              <Text variant="bodySmall" style={styles.diagnosticsText}>
                Connection successful
                {testResult.version ? ` · Version ${testResult.version}` : ''}
                {typeof testResult.latency === 'number' ? ` · ${testResult.latency} ms` : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleSubmit(handleTestConnection)}
              loading={isTesting}
              disabled={isSubmitting || isTesting}
              buttonColor={theme.colors.surface}
              style={styles.testButton}
              labelStyle={styles.testButtonLabel}
              fullWidth
            >
              Test Connection
            </Button>

            <Button
              mode="contained"
              onPress={handleSubmit(handleSave)}
              loading={isSubmitting}
              disabled={isSubmitting || isTesting}
              buttonColor={theme.colors.primary}
              style={styles.saveButton}
              labelStyle={styles.saveButtonLabel}
              fullWidth
            >
              Update Service
            </Button>
          </View>
        </View>
      </ScrollView>
      
      <DebugPanel
        steps={debugSteps}
        isVisible={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
        onClear={() => {
          debugLogger.clear();
          setDebugSteps([]);
        }}
      />
    </SafeAreaView>
  );
};

export default EditServiceScreen;
