import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { Text, useTheme, IconButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";

interface OfflineIndicatorProps {
  isVisible: boolean;
  /**
   * Network status details
   */
  networkType?: string;
  /**
   * Whether to show expanded view with retry button
   * @default false
   */
  showRetry?: boolean;
  /**
   * Whether the app is currently syncing
   * @default false
   */
  isSyncing?: boolean;
  /**
   * Number of queued mutations
   */
  queuedCount?: number;
  /**
   * Callback for retry button
   */
  onRetry?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isVisible,
  networkType,
  showRetry = false,
  isSyncing = false,
  queuedCount = 0,
  onRetry,
}) => {
  const theme = useTheme<AppTheme>();
  const [expanded, setExpanded] = useState(false);
  const slideAnim = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      slideAnim.value = withTiming(1, { duration: 300 });
    } else {
      slideAnim.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible, slideAnim]);

  const getNetworkIcon = () => {
    if (networkType === "wifi") return "wifi-off";
    if (networkType === "cellular") return "signal-off";
    return "network-off";
  };

  const getStatusMessage = () => {
    if (isSyncing) return "Syncing when connection restored...";
    if (queuedCount > 0) return `${queuedCount} actions queued`;
    return "No Internet Connection";
  };

  const getStatusColor = () => {
    if (isSyncing) return theme.colors.tertiary;
    return theme.colors.error;
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: slideAnim.value === 0 ? -100 : 0,
        },
      ],
    };
  }, [slideAnim]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={[
        styles.container,
        {
          backgroundColor: getStatusColor(),
        },
        animatedStyle,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.mainContent}>
          <MaterialCommunityIcons
            name={getNetworkIcon()}
            size={20}
            color={theme.colors.onError}
            style={styles.icon}
          />
          <Text style={[styles.text, { color: theme.colors.onError }]}>
            {getStatusMessage()}
          </Text>
        </View>

        <View style={styles.actions}>
          {queuedCount > 0 && (
            <View style={styles.queueBadge}>
              <Text style={[styles.queueText, { color: theme.colors.onError }]}>
                {queuedCount}
              </Text>
            </View>
          )}

          {showRetry && onRetry && (
            <IconButton
              icon="refresh"
              size={20}
              iconColor={theme.colors.onError}
              onPress={onRetry}
              style={styles.retryButton}
            />
          )}

          <IconButton
            icon={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            iconColor={theme.colors.onError}
            onPress={() => setExpanded(!expanded)}
            style={styles.expandButton}
          />
        </View>
      </View>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[
            styles.expandedContent,
            { borderTopColor: "rgba(255,255,255,0.2)" },
          ]}
        >
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: theme.colors.onError }]}>
              Network Type: {networkType || "Unknown"}
            </Text>
          </View>

          {queuedCount > 0 && (
            <View style={styles.statusRow}>
              <Text
                style={[styles.statusText, { color: theme.colors.onError }]}
              >
                Actions queued for when you're back online
              </Text>
            </View>
          )}

          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: theme.colors.onError }]}>
              {isSyncing
                ? "Your actions will sync automatically when connection is restored"
                : "Some features may be limited while offline"}
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mainContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  queueBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
  },
  queueText: {
    fontSize: 12,
    fontWeight: "600",
  },
  retryButton: {
    margin: 0,
  },
  expandButton: {
    margin: 0,
  },
  expandedContent: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    gap: 4,
  },
  statusRow: {
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    opacity: 0.9,
  },
});
