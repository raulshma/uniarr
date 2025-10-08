import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ProgressBar, Text, useTheme, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { LoadingState } from '@/components/common/LoadingState';
import NetworkScanResults from '@/components/service/NetworkScanResults/NetworkScanResults';
import type { AppTheme } from '@/constants/theme';
import type { DiscoveredService } from '@/services/network/NetworkScannerService';
import { useNetworkScan } from '@/hooks/useNetworkScan';
import { spacing } from '@/theme/spacing';

const NetworkScanScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [customIpAddress, setCustomIpAddress] = useState('');

  const { isScanning, scanResult, error: scanError, scanProgress, scanNetwork, stopScan, reset: resetScan } = useNetworkScan();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.surface,
          paddingBottom: spacing.xxl,
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
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
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
        progressContainer: {
          gap: spacing.sm,
        },
        progressText: {
          color: theme.colors.onSurfaceVariant,
          textAlign: 'center',
        },
        actions: {
          gap: spacing.md,
        },
        stopButton: {
          backgroundColor: theme.colors.errorContainer,
        },
        stopButtonLabel: {
          color: theme.colors.onErrorContainer,
        },
        resultsContainer: {
          flex: 1,
          paddingBottom: spacing.xxl,
        },
        ipInputContainer: {
          gap: spacing.sm,
        },
        ipInput: {
          backgroundColor: theme.colors.surfaceVariant,
        },
        ipInputLabel: {
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  const handleServiceSelect = useCallback((service: DiscoveredService) => {
    // Navigate back to add-service with the selected service data as search params
    router.replace({
      pathname: '/add-service',
      params: {
        selectedService: JSON.stringify({
          type: service.type,
          name: service.name,
          url: service.url,
        }),
      },
    });
  }, [router]);

  const handleStartScan = useCallback(async (fastScan: boolean = true) => {
    resetScan();
    await scanNetwork(undefined, fastScan, customIpAddress || undefined);
  }, [scanNetwork, resetScan, customIpAddress]);

  const handleStopScan = useCallback(() => {
    stopScan();
  }, [stopScan]);

  const progressPercentage = useMemo(() => {
    if (!scanProgress || scanProgress.totalHosts === 0) return 0;
    return scanProgress.currentHost / scanProgress.totalHosts;
  }, [scanProgress]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Button
          mode="text"
          onPress={() => router.back()}
          icon="arrow-left"
          accessibilityLabel="Back to add service"
        >
          Back
        </Button>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Network Scan
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.hero}>
          <Text variant="titleMedium" style={styles.heroTitle}>
            Scan for Services
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Automatically discover Sonarr, Radarr, Jellyseerr, qBittorrent, and Prowlarr services on your local network. Quick scan checks common IPs first, while comprehensive scan covers all IPs (1-254) in your subnet.
          </Text>
        </View>

        <View style={styles.ipInputContainer}>
          <Text variant="bodyMedium" style={styles.ipInputLabel}>
            Custom IP Address (Optional)
          </Text>
          <TextInput
            mode="outlined"
            label="Enter IP address (e.g., 192.168.1.100)"
            value={customIpAddress}
            onChangeText={setCustomIpAddress}
            style={styles.ipInput}
            keyboardType="numeric"
            placeholder="Leave empty to scan local network"
            disabled={isScanning}
          />
        </View>

        {isScanning && scanProgress && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={progressPercentage} />
            <Text variant="bodySmall" style={styles.progressText}>
              Scanning {scanProgress.currentService}... ({scanProgress.currentHost}/{scanProgress.totalHosts} hosts)
            </Text>
            <Text variant="bodySmall" style={styles.progressText}>
              Found {scanProgress.servicesFound.length} services so far
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {!isScanning ? (
            <>
              <Button
                mode="contained"
                onPress={() => handleStartScan(true)}
                icon="flash"
                fullWidth
              >
                Quick Scan (Fast)
              </Button>
              <Button
                mode="outlined"
                onPress={() => handleStartScan(false)}
                icon="lan"
                fullWidth
              >
                Full Scan (All IPs 1-254)
              </Button>
            </>
          ) : (
            <Button
              mode="contained"
              onPress={handleStopScan}
              style={styles.stopButton}
              labelStyle={styles.stopButtonLabel}
              icon="stop"
              fullWidth
            >
              Stop Scanning
            </Button>
          )}
        </View>

        <View style={styles.resultsContainer}>
          <NetworkScanResults
            services={scanResult?.services || (scanProgress?.servicesFound || [])}
            isScanning={isScanning}
            scanDuration={scanResult?.scanDuration}
            scannedHosts={scanResult?.scannedHosts}
            scanProgress={scanProgress}
            onServicePress={handleServiceSelect}
            onScanAgain={handleStartScan}
          />
        </View>

        {scanError && (
          <View style={{ marginTop: spacing.md }}>
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              {scanError}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default NetworkScanScreen;
