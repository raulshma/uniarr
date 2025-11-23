import React from "react";
import { StyleSheet, View, Pressable, Linking, Alert } from "react-native";
import { Text, useTheme, Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { UniArrLoader } from "@/components/common";
import { EmptyState } from "@/components/common/EmptyState";
import { ServiceHealthDetail } from "@/components/health/ServiceHealthDetail";
import { useServiceHealth } from "@/hooks/useAggregatedHealth";
import { useConnectorsStore } from "@/store/connectorsStore";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import type { HealthMessage } from "@/models/logger.types";

/**
 * Service Health Detail Screen
 *
 * Displays detailed health information for a single service.
 *
 * Features:
 * - Display detailed health information using ServiceHealthDetail
 * - Show all health messages with filtering
 * - Navigate to wiki URLs for more information
 * - Navigate to logs for troubleshooting
 *
 * Requirements: 1.2, 1.3
 */
const ServiceHealthDetailScreen = () => {
  const theme = useTheme<AppTheme>();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();

  // Get service connector
  const connector = useConnectorsStore((state) =>
    serviceId ? state.getConnector(serviceId) : undefined,
  );

  // Fetch service health
  const {
    data: healthDetail,
    isLoading,
    error,
    refetch,
  } = useServiceHealth(serviceId ?? "", {
    enabled: !!serviceId,
    refetchInterval: 60000, // 60 seconds
  });

  // Handle message press - open wiki URL if available
  const handleMessagePress = React.useCallback(
    async (message: HealthMessage) => {
      if (message.wikiUrl) {
        try {
          const canOpen = await Linking.canOpenURL(message.wikiUrl);
          if (canOpen) {
            await Linking.openURL(message.wikiUrl);
          } else {
            Alert.alert(
              "Cannot Open Link",
              "Unable to open the wiki URL. Please check your browser settings.",
            );
          }
        } catch (error) {
          Alert.alert(
            "Error",
            `Failed to open wiki URL: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }
    },
    [],
  );

  // Handle navigate to logs
  const handleNavigateToLogs = React.useCallback(() => {
    if (!serviceId) return;
    router.push(`/logs?serviceId=${serviceId}`);
  }, [serviceId]);

  // Invalid service ID
  if (!serviceId) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Invalid Service"
          description="No service ID provided"
          actionLabel="Go Back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <UniArrLoader size={80} centered />
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurface, marginTop: 16 }}
          >
            Loading Health Details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="heart-pulse"
          title="Failed to Load Health Details"
          description={
            error instanceof Error ? error.message : "Unknown error occurred"
          }
          actionLabel="Retry"
          onActionPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  // Service not found
  if (!healthDetail || !connector) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Service Not Found"
          description="The requested service could not be found"
          actionLabel="Go Back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon
            source="arrow-left"
            size={24}
            color={theme.colors.onBackground}
          />
        </Pressable>
        <View style={styles.headerText}>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Health Details
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {healthDetail.serviceName}
          </Text>
        </View>
      </View>

      {/* Service Health Detail */}
      <ServiceHealthDetail
        healthDetail={healthDetail}
        onMessagePress={handleMessagePress}
      />

      {/* Navigate to Logs Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleNavigateToLogs}
          style={[
            styles.logsButton,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View service logs"
        >
          <Icon
            source="text-box-search-outline"
            size={24}
            color={theme.colors.onPrimaryContainer}
          />
          <Text
            variant="titleMedium"
            style={[
              styles.logsButtonText,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            View Service Logs
          </Text>
          <Icon
            source="chevron-right"
            size={24}
            color={theme.colors.onPrimaryContainer}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  footer: {
    padding: spacing.md,
  },
  logsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
  },
  logsButtonText: {
    fontWeight: "600",
  },
});

export default ServiceHealthDetailScreen;
