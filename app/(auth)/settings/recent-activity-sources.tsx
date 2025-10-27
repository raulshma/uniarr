import React, { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, useTheme, Switch, Button } from "react-native-paper";
import { useRouter } from "expo-router";

import { SafeAreaView } from "react-native-safe-area-context";
import { TabHeader } from "@/components/common/TabHeader";
import { Card } from "@/components/common/Card";
import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import {
  useConnectorsStore,
  selectGetAllConnectors,
} from "@/store/connectorsStore";
import {
  useSettingsStore,
  selectRecentActivitySourceServiceIds,
} from "@/store/settingsStore";

const RecentActivitySourcesScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const getAllConnectors = useConnectorsStore(selectGetAllConnectors);
  const allConnectors = useMemo(
    () => getAllConnectors?.() ?? [],
    [getAllConnectors],
  );
  const recentActivitySourceIds = useSettingsStore(
    selectRecentActivitySourceServiceIds,
  );
  const setRecentActivitySourceServiceIds = useSettingsStore(
    (s) => s.setRecentActivitySourceServiceIds,
  );

  // Count selected
  const selectedCount = useMemo(() => {
    if (recentActivitySourceIds === undefined) {
      return allConnectors.length;
    }
    return recentActivitySourceIds.length;
  }, [recentActivitySourceIds, allConnectors.length]);

  const handleToggle = useCallback(
    (connectorId: string) => {
      if (recentActivitySourceIds === undefined) {
        // All are currently selected, so deselect this one
        const newIds = allConnectors
          .filter((c) => c.config.id !== connectorId)
          .map((c) => c.config.id);
        setRecentActivitySourceServiceIds(
          newIds.length > 0 ? newIds : undefined,
        );
      } else if (recentActivitySourceIds.includes(connectorId)) {
        // Remove from selection
        const newIds = recentActivitySourceIds.filter(
          (id) => id !== connectorId,
        );
        setRecentActivitySourceServiceIds(
          newIds.length > 0 ? newIds : undefined,
        );
      } else {
        // Add to selection
        setRecentActivitySourceServiceIds([
          ...recentActivitySourceIds,
          connectorId,
        ]);
      }
    },
    [recentActivitySourceIds, allConnectors, setRecentActivitySourceServiceIds],
  );

  const handleSelectAll = useCallback(() => {
    setRecentActivitySourceServiceIds(undefined);
  }, [setRecentActivitySourceServiceIds]);

  const handleClearAll = useCallback(() => {
    if (allConnectors.length > 0) {
      setRecentActivitySourceServiceIds([]);
    }
  }, [allConnectors.length, setRecentActivitySourceServiceIds]);

  // Group by service type (must be before early return)
  const groupedConnectors = useMemo(() => {
    const groups: Record<string, typeof allConnectors> = {};
    allConnectors.forEach((connector) => {
      const type = connector.config.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(connector);
    });
    return groups;
  }, [allConnectors]);

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case "sonarr":
        return "television-classic";
      case "radarr":
        return "movie-open";
      case "qbittorrent":
        return "download";
      case "jellyfin":
        return "play-circle";
      case "jellyseerr":
        return "movie-search";
      case "prowlarr":
        return "magnify";
      case "bazarr":
        return "subtitles";
      case "adguard":
        return "shield-check";
      default:
        return "server-network";
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollContainer: {
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xxxxl,
        },
        section: {
          marginTop: spacing.md,
          marginBottom: spacing.md,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: spacing.xs,
          marginBottom: spacing.md,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
        },
        description: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.lg,
          paddingHorizontal: spacing.xs,
        },
        statsText: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
          fontFamily: theme.custom.typography.bodySmall.fontFamily,
          lineHeight: theme.custom.typography.bodySmall.lineHeight,
          letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
          fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.lg,
          paddingHorizontal: spacing.xs,
        },
        controlButtons: {
          flexDirection: "row",
          gap: spacing.md,
          marginBottom: spacing.lg,
          paddingHorizontal: spacing.xs,
        },
        button: {
          flex: 1,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: theme.custom.sizes.borderRadius.lg,
          borderWidth: 1,
          justifyContent: "center",
          alignItems: "center",
        },
        selectAllButton: {
          backgroundColor: theme.colors.primaryContainer,
          borderColor: theme.colors.primary,
        },
        clearAllButton: {
          backgroundColor: theme.colors.errorContainer,
          borderColor: theme.colors.error,
        },
        buttonText: {
          fontSize: theme.custom.typography.labelLarge.fontSize,
          fontFamily: theme.custom.typography.labelLarge.fontFamily,
          lineHeight: theme.custom.typography.labelLarge.lineHeight,
          letterSpacing: theme.custom.typography.labelLarge.letterSpacing,
          fontWeight: theme.custom.typography.labelLarge.fontWeight as any,
        },
        selectAllText: {
          color: theme.colors.primary,
        },
        clearAllText: {
          color: theme.colors.error,
        },
        connectorCard: {
          backgroundColor: theme.colors.elevation.level1,
          marginHorizontal: spacing.xs,
          marginVertical: spacing.xs / 2,
          borderRadius: theme.custom.sizes.borderRadius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        connectorContent: {
          flexDirection: "row",
          alignItems: "center",
        },
        connectorIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        },
        connectorInfo: {
          flex: 1,
        },
        connectorName: {
          fontSize: theme.custom.typography.bodyLarge.fontSize,
          fontFamily: theme.custom.typography.bodyLarge.fontFamily,
          lineHeight: theme.custom.typography.bodyLarge.lineHeight,
          letterSpacing: theme.custom.typography.bodyLarge.letterSpacing,
          fontWeight: theme.custom.typography.bodyLarge.fontWeight as any,
          color: theme.colors.onSurface,
          marginBottom: spacing.xs / 2,
        },
        connectorMeta: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
          fontFamily: theme.custom.typography.bodySmall.fontFamily,
          lineHeight: theme.custom.typography.bodySmall.lineHeight,
          letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
          fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        connectorType: {
          alignSelf: "flex-start",
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.xxs / 2,
          borderRadius: theme.custom.sizes.borderRadius.sm,
          backgroundColor: theme.colors.primaryContainer,
        },
        connectorTypeText: {
          fontSize: theme.custom.typography.labelSmall.fontSize,
          fontFamily: theme.custom.typography.labelSmall.fontFamily,
          lineHeight: theme.custom.typography.labelSmall.lineHeight,
          letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
          fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
          color: theme.colors.primary,
          textTransform: "uppercase",
        },
        connectorActions: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        },
        emptyState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.xl,
        },
        emptyIcon: {
          marginBottom: spacing.md,
        },
        emptyTitle: {
          fontSize: theme.custom.typography.headlineSmall.fontSize,
          fontFamily: theme.custom.typography.headlineSmall.fontFamily,
          lineHeight: theme.custom.typography.headlineSmall.lineHeight,
          letterSpacing: theme.custom.typography.headlineSmall.letterSpacing,
          fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
          color: theme.colors.onSurface,
          marginBottom: spacing.sm,
          textAlign: "center",
        },
        emptyText: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginBottom: spacing.lg,
        },
        emptyActionText: {
          fontSize: theme.custom.typography.labelLarge.fontSize,
          fontFamily: theme.custom.typography.labelLarge.fontFamily,
          lineHeight: theme.custom.typography.labelLarge.lineHeight,
          letterSpacing: theme.custom.typography.labelLarge.letterSpacing,
          fontWeight: theme.custom.typography.labelLarge.fontWeight as any,
          color: theme.colors.primary,
          textDecorationLine: "underline",
        },
      }),
    [theme],
  );

  if (allConnectors.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <TabHeader title="Recent Activity Sources" />
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="server-network-off"
            size={64}
            color={theme.colors.onSurfaceVariant}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No services configured</Text>
          <Text style={styles.emptyText}>
            Add some services to configure which ones should appear in your
            Recent Activity widget.
          </Text>
          <Button
            mode="outlined"
            onPress={() => router.push("/(auth)/add-service")}
            icon="plus"
          >
            Add Service
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedScrollView contentContainerStyle={styles.scrollContainer}>
        <TabHeader title="Recent Activity Sources" />

        <AnimatedSection style={styles.section} delay={50}>
          <Text style={styles.description}>
            Select which services should appear in your Recent Activity widget
            on the dashboard. Only enabled services are shown here.
          </Text>

          <Text style={styles.statsText}>
            {selectedCount} of {allConnectors.length} services selected
          </Text>

          <View style={styles.controlButtons}>
            <Button
              mode="contained-tonal"
              onPress={handleSelectAll}
              style={{ flex: 1 }}
              icon="check-all"
            >
              Select All
            </Button>
            <Button
              mode="outlined"
              onPress={handleClearAll}
              style={{ flex: 1 }}
              icon="close"
            >
              Clear All
            </Button>
          </View>
        </AnimatedSection>

        {Object.entries(groupedConnectors)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([serviceType, connectors], sectionIndex) => (
            <AnimatedSection
              key={serviceType}
              style={styles.section}
              delay={100 + sectionIndex * 50}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}{" "}
                  Services
                </Text>
                <View style={styles.connectorType}>
                  <MaterialCommunityIcons
                    name={getServiceIcon(serviceType)}
                    size={14}
                    color={theme.colors.primary}
                  />
                </View>
              </View>
              {connectors.map((connector, index) => {
                const isSelected =
                  recentActivitySourceIds === undefined ||
                  recentActivitySourceIds.includes(connector.config.id);
                return (
                  <AnimatedListItem
                    key={connector.config.id}
                    index={index}
                    totalItems={connectors.length}
                  >
                    <Card variant="custom" style={styles.connectorCard}>
                      <View style={styles.connectorContent}>
                        <View style={styles.connectorIcon}>
                          <MaterialCommunityIcons
                            name={getServiceIcon(serviceType)}
                            size={20}
                            color={theme.colors.primary}
                          />
                        </View>
                        <View style={styles.connectorInfo}>
                          <Text style={styles.connectorName}>
                            {connector.config.name}
                          </Text>
                          <Text style={styles.connectorMeta}>
                            {connector.config.url}
                          </Text>
                          <View style={styles.connectorType}>
                            <Text style={styles.connectorTypeText}>
                              {serviceType}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.connectorActions}>
                          <Switch
                            value={isSelected}
                            onValueChange={() =>
                              handleToggle(connector.config.id)
                            }
                            color={theme.colors.primary}
                          />
                        </View>
                      </View>
                    </Card>
                  </AnimatedListItem>
                );
              })}
            </AnimatedSection>
          ))}
      </AnimatedScrollView>
    </SafeAreaView>
  );
};

export default RecentActivitySourcesScreen;
