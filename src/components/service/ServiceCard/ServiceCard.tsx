import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

import { Card } from "@/components/common/Card";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { avatarSizes } from "@/constants/sizes";
import {
  ServiceStatus,
  type ServiceStatusState,
} from "@/components/service/ServiceStatus";

export type ServiceCardProps = {
  id: string;
  name: string;
  url: string;
  status: ServiceStatusState;
  statusDescription?: string;
  lastCheckedAt?: Date | string;
  icon?: React.ComponentProps<typeof Avatar.Icon>["icon"];
  description?: string;
  latency?: number;
  version?: string;
  onPress?: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
  isDeleting?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const formatRelativeTime = (input?: Date | string): string | undefined => {
  if (!input) {
    return undefined;
  }

  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const diff = Date.now() - date.getTime();
  if (diff < 0) {
    return "Just now";
  }

  const minutes = Math.round(diff / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.round(days / 30);
  return `${months}mo ago`;
};

const ServiceCard: React.FC<ServiceCardProps> = ({
  name,
  url,
  status,
  statusDescription,
  lastCheckedAt,
  icon = "server",
  description,
  latency,
  version,
  onPress,
  onEditPress,
  onDeletePress,
  isDeleting = false,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();

  const relativeTime = useMemo(
    () => formatRelativeTime(lastCheckedAt),
    [lastCheckedAt],
  );

  const statusLabel = useMemo(() => {
    switch (status) {
      case "online":
        return "Online";
      case "degraded":
        return "Degraded";
      case "offline":
      default:
        return "Offline";
    }
  }, [status]);

  const cardAccessibilityLabel = useMemo(() => {
    const fragments: string[] = [];

    fragments.push(`Service ${name}`);

    if (statusLabel) {
      fragments.push(`Status ${statusLabel}`);
    }

    if (statusDescription) {
      fragments.push(statusDescription);
    }

    if (relativeTime) {
      fragments.push(`Last checked ${relativeTime}`);
    }

    return fragments.join(". ");
  }, [name, relativeTime, statusDescription, statusLabel]);

  const cardAccessibilityHint = onPress ? "Open service details" : undefined;

  return (
    <Card
      onPress={onPress}
      contentPadding="md"
      style={style}
      testID={testID}
      accessibilityLabel={cardAccessibilityLabel}
      accessibilityHint={cardAccessibilityHint}
      focusable={Boolean(onPress)}
    >
      <View style={styles.root}>
        <Avatar.Icon
          size={avatarSizes.lg}
          icon={icon}
          style={{ backgroundColor: theme.colors.primaryContainer }}
          color={theme.colors.onPrimaryContainer}
        />

        <View style={[styles.meta, { marginLeft: theme.custom.spacing.md }]}>
          <View style={styles.titleRow}>
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface }}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View style={styles.statusWrapper}>
              <ServiceStatus status={status} />
            </View>
          </View>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
            numberOfLines={2}
          >
            {url}
          </Text>

          {/* Badges row: service type, status, latency, version */}
          <View style={styles.badgesRow}>
            {description ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onPrimaryContainer }}
                >
                  {description}
                </Text>
              </View>
            ) : null}

            {/* Status badge uses the appropriate container token */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    status === "online"
                      ? theme.colors.primaryContainer
                      : status === "degraded"
                        ? theme.colors.tertiaryContainer
                        : theme.colors.errorContainer,
                },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{
                  color:
                    status === "online"
                      ? theme.colors.onPrimaryContainer
                      : status === "degraded"
                        ? theme.colors.onTertiaryContainer
                        : theme.colors.onErrorContainer,
                }}
              >
                {status === "online"
                  ? "Connected"
                  : status === "degraded"
                    ? "Degraded"
                    : "Offline"}
              </Text>
            </View>

            {typeof latency === "number" ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {`${latency} ms`}
                </Text>
              </View>
            ) : null}

            {version ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {`v${version}`}
                </Text>
              </View>
            ) : null}

            {statusDescription ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}
                numberOfLines={1}
              >
                {statusDescription}
              </Text>
            ) : null}

            {relativeTime ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}
              >
                Last checked {relativeTime}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          {onEditPress ? (
            <IconButton
              icon="pencil"
              size={20}
              onPress={onEditPress}
              accessibilityLabel={`Edit ${name}`}
              accessibilityHint="Opens the edit service form"
            />
          ) : null}
          {onDeletePress ? (
            isDeleting ? (
              <ActivityIndicator size={20} style={styles.deleteSpinner} />
            ) : (
              <IconButton
                icon="delete"
                size={20}
                onPress={onDeletePress}
                disabled={isDeleting}
                accessibilityLabel={`Delete ${name}`}
                accessibilityHint="Removes this service"
              />
            )
          ) : null}
        </View>
      </View>
    </Card>
  );
};

export default ServiceCard;

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  meta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xxxs,
  },
  statusWrapper: {
    marginLeft: spacing.md,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  deleteSpinner: {
    marginHorizontal: spacing.xxxs,
  },
});
