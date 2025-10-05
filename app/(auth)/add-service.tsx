import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  HelperText,
  Text,
  TextInput,
  useTheme,
  Menu,
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
  const [serviceTypeMenuVisible, setServiceTypeMenuVisible] = useState(false);


  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        headerBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: theme.colors.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        content: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        header: {
          marginBottom: spacing.xl,
        },
        headerTitle: {
          color: theme.colors.onBackground,
          fontWeight: '600',
        },
        headerSubtitle: {
          marginTop: spacing.xs,
          color: theme.colors.onSurfaceVariant,
        },
        formField: {
          marginBottom: spacing.lg,
        },
        dropdown: {
          marginTop: spacing.xs,
        },
        dropdownInput: {
          justifyContent: 'center',
        },
        sectionLabel: {
          marginBottom: spacing.xs,
          color: theme.colors.onSurfaceVariant,
        },
        diagnostics: {
          marginTop: spacing.sm,
        },
        actions: {
          marginTop: spacing.xl,
          gap: spacing.md,
        },
        testButton: {
          marginBottom: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
        },
        saveButton: {
          marginTop: spacing.xs,
          backgroundColor: '#C49B2D', // Golden yellow color matching the design
        },
      }),
    [theme],
  );

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
          iconColor={theme.colors.onBackground}
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
        <View style={styles.header}>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            Connect Sonarr and other automation tools to UniArr. Provide the base URL and credentials to get started.
          </Text>
        </View>

        <View style={styles.formField}>
          <Text variant="labelLarge" style={styles.sectionLabel}>
            Service Type
          </Text>
          <View style={styles.dropdown}>
            <Controller
              name="type"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Menu
                  visible={serviceTypeMenuVisible}
                  onDismiss={() => setServiceTypeMenuVisible(false)}
                  anchor={
                    <TextInput
                      label=""
                      value={serviceTypeLabels[value]}
                      mode="outlined"
                      style={styles.dropdownInput}
                      right={
                        <TextInput.Icon
                          icon="chevron-down"
                          onPress={() => setServiceTypeMenuVisible(true)}
                        />
                      }
                      editable={false}
                      pointerEvents="none"
                    />
                  }
                >
                  {serviceOptions.map((option) => (
                    <View key={option.type}>
                      <Menu.Item
                        title={
                          option.supported
                            ? option.label
                            : `${option.label} (coming soon)`
                        }
                        disabled={!option.supported}
                        onPress={() => {
                          if (option.supported) {
                            resetDiagnostics();
                            onChange(option.type);
                            setServiceTypeMenuVisible(false);
                          }
                        }}
                      />
                      {!option.isLast && <Divider />}
                    </View>
                  ))}
                </Menu>
              )}
            />
          </View>
          {errors.type ? (
            <HelperText type="error" visible>
              {errors.type.message}
            </HelperText>
          ) : null}
        </View>

        <Controller
          name="name"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="Name"
              value={value}
              onChangeText={(text) => {
                resetDiagnostics();
                onChange(text);
              }}
              onBlur={onBlur}
              mode="outlined"
              autoCapitalize="words"
              style={styles.formField}
              accessibilityLabel="Service name"
              placeholder="My Media Server"
            />
          )}
        />
        {errors.name ? (
          <HelperText type="error" visible>
            {errors.name.message}
          </HelperText>
        ) : null}

        <Controller
          name="url"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="URL"
              value={value}
              onChangeText={(text) => {
                resetDiagnostics();
                onChange(text);
              }}
              onBlur={onBlur}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="url"
              style={styles.formField}
              accessibilityLabel="Service URL"
              placeholder="http://192.168.1.100:8989"
            />
          )}
        />
        {errors.url ? (
          <HelperText type="error" visible>
            {errors.url.message}
          </HelperText>
        ) : null}

        <Controller
          name="apiKey"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="API Key"
              value={value}
              onChangeText={(text) => {
                resetDiagnostics();
                onChange(text);
              }}
              onBlur={onBlur}
              mode="outlined"
              autoCapitalize="none"
              secureTextEntry
              style={styles.formField}
              accessibilityLabel="Service API key"
              placeholder="Enter your API key"
            />
          )}
        />


        {errors.apiKey ? (
          <HelperText type="error" visible>
            {errors.apiKey.message}
          </HelperText>
        ) : null}

        {formError ? (
          <HelperText type="error" visible style={styles.diagnostics}>
            {formError}
          </HelperText>
        ) : null}

        {testError ? (
          <HelperText type="error" visible style={styles.diagnostics}>
            {testError}
          </HelperText>
        ) : null}

        {testResult && !testError ? (
          <HelperText type="info" visible style={styles.diagnostics}>
            Connection successful
            {testResult.version ? ` · Version ${testResult.version}` : ''}
            {typeof testResult.latency === 'number' ? ` · ${testResult.latency} ms` : ''}
          </HelperText>
        ) : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSubmit(handleTestConnection)}
            loading={isTesting}
            disabled={isSubmitting || isTesting}
            style={styles.testButton}
            labelStyle={{ color: theme.colors.onSurfaceVariant }}
          >
            Test Connection
          </Button>

          <Button
            mode="contained"
            onPress={handleSubmit(handleSave)}
            loading={isSubmitting}
            disabled={isSubmitting || isTesting}
            style={styles.saveButton}
            labelStyle={{ color: theme.colors.onPrimary }}
          >
            Save Service
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddServiceScreen;
