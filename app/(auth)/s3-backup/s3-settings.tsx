import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Button,
  TextInput,
  HelperText,
  Chip,
} from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedListItem,
  AnimatedSection,
  SettingsGroup,
} from "@/components/common";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import { s3BackupService } from "@/services/backup/S3BackupService";
import { s3BackupScheduler } from "@/services/backup/S3BackupScheduler";
import { secureStorage } from "@/services/storage/SecureStorage";
import { useSettingsStore } from "@/store/settingsStore";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import { borderRadius } from "@/constants/sizes";

// AWS Regions list
const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-west-3", label: "Europe (Paris)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
];

const S3SettingsScreen = () => {
  const theme = useTheme<AppTheme>();

  // Settings store
  const {
    s3BucketName,
    s3Region,
    s3CustomEndpoint,
    s3ForcePathStyle,
    s3AutoBackupEnabled,
    s3AutoBackupFrequency,
    s3LastAutoBackupTimestamp,
    setS3BucketName,
    setS3Region,
    setS3CustomEndpoint,
    setS3ForcePathStyle,
    setS3AutoBackupEnabled,
    setS3AutoBackupFrequency,
  } = useSettingsStore();

  // Local form state
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucketName, setBucketName] = useState(s3BucketName || "");
  const [selectedRegion, setSelectedRegion] = useState(s3Region || "us-east-1");
  const [customEndpoint, setCustomEndpoint] = useState(s3CustomEndpoint || "");
  const [forcePathStyle, setForcePathStyle] = useState(
    s3ForcePathStyle || false,
  );

  // UI state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  // Form validation
  const [errors, setErrors] = useState({
    accessKeyId: "",
    secretAccessKey: "",
    bucketName: "",
  });

  const [isEnablingAutoBackup, setIsEnablingAutoBackup] = useState(false);

  const isBusy =
    isTestingConnection || isSaving || isClearing || isEnablingAutoBackup;
  const animationsEnabled = shouldAnimateLayout(isBusy, false);

  // Load existing credentials on mount
  const loadCredentials = useCallback(async () => {
    try {
      const credentials = await secureStorage.getS3Credentials();
      if (credentials) {
        setHasCredentials(true);
        // Don't populate the form with existing credentials for security
        // Just indicate that credentials exist
      }
    } catch (error) {
      await logger.error("Failed to check S3 credentials", {
        location: "S3SettingsScreen.loadCredentials",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  // Load credentials on mount
  useState(() => {
    void loadCredentials();
  });

  const validateForm = useCallback((): boolean => {
    const newErrors = {
      accessKeyId: "",
      secretAccessKey: "",
      bucketName: "",
    };

    if (!accessKeyId.trim() && !hasCredentials) {
      newErrors.accessKeyId = "Access Key ID is required";
    }

    if (!secretAccessKey.trim() && !hasCredentials) {
      newErrors.secretAccessKey = "Secret Access Key is required";
    }

    if (!bucketName.trim()) {
      newErrors.bucketName = "Bucket name is required";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== "");
  }, [accessKeyId, secretAccessKey, bucketName, hasCredentials]);

  const handleTestConnection = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsTestingConnection(true);
    try {
      // Use existing credentials if available, otherwise use form values
      let testAccessKeyId = accessKeyId;
      let testSecretAccessKey = secretAccessKey;

      if (hasCredentials && !accessKeyId && !secretAccessKey) {
        const credentials = await secureStorage.getS3Credentials();
        if (credentials) {
          testAccessKeyId = credentials.accessKeyId;
          testSecretAccessKey = credentials.secretAccessKey;
        }
      }

      const result = await s3BackupService.testConnection(
        testAccessKeyId,
        testSecretAccessKey,
        bucketName,
        selectedRegion,
        customEndpoint || undefined,
        forcePathStyle,
      );

      if (result.success) {
        await alert(
          "Connection Successful",
          `Successfully connected to S3 bucket "${bucketName}" in ${selectedRegion}. The bucket is accessible and ready for backups.`,
        );
      } else {
        await alert(
          "Connection Failed",
          result.error ||
            "Unable to connect to S3. Please verify your credentials and bucket configuration.",
        );
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to test connection";
      await alert("Connection Test Failed", errorMsg);
      await logger.error("S3 connection test failed", {
        location: "S3SettingsScreen.handleTestConnection",
        error: errorMsg,
      });
    } finally {
      setIsTestingConnection(false);
    }
  }, [
    accessKeyId,
    secretAccessKey,
    bucketName,
    selectedRegion,
    customEndpoint,
    forcePathStyle,
    hasCredentials,
    validateForm,
  ]);

  const handleSaveCredentials = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      // Only save credentials if they were provided
      if (accessKeyId && secretAccessKey) {
        await secureStorage.saveS3Credentials({
          accessKeyId,
          secretAccessKey,
        });
      }

      // Save bucket name, region, and custom endpoint to settings store
      setS3BucketName(bucketName);
      setS3Region(selectedRegion);
      setS3CustomEndpoint(customEndpoint || undefined);
      setS3ForcePathStyle(forcePathStyle);

      await alert(
        "Settings Saved",
        "Your S3 configuration has been saved successfully.",
      );

      // Clear form fields for security
      setAccessKeyId("");
      setSecretAccessKey("");
      setHasCredentials(true);

      await logger.info("S3 settings saved", {
        location: "S3SettingsScreen.handleSaveCredentials",
        bucketName,
        region: selectedRegion,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to save credentials";
      await alert("Save Failed", errorMsg);
      await logger.error("Failed to save S3 settings", {
        location: "S3SettingsScreen.handleSaveCredentials",
        error: errorMsg,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    accessKeyId,
    secretAccessKey,
    bucketName,
    selectedRegion,
    customEndpoint,
    forcePathStyle,
    setS3BucketName,
    setS3Region,
    setS3CustomEndpoint,
    setS3ForcePathStyle,
    validateForm,
  ]);

  const handleClearCredentials = useCallback(async () => {
    await alert(
      "Clear S3 Credentials?",
      "This will remove your credentials and S3 configuration. You will need to re-enter them to use S3 backups.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              await secureStorage.deleteS3Credentials();
              setS3BucketName(undefined);
              setS3Region(undefined);
              setS3CustomEndpoint(undefined);
              setS3ForcePathStyle(false);

              // Disable auto-backup if enabled
              if (s3AutoBackupEnabled) {
                await s3BackupScheduler.unregisterBackgroundTask();
                setS3AutoBackupEnabled(false);
              }

              // Clear form
              setAccessKeyId("");
              setSecretAccessKey("");
              setBucketName("");
              setSelectedRegion("us-east-1");
              setCustomEndpoint("");
              setForcePathStyle(false);
              setHasCredentials(false);

              await alert(
                "Credentials Cleared",
                "Your S3 credentials have been removed.",
              );

              await logger.info("S3 credentials cleared", {
                location: "S3SettingsScreen.handleClearCredentials",
              });
            } catch (error) {
              const errorMsg =
                error instanceof Error
                  ? error.message
                  : "Failed to clear credentials";
              await alert("Clear Failed", errorMsg);
              await logger.error("Failed to clear S3 credentials", {
                location: "S3SettingsScreen.handleClearCredentials",
                error: errorMsg,
              });
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  }, [
    setS3BucketName,
    setS3Region,
    setS3CustomEndpoint,
    setS3ForcePathStyle,
    s3AutoBackupEnabled,
    setS3AutoBackupEnabled,
  ]);

  const handleToggleAutoBackup = useCallback(
    async (enabled: boolean) => {
      setIsEnablingAutoBackup(true);
      try {
        if (enabled) {
          // Verify credentials exist
          if (!hasCredentials) {
            await alert(
              "Credentials Required",
              "Please save your S3 credentials before enabling automatic backups.",
            );
            return;
          }

          // Verify bucket and region are configured
          if (!bucketName || !selectedRegion) {
            await alert(
              "Configuration Required",
              "Please configure your S3 bucket name and region before enabling automatic backups.",
            );
            return;
          }

          // Register background task
          await s3BackupScheduler.registerBackgroundTask();

          setS3AutoBackupEnabled(true);

          await alert(
            "Automatic Backups Enabled",
            `Your backups will be automatically uploaded to S3 ${s3AutoBackupFrequency || "daily"}.`,
          );

          await logger.info("S3 automatic backups enabled", {
            location: "S3SettingsScreen.handleToggleAutoBackup",
            frequency: s3AutoBackupFrequency || "daily",
          });
        } else {
          // Unregister background task
          await s3BackupScheduler.unregisterBackgroundTask();

          setS3AutoBackupEnabled(false);

          await alert(
            "Automatic Backups Disabled",
            "Automatic S3 backups have been disabled.",
          );

          await logger.info("S3 automatic backups disabled", {
            location: "S3SettingsScreen.handleToggleAutoBackup",
          });
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Failed to toggle automatic backups";
        await alert("Operation Failed", errorMsg);
        await logger.error("Failed to toggle automatic backups", {
          location: "S3SettingsScreen.handleToggleAutoBackup",
          error: errorMsg,
        });
      } finally {
        setIsEnablingAutoBackup(false);
      }
    },
    [
      hasCredentials,
      bucketName,
      selectedRegion,
      s3AutoBackupFrequency,
      setS3AutoBackupEnabled,
    ],
  );

  const handleChangeFrequency = useCallback(
    async (frequency: "daily" | "weekly" | "monthly") => {
      setS3AutoBackupFrequency(frequency);

      // If auto-backup is enabled, re-register with new frequency
      if (s3AutoBackupEnabled) {
        try {
          await s3BackupScheduler.unregisterBackgroundTask();
          await s3BackupScheduler.registerBackgroundTask();

          await logger.info("S3 backup frequency updated", {
            location: "S3SettingsScreen.handleChangeFrequency",
            frequency,
          });
        } catch (error) {
          await logger.error("Failed to update backup frequency", {
            location: "S3SettingsScreen.handleChangeFrequency",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
    [s3AutoBackupEnabled, setS3AutoBackupFrequency],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    sectionDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.xxl,
      marginVertical: spacing.xs,
      padding: spacing.md,
    },
    inputContainer: {
      gap: spacing.md,
    },
    input: {
      backgroundColor: theme.colors.surface,
    },
    buttonContainer: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    regionPickerContainer: {
      marginTop: spacing.sm,
    },
    regionChipsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    regionChip: {
      borderRadius: borderRadius.lg,
    },
    credentialStatus: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    credentialStatusText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      textAlign: "center",
    },
  });

  const getRegionLabel = (regionValue: string): string => {
    return (
      AWS_REGIONS.find((r) => r.value === regionValue)?.label || regionValue
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <TabHeader title="S3 Settings" />

        {/* AWS Credentials Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Credentials</Text>
          <Text style={styles.sectionDescription}>
            Enter your Access Key ID and Secret Access Key (or equivalent for
            S3-compatible services). These credentials are stored securely and
            encrypted on your device.
          </Text>

          <View style={styles.card}>
            {hasCredentials && (
              <View style={styles.credentialStatus}>
                <Text style={styles.credentialStatusText}>
                  ✓ Credentials are configured. Leave fields empty to keep
                  existing credentials.
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <View>
                <TextInput
                  label="Access Key ID"
                  value={accessKeyId}
                  onChangeText={(text) => {
                    setAccessKeyId(text);
                    setErrors({ ...errors, accessKeyId: "" });
                  }}
                  placeholder={
                    hasCredentials ? "••••••••••••••••" : "AKIAIOSFODNN7EXAMPLE"
                  }
                  autoCapitalize="characters"
                  autoCorrect={false}
                  disabled={isBusy}
                  style={styles.input}
                  error={!!errors.accessKeyId}
                />
                {errors.accessKeyId ? (
                  <HelperText type="error" visible={!!errors.accessKeyId}>
                    {errors.accessKeyId}
                  </HelperText>
                ) : null}
              </View>

              <View>
                <TextInput
                  label="Secret Access Key"
                  value={secretAccessKey}
                  onChangeText={(text) => {
                    setSecretAccessKey(text);
                    setErrors({ ...errors, secretAccessKey: "" });
                  }}
                  placeholder={
                    hasCredentials
                      ? "••••••••••••••••••••••••••••••••"
                      : "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  }
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  disabled={isBusy}
                  style={styles.input}
                  error={!!errors.secretAccessKey}
                />
                {errors.secretAccessKey ? (
                  <HelperText type="error" visible={!!errors.secretAccessKey}>
                    {errors.secretAccessKey}
                  </HelperText>
                ) : null}
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* S3 Bucket Configuration Section */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Bucket Configuration</Text>
          <Text style={styles.sectionDescription}>
            Specify the bucket name and region where your backups will be
            stored. For S3-compatible services, use any region value (e.g.,
            us-east-1).
          </Text>

          <View style={styles.card}>
            <View style={styles.inputContainer}>
              <View>
                <TextInput
                  label="S3 Bucket Name"
                  value={bucketName}
                  onChangeText={(text) => {
                    setBucketName(text);
                    setErrors({ ...errors, bucketName: "" });
                  }}
                  placeholder="my-uniarr-backups"
                  autoCapitalize="none"
                  autoCorrect={false}
                  disabled={isBusy}
                  style={styles.input}
                  error={!!errors.bucketName}
                />
                {errors.bucketName ? (
                  <HelperText type="error" visible={!!errors.bucketName}>
                    {errors.bucketName}
                  </HelperText>
                ) : null}
              </View>

              <View>
                <Text
                  style={[
                    styles.sectionDescription,
                    { paddingHorizontal: 0, marginBottom: spacing.xs },
                  ]}
                >
                  Region
                </Text>
                <Button
                  mode="outlined"
                  onPress={() => setShowRegionPicker(!showRegionPicker)}
                  disabled={isBusy}
                  icon="map-marker"
                >
                  {getRegionLabel(selectedRegion)}
                </Button>

                {showRegionPicker && (
                  <View style={styles.regionPickerContainer}>
                    <View style={styles.regionChipsContainer}>
                      {AWS_REGIONS.map((region) => (
                        <Chip
                          key={region.value}
                          mode={
                            selectedRegion === region.value
                              ? "flat"
                              : "outlined"
                          }
                          selected={selectedRegion === region.value}
                          onPress={() => {
                            setSelectedRegion(region.value);
                            setShowRegionPicker(false);
                          }}
                          style={styles.regionChip}
                        >
                          {region.label}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* S3-Compatible Services Section */}
        <AnimatedSection
          style={styles.section}
          delay={125}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>S3-Compatible Services</Text>
          <Text style={styles.sectionDescription}>
            Configure custom endpoint for S3-compatible services like MinIO,
            Wasabi, DigitalOcean Spaces, or Backblaze B2. Leave empty for AWS
            S3.
          </Text>

          <View style={styles.card}>
            <View style={styles.inputContainer}>
              <View>
                <TextInput
                  label="Custom Endpoint (Optional)"
                  value={customEndpoint}
                  onChangeText={setCustomEndpoint}
                  placeholder="https://s3.wasabisys.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  disabled={isBusy}
                  style={styles.input}
                />
                <HelperText type="info" visible>
                  Examples: MinIO (http://minio:9000), Wasabi
                  (https://s3.wasabisys.com)
                </HelperText>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.sectionDescription,
                      { paddingHorizontal: 0, marginBottom: spacing.xxs },
                    ]}
                  >
                    Force Path Style
                  </Text>
                  <Text
                    style={[
                      styles.sectionDescription,
                      {
                        paddingHorizontal: 0,
                        marginBottom: 0,
                        fontSize: theme.custom.typography.bodySmall.fontSize,
                      },
                    ]}
                  >
                    Required for MinIO and some S3-compatible services
                  </Text>
                </View>
                <Button
                  mode={forcePathStyle ? "contained" : "outlined"}
                  onPress={() => setForcePathStyle(!forcePathStyle)}
                  disabled={isBusy}
                  compact
                >
                  {forcePathStyle ? "Enabled" : "Disabled"}
                </Button>
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* Automatic Backup Section */}
        {hasCredentials && (
          <AnimatedSection
            style={styles.section}
            delay={150}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Automatic Backups</Text>
            <Text style={styles.sectionDescription}>
              Schedule automatic backups to S3 without manual intervention.
            </Text>

            <View style={styles.card}>
              <View style={styles.inputContainer}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.sectionDescription,
                        { paddingHorizontal: 0, marginBottom: spacing.xxs },
                      ]}
                    >
                      Enable Automatic Backups
                    </Text>
                    <Text
                      style={[
                        styles.sectionDescription,
                        {
                          paddingHorizontal: 0,
                          marginBottom: 0,
                          fontSize: theme.custom.typography.bodySmall.fontSize,
                        },
                      ]}
                    >
                      Automatically backup your data to S3 on a schedule
                    </Text>
                  </View>
                  <Button
                    mode={s3AutoBackupEnabled ? "contained" : "outlined"}
                    onPress={() => handleToggleAutoBackup(!s3AutoBackupEnabled)}
                    disabled={isBusy}
                    loading={isEnablingAutoBackup}
                    compact
                  >
                    {s3AutoBackupEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </View>

                {s3AutoBackupEnabled && (
                  <>
                    <View style={{ marginTop: spacing.md }}>
                      <Text
                        style={[
                          styles.sectionDescription,
                          { paddingHorizontal: 0, marginBottom: spacing.xs },
                        ]}
                      >
                        Backup Frequency
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: spacing.xs,
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip
                          mode={
                            s3AutoBackupFrequency === "daily"
                              ? "flat"
                              : "outlined"
                          }
                          selected={s3AutoBackupFrequency === "daily"}
                          onPress={() => handleChangeFrequency("daily")}
                          disabled={isBusy}
                          style={styles.regionChip}
                        >
                          Daily
                        </Chip>
                        <Chip
                          mode={
                            s3AutoBackupFrequency === "weekly"
                              ? "flat"
                              : "outlined"
                          }
                          selected={s3AutoBackupFrequency === "weekly"}
                          onPress={() => handleChangeFrequency("weekly")}
                          disabled={isBusy}
                          style={styles.regionChip}
                        >
                          Weekly
                        </Chip>
                        <Chip
                          mode={
                            s3AutoBackupFrequency === "monthly"
                              ? "flat"
                              : "outlined"
                          }
                          selected={s3AutoBackupFrequency === "monthly"}
                          onPress={() => handleChangeFrequency("monthly")}
                          disabled={isBusy}
                          style={styles.regionChip}
                        >
                          Monthly
                        </Chip>
                      </View>
                    </View>

                    {s3LastAutoBackupTimestamp && (
                      <View
                        style={{
                          marginTop: spacing.md,
                          backgroundColor: theme.colors.surfaceVariant,
                          borderRadius: borderRadius.md,
                          padding: spacing.sm,
                        }}
                      >
                        <Text
                          style={{
                            color: theme.colors.onSurfaceVariant,
                            fontSize:
                              theme.custom.typography.bodySmall.fontSize,
                            fontFamily:
                              theme.custom.typography.bodySmall.fontFamily,
                          }}
                        >
                          Last automatic backup:{" "}
                          {new Date(s3LastAutoBackupTimestamp).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
          </AnimatedSection>
        )}

        {/* Actions Section */}
        <AnimatedSection
          style={styles.section}
          delay={175}
          animated={animationsEnabled}
        >
          <View style={styles.card}>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained-tonal"
                icon="connection"
                loading={isTestingConnection}
                disabled={isBusy}
                onPress={handleTestConnection}
              >
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </Button>

              <Button
                mode="contained"
                icon="content-save"
                loading={isSaving}
                disabled={isBusy}
                onPress={handleSaveCredentials}
              >
                {isSaving ? "Saving..." : "Save Credentials"}
              </Button>

              {hasCredentials && (
                <Button
                  mode="outlined"
                  icon="delete"
                  loading={isClearing}
                  disabled={isBusy}
                  onPress={handleClearCredentials}
                  textColor={theme.colors.error}
                >
                  {isClearing ? "Clearing..." : "Clear Credentials"}
                </Button>
              )}
            </View>
          </View>
        </AnimatedSection>

        {/* Info Section */}
        <AnimatedSection
          style={styles.section}
          delay={225}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>About S3 Backups</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <View style={styles.card}>
                <Text style={styles.sectionDescription}>
                  • Your credentials are stored securely using hardware-backed
                  encryption{"\n"}• S3 backups provide cloud storage for your
                  UniArr data{"\n"}• You maintain full control of your data in
                  your own bucket{"\n"}• Supports AWS S3 and S3-compatible
                  services (MinIO, Wasabi, DigitalOcean Spaces, Backblaze B2)
                  {"\n"}• Ensure your IAM user/credentials have permissions for
                  s3:PutObject, s3:GetObject, s3:DeleteObject, and s3:ListBucket
                  {"\n"}• Test your connection before saving to verify bucket
                  accessibility{"\n"}• You can enable automatic backups after
                  configuring your credentials
                </Text>
              </View>
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>
      </ScrollView>
    </SafeAreaView>
  );
};

export default S3SettingsScreen;
