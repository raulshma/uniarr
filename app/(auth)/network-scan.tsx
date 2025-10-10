import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Divider,
  ProgressBar,
  Text,
  useTheme,
  TextInput,
  SegmentedButtons,
  Surface,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/common/Button";
import LoadingState from "@/components/common/LoadingState/LoadingState";
import NetworkScanResults from "@/components/service/NetworkScanResults/NetworkScanResults";
import NetworkScanHistory from "@/components/service/NetworkScanResults/NetworkScanHistory";
import type { AppTheme } from "@/constants/theme";
import type { DiscoveredService } from "@/services/network/NetworkScannerService";
import type {
  NetworkScanHistoryType as ScanHistoryType,
  RecentIP,
} from "@/services/storage/SecureStorage";
import { useNetworkScan } from "@/hooks/useNetworkScan";
import { spacing } from "@/theme/spacing";
import { NetworkScannerService } from "@/services/network/NetworkScannerService";

const NetworkScanScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [customIpAddress, setCustomIpAddress] = useState("");
  const [activeTab, setActiveTab] = useState<"scan" | "history">("scan");
  const [scanHistory, setScanHistory] = useState<ScanHistoryType[]>([]);
  const [recentIPs, setRecentIPs] = useState<RecentIP[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const {
    isScanning,
    scanResult,
    error: scanError,
    scanProgress,
    scanNetwork,
    stopScan,
    reset: resetScan,
  } = useNetworkScan();

  const scannerService = useMemo(() => new NetworkScannerService(), []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        },
        sectionSurface: {
          marginHorizontal: spacing.md,
          borderRadius: 12,
          backgroundColor: theme.colors.elevation.level1,
        },
        sectionPadding: {
          padding: spacing.md,
        },
        headerTitle: {
          color: theme.colors.onSurface,
        },
        hero: {
          gap: spacing.xs,
        },
        heroTitle: {
          color: theme.colors.onSurface,
          fontWeight: "600",
        },
        heroSubtitle: {
          color: theme.colors.onSurfaceVariant,
        },
        progressContainer: {
          gap: spacing.sm,
        },
        progressText: {
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
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
        },
        ipInputContainer: {
          gap: spacing.sm,
        },
        ipInputLabel: {
          color: theme.colors.onSurfaceVariant,
        },
        segmentedButtons: {
          backgroundColor: theme.colors.surfaceVariant,
        },
        tabsSurface: {
          marginHorizontal: spacing.md,
          borderRadius: 12,
          backgroundColor: theme.colors.elevation.level2,
        },
        historyContainer: {
          flex: 1,
        },
      }),
    [theme]
  );

  const handleServiceSelect = useCallback(
    (service: DiscoveredService) => {
      // Navigate back to add-service with the selected service data as search params
      router.replace({
        pathname: "/add-service",
        params: {
          selectedService: JSON.stringify({
            type: service.type,
            name: service.name,
            url: service.url,
          }),
        },
      });
    },
    [router]
  );

  const handleStartScan = useCallback(
    async (fastScan: boolean = true) => {
      resetScan();
      await scanNetwork(undefined, fastScan, customIpAddress || undefined);
    },
    [scanNetwork, resetScan, customIpAddress]
  );

  const handleStopScan = useCallback(() => {
    stopScan();
  }, [stopScan]);

  const progressPercentage = useMemo(() => {
    if (!scanProgress || scanProgress.totalHosts === 0) return 0;
    return scanProgress.currentHost / scanProgress.totalHosts;
  }, [scanProgress]);

  const loadScanHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const [history, ips] = await Promise.all([
        scannerService.getScanHistory(),
        scannerService.getRecentIPs(),
      ]);
      setScanHistory(history);
      setRecentIPs(ips);
    } catch (error) {
      console.warn("Failed to load scan history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [scannerService]);

  const handleClearHistory = useCallback(async () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear all scan history and recent IP addresses?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await scannerService.clearScanHistory();
              setScanHistory([]);
              setRecentIPs([]);
            } catch (error) {
              console.warn("Failed to clear scan history:", error);
            }
          },
        },
      ]
    );
  }, [scannerService]);

  const handleIPSelect = useCallback((ip: string) => {
    setCustomIpAddress(ip);
    setActiveTab("scan");
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadScanHistory();
    }
  }, [activeTab, loadScanHistory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Appbar.Header mode="small" elevated>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
        <Appbar.Content title="Network Scan" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Surface
          style={[styles.sectionSurface, styles.sectionPadding]}
          elevation={1}
        >
          <View style={styles.hero}>
            <Text variant="titleMedium" style={styles.heroTitle}>
              Scan for Services
            </Text>
            <Text variant="bodyMedium" style={styles.heroSubtitle}>
              Discover Sonarr, Radarr, Jellyseerr, qBittorrent, Transmission,
              Deluge, SABnzbd, Prowlarr, and Bazarr on your network. Quick scan
              checks common IPs first; full scan covers all hosts (1–254) in
              your subnet.
            </Text>
          </View>
        </Surface>

        <Surface
          style={[styles.sectionSurface, styles.sectionPadding]}
          elevation={1}
        >
          <View style={styles.ipInputContainer}>
            <Text variant="bodyMedium" style={styles.ipInputLabel}>
              Custom IP Address (optional)
            </Text>
            <TextInput
              mode="outlined"
              label="Enter IP address (e.g., 192.168.1.100)"
              value={customIpAddress}
              onChangeText={setCustomIpAddress}
              keyboardType="numeric"
              placeholder="Leave empty to scan local network"
              disabled={isScanning}
            />
          </View>

          {isScanning && scanProgress && (
            <View style={[styles.progressContainer, { marginTop: spacing.md }]}>
              <ProgressBar progress={progressPercentage} />
              <Text variant="bodySmall" style={styles.progressText}>
                Scanning {scanProgress.currentService}... (
                {scanProgress.currentHost}/{scanProgress.totalHosts} hosts)
              </Text>
              <Text variant="bodySmall" style={styles.progressText}>
                Found {scanProgress.servicesFound.length} services so far
              </Text>
            </View>
          )}

          <View style={[styles.actions, { marginTop: spacing.md }]}>
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
        </Surface>

        {/* Tab Navigation */}
        <Surface
          style={[styles.tabsSurface, styles.sectionPadding]}
          elevation={2}
        >
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "scan" | "history")}
            buttons={[
              { value: "scan", label: "Network Scan", icon: "lan" },
              { value: "history", label: "History", icon: "history" },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {activeTab === "scan" ? (
          <>
            <View style={styles.resultsContainer}>
              <Surface style={[styles.sectionSurface]} elevation={1}>
                <NetworkScanResults
                  services={
                    scanResult?.services || scanProgress?.servicesFound || []
                  }
                  isScanning={isScanning}
                  scanDuration={scanResult?.scanDuration}
                  scannedHosts={scanResult?.scannedHosts}
                  scanProgress={scanProgress}
                  onServicePress={handleServiceSelect}
                  onScanAgain={handleStartScan}
                />
              </Surface>
            </View>
          </>
        ) : (
          <View style={styles.historyContainer}>
            <Surface style={[styles.sectionSurface]} elevation={1}>
              {isLoadingHistory ? (
                <LoadingState message="Loading scan history..." />
              ) : (
                <NetworkScanHistory
                  scanHistory={scanHistory}
                  recentIPs={recentIPs}
                  onClearHistory={handleClearHistory}
                  onIPSelect={handleIPSelect}
                />
              )}
            </Surface>
          </View>
        )}

        {scanError && (
          <View style={{ marginTop: spacing.md, marginHorizontal: spacing.md }}>
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
