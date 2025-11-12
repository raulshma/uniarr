import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  Button,
  Text,
  useTheme,
  ActivityIndicator,
  Card,
} from "react-native-paper";
import { useRouter } from "expo-router";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedListItem,
  AnimatedSection,
  SettingsGroup,
  SettingsListItem,
} from "@/components/common";
import { apiLogger } from "@/services/logger/ApiLoggerService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import type { GroupedErrorStats, AiLogStats } from "@/models/apiLogger.types";
import { useSettingsStore } from "@/store/settingsStore";

interface Styles {
  container: ViewStyle;
  content: ViewStyle;
  headerSubtitle: TextStyle;
  sectionDescription: TextStyle;
  statRow: ViewStyle;
  statLabel: TextStyle;
  statValue: TextStyle;
  loadingContainer: ViewStyle;
  card: ViewStyle;
  hintText: TextStyle;
}

const ApiLogsHomeScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const animationsEnabled = shouldAnimateLayout(false, false);
  const apiLoggerEnabled = useSettingsStore((state) => state.apiLoggerEnabled);
  const apiLoggerAiLoggingEnabled = useSettingsStore(
    (state) => state.apiLoggerAiLoggingEnabled,
  );

  const [errorStats, setErrorStats] = useState<GroupedErrorStats | null>(null);
  const [aiStats, setAiStats] = useState<AiLogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [errorSummary, aiSummary] = await Promise.all([
        apiLogger.getGroupedStats().catch(() => null),
        apiLogger.getAiStats().catch(() => null),
      ]);

      setErrorStats(errorSummary);
      setAiStats(aiSummary);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const trailingStatus = useCallback(
    (active: boolean): TextStyle => ({
      color: active ? theme.colors.primary : theme.colors.onSurfaceVariant,
      fontWeight: "600",
    }),
    [theme.colors.onSurfaceVariant, theme.colors.primary],
  );

  const styles = StyleSheet.create<Styles>({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.custom.spacing.md,
      paddingBottom: spacing.xxxxl,
    },
    headerSubtitle: {
      color: theme.colors.onSurfaceVariant,
      marginTop: spacing.xs,
    },
    sectionDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      marginBottom: spacing.sm,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    statLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    statValue: {
      color: theme.colors.onSurface,
      fontSize: 14,
      fontWeight: "600" as const,
    },
    loadingContainer: {
      marginTop: spacing.lg,
      alignItems: "center",
    },
    card: {
      marginTop: spacing.md,
      padding: spacing.sm,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    hintText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <TabHeader title="API Logs" showBackButton onBackPress={router.back} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void fetchStats()}
            colors={[theme.colors.primary]}
          />
        }
      >
        <AnimatedSection animated={animationsEnabled} delay={40}>
          <Text style={styles.sectionDescription}>
            Review captured API activity for UniArr services. Error logs focus
            on HTTP failures, while AI logs track prompt usage across
            AI-assisted features.
          </Text>
          <Button
            mode="outlined"
            icon="cog"
            onPress={() => router.push("/(auth)/settings/api-logs/configure")}
            style={{ alignSelf: "flex-start", marginBottom: spacing.md }}
          >
            Configure API Logger
          </Button>
        </AnimatedSection>

        <AnimatedSection animated={animationsEnabled} delay={80}>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="API Error Logs"
                subtitle={
                  errorStats
                    ? `${errorStats.total} captured events`
                    : "No data yet"
                }
                left={{ iconName: "alert-circle-outline" }}
                trailing={
                  <Text style={trailingStatus(apiLoggerEnabled)}>
                    {apiLoggerEnabled ? "On" : "Off"}
                  </Text>
                }
                onPress={() => router.push("/(auth)/settings/api-logs/error")}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="AI API Logs"
                subtitle={
                  aiStats ? `${aiStats.total} captured events` : "No data yet"
                }
                left={{ iconName: "robot-outline" }}
                trailing={
                  <Text style={trailingStatus(apiLoggerAiLoggingEnabled)}>
                    {apiLoggerAiLoggingEnabled ? "On" : "Off"}
                  </Text>
                }
                onPress={() => router.push("/(auth)/settings/api-logs/ai")}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Hint when API Logger is off */}
        {!apiLoggerEnabled && (
          <AnimatedSection animated={animationsEnabled} delay={100}>
            <Text style={styles.hintText}>
              API logging is currently disabled. Enable it in the configuration
              to begin capturing errors and diagnostics.
            </Text>
            <Button
              mode="contained"
              compact
              onPress={() => router.push("/(auth)/settings/api-logs/configure")}
              style={{ alignSelf: "flex-start" }}
            >
              Enable Logger
            </Button>
          </AnimatedSection>
        )}

        <AnimatedSection animated={animationsEnabled} delay={120}>
          <Card style={styles.card} elevation={2}>
            <Text style={{ fontWeight: "600", color: theme.colors.onSurface }}>
              Latest Metrics
            </Text>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator animating size="small" />
              </View>
            ) : (
              <View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Error entries retained</Text>
                  <Text style={styles.statValue}>{errorStats?.total ?? 0}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>AI successes</Text>
                  <Text style={styles.statValue}>{aiStats?.success ?? 0}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>AI failures</Text>
                  <Text style={styles.statValue}>{aiStats?.failure ?? 0}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total AI calls</Text>
                  <Text style={styles.statValue}>{aiStats?.total ?? 0}</Text>
                </View>
              </View>
            )}

            <Button
              mode="outlined"
              icon="refresh"
              onPress={() => void fetchStats()}
              loading={isRefreshing}
              disabled={isLoading}
              style={{ marginTop: spacing.md, alignSelf: "flex-start" }}
            >
              Refresh Metrics
            </Button>
          </Card>
        </AnimatedSection>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ApiLogsHomeScreen;
