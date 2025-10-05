import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { Button } from '@/components/common/Button';
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

const allServiceTypes: ServiceType[] = ['sonarr', 'radarr', 'jellyseerr', 'qbittorrent', 'prowlarr'];

const serviceTypeLabels: Record<ServiceType, string> = {
  sonarr: 'Sonarr',
  radarr: 'Radarr',
  jellyseerr: 'Jellyseerr',
  qbittorrent: 'qBittorrent',
  prowlarr: 'Prowlarr',
};

const generateServiceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  const timestamp = Date.now().toString(36);
  return `svc_${timestamp}${random}`;
};

const normalizeSensitiveValue = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const buildServiceConfig = (values: ServiceConfigInput, id: string): ServiceConfig => {
  const now = new Date();
  const cleanedUrl = values.url.trim().replace(/\/+$/, '');

  return {
    id,
    name: values.name.trim(),
    type: values.type,
    url: cleanedUrl,
    apiKey: normalizeSensitiveValue(values.apiKey),
    username: normalizeSensitiveValue(values.username),
    password: normalizeSensitiveValue(values.password),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
};

const AddServiceScreen = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme<AppTheme>();

  const supportedTypes = useMemo(() => ConnectorFactory.getSupportedTypes(), []);
  const supportedTypeSet = useMemo(() => new Set(supportedTypes), [supportedTypes]);

  const defaultType = supportedTypes[0] ?? 'sonarr';

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ServiceConfigInput>({
    resolver: zodResolver(serviceConfigSchema),
    defaultValues: {
      name: '',
      type: defaultType,
      url: '',
      apiKey: '',
    },
    mode: 'onChange',
  });

  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [serviceTypeModalVisible, setServiceTypeModalVisible] = useState(false);


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
      resetDiagnostics();

      if (!supportedTypeSet.has(values.type)) {
        setTestError('Selected service type is not available yet.');
        return;
      }

      setIsTesting(true);

      try {
        const config = buildServiceConfig(values, generateServiceId());
        const result = await runConnectionTest(config);

        if (result.success) {
          setTestResult(result);
        } else {
          setTestError(result.message ?? 'Unable to connect to the selected service.');
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to test the connection. Check the configuration and try again.';
        setTestError(message);

        void logger.warn('Service connection test failed.', {
          location: 'AddServiceScreen.handleTestConnection',
          serviceType: values.type,
          message,
        });
      } finally {
        setIsTesting(false);
      }
    },
    [resetDiagnostics, runConnectionTest, supportedTypeSet],
  );

  const handleSave = useCallback(
    async (values: ServiceConfigInput) => {
      resetDiagnostics();

      if (!supportedTypeSet.has(values.type)) {
        setFormError('This service type is not supported yet.');
        return;
      }

      const config = buildServiceConfig(values, generateServiceId());

      try {
        const existingServices = await secureStorage.getServiceConfigs();

        if (existingServices.some((service) => service.name.trim().toLowerCase() === config.name.toLowerCase())) {
          setFormError('A service with this name already exists. Choose a different name.');
          return;
        }

        if (
          existingServices.some(
            (service) => service.type === config.type && service.url.toLowerCase() === config.url.toLowerCase(),
          )
        ) {
          setFormError('This service is already configured.');
          return;
        }

        const testOutcome = await runConnectionTest(config);

        if (!testOutcome.success) {
          setFormError(testOutcome.message ?? 'Unable to verify the connection.');
          return;
        }

        const manager = ConnectorManager.getInstance();
        await manager.addConnector(config);

        await queryClient.invalidateQueries({ queryKey: queryKeys.services.overview });

        Alert.alert('Service added', `${serviceTypeLabels[config.type]} has been connected successfully.`, [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);

        reset({
          name: '',
          type: config.type,
          url: '',
          apiKey: '',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Something went wrong while saving the service configuration.';
        setFormError(message);

        void logger.error('Failed to add service configuration.', {
          location: 'AddServiceScreen.handleSave',
          serviceType: config.type,
          message,
        });
      }
    },
    [queryClient, reset, resetDiagnostics, router, runConnectionTest, supportedTypeSet],
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <IconButton
          icon="close"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => router.back()}
          accessibilityLabel="Close"
        />
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Add Service
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
            Connect your automation services
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Enter the connection details exactly as configured in your media server.
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
                    onChange(text);
                  }}
                  onBlur={onBlur}
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
            ) : null}
          </View>

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
              Save Service
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddServiceScreen;
