import React, { useMemo } from "react";
import type { StyleProp, ViewStyle, ImageSource } from "react-native";
import { StyleSheet, View, Pressable } from "react-native";
import {
  Avatar,
  IconButton,
  Text,
  Tooltip,
  useTheme,
} from "react-native-paper";
import { UniArrLoader } from "@/components/common";

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
  icon?: React.ComponentProps<typeof Avatar.Icon>["icon"] | ImageSource;
  description?: string;
  latency?: number;
  version?: string;
  onPress?: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
  onSettingsPress?: () => void;
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

const arePropsEqual = (
  prevProps: ServiceCardProps,
  nextProps: ServiceCardProps,
) => {
  // Only re-render if these essential props changed
  const propsToCompare: (keyof ServiceCardProps)[] = [
    "id",
    "name",
    "url",
    "status",
    "statusDescription",
    "latency",
    "version",
    "lastCheckedAt",
    "icon",
    "description",
    "isDeleting",
  ];

  for (const prop of propsToCompare) {
    const prevValue = prevProps[prop];
    const nextValue = nextProps[prop];

    if (prevValue !== nextValue) {
      // Special handling for objects that might be the same reference
      if (
        prop === "icon" &&
        typeof prevValue === "object" &&
        typeof nextValue === "object" &&
        prevValue &&
        nextValue &&
        "uri" in prevValue &&
        "uri" in nextValue
      ) {
        if (prevValue.uri !== nextValue.uri) {
          return false; // Re-render needed
        }
      } else {
        return false; // Re-render needed for other changed props
      }
    }
  }

  // Function props rarely change, but check them anyway
  if (
    prevProps.onPress !== nextProps.onPress ||
    prevProps.onEditPress !== nextProps.onEditPress ||
    prevProps.onDeletePress !== nextProps.onDeletePress ||
    prevProps.onSettingsPress !== nextProps.onSettingsPress
  ) {
    return false;
  }

  return true; // No re-render needed
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
  onSettingsPress,
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
      contentPadding="md"
      style={style}
      testID={testID}
      accessibilityLabel={cardAccessibilityLabel}
      accessibilityHint={cardAccessibilityHint}
      focusable={Boolean(onPress)}
      variant="custom"
    >
      <Pressable onPress={onPress} style={styles.pressable}>
        <View style={styles.root}>
          {/* Top Section: icon + name + status */}
          <View style={styles.topSection}>
            <View style={styles.topRow}>
              {typeof icon === "object" && "uri" in icon ? (
                <Avatar.Image
                  size={avatarSizes.lg}
                  source={icon}
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                />
              ) : (
                <Avatar.Icon
                  size={avatarSizes.lg}
                  icon={
                    icon as React.ComponentProps<typeof Avatar.Icon>["icon"]
                  }
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                  color={theme.colors.onPrimaryContainer}
                />
              )}

              <View
                style={[styles.meta, { marginLeft: theme.custom.spacing.md }]}
              >
                <View style={styles.titleRow}>
                  <Tooltip title={name}>
                    <Text
                      variant="titleMedium"
                      style={{ color: theme.colors.onSurface }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </Tooltip>
                  <View style={styles.statusWrapper}>
                    <ServiceStatus status={status} />
                  </View>
                </View>
                <Tooltip title={url}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    numberOfLines={2}
                  >
                    {url}
                  </Text>
                </Tooltip>
              </View>
            </View>
          </View>

          {/* Bottom Section: badges + actions */}
          <View style={styles.bottomSection}>
            <View style={styles.bottomRow}>
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
                  <Tooltip title={statusDescription}>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginLeft: 8,
                      }}
                      numberOfLines={1}
                    >
                      {statusDescription}
                    </Text>
                  </Tooltip>
                ) : null}

                {relativeTime ? (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginLeft: 8,
                    }}
                  >
                    Last checked {relativeTime}
                  </Text>
                ) : null}
              </View>

              <View style={styles.actions}>
                {onSettingsPress ? (
                  <IconButton
                    icon="cog"
                    size={20}
                    onPress={onSettingsPress}
                    accessibilityLabel={`Settings for ${name}`}
                    accessibilityHint="Opens service settings"
                  />
                ) : null}
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
                    <View style={styles.deleteSpinner}>
                      <UniArrLoader size={20} centered />
                    </View>
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
          </View>
        </View>
      </Pressable>
    </Card>
  );
};

export default React.memo(ServiceCard, arePropsEqual);

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  root: {
    flexDirection: "column",
  },
  topSection: {
    marginBottom: spacing.sm,
  },
  topRow: {
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
  bottomSection: {},
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  deleteSpinner: {
    marginHorizontal: spacing.xxxs,
  },
});
