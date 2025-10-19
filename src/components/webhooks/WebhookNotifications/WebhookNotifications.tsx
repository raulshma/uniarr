import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  type ViewStyle,
} from "react-native";
import {
  Text,
  Card,
  IconButton,
  Badge,
  Button,
  useTheme,
  Portal,
  FAB,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useHaptics } from "@/hooks/useHaptics";
import { useWebhookNotifications } from "@/hooks/useWebhookNotifications";
import type { AppTheme } from "@/constants/theme";
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";
import type { WebhookNotification } from "@/services/webhooks/WebhookService";

export interface WebhookNotificationsProps {
  /**
   * Show as modal instead of embedded component
   * @default false
   */
  modal?: boolean;
  /**
   * Whether the modal is visible (only used when modal=true)
   */
  visible?: boolean;
  /**
   * Callback when modal is dismissed
   */
  onDismiss?: () => void;
  /**
   * Custom style for the container
   */
  style?: ViewStyle;
  /**
   * Maximum number of notifications to show
   * @default 20
   */
  maxNotifications?: number;
}

const WebhookNotifications: React.FC<WebhookNotificationsProps> = ({
  modal = false,
  visible,
  onDismiss,
  style,
  maxNotifications = 20,
}) => {
  const theme = useTheme<AppTheme>();
  const { spacing } = useResponsiveLayout();
  const { onPress } = useHaptics();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refreshNotifications,
    config,
    testWebhook,
    stats,
  } = useWebhookNotifications({
    limit: maxNotifications,
    showAlerts: false,
  });

  const displayNotifications = modal
    ? notifications.slice(0, maxNotifications)
    : notifications.slice(0, 5);

  const filteredNotifications = displayNotifications;

  const getNotificationIcon = (notification: WebhookNotification) => {
    switch (notification.type) {
      case "success":
        return "check-circle";
      case "error":
        return "alert-circle";
      case "warning":
        return "alert";
      case "info":
        return "information";
      default:
        return "bell";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return theme.colors.tertiary;
      case "error":
        return theme.colors.error;
      case "warning":
        return theme.colors.secondary;
      case "info":
        return theme.colors.primary;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    onPress();
    await markAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    onPress();
    await markAllAsRead();
  };

  const handleClearAll = async () => {
    onPress();
    await clearNotifications();
  };

  const handleRefresh = async () => {
    onPress();
    await refreshNotifications();
  };

  const handleTestWebhook = async () => {
    onPress();
    await testWebhook();
  };

  const renderNotification = (notification: WebhookNotification) => (
    <Card
      key={notification.id}
      style={[styles.notificationCard, !notification.read && styles.unreadCard]}
    >
      <Pressable
        onPress={() => handleMarkAsRead(notification.id)}
        style={styles.notificationPressable}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            <MaterialCommunityIcons
              name={getNotificationIcon(notification)}
              size={24}
              color={getNotificationColor(notification.type)}
            />
          </View>
          <View style={styles.notificationContent}>
            <Text
              variant="titleSmall"
              style={[
                styles.notificationTitle,
                !notification.read && styles.unreadTitle,
              ]}
            >
              {notification.title}
            </Text>
            <Text
              variant="bodySmall"
              style={styles.notificationBody}
              numberOfLines={2}
            >
              {notification.body}
            </Text>
            <Text variant="labelSmall" style={styles.notificationTime}>
              {new Date(notification.timestamp).toLocaleString()}
            </Text>
          </View>
          <View style={styles.notificationActions}>
            {!notification.read && (
              <Badge
                style={[
                  styles.unreadBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              />
            )}
          </View>
        </View>
      </Pressable>
    </Card>
  );

  const renderContent = () => (
    <View style={[styles.content, { padding: spacing.medium }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="titleLarge">Notifications</Text>
        <View style={styles.headerActions}>
          <IconButton icon="refresh" onPress={handleRefresh} />
          {config?.enabled && (
            <IconButton icon="test-tube" onPress={handleTestWebhook} />
          )}
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text variant="labelSmall">Total</Text>
          <Text variant="titleSmall">{stats.total}</Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="labelSmall">Unread</Text>
          <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
            {stats.unread}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="labelSmall">Webhooks</Text>
          <Text
            variant="titleSmall"
            style={{
              color: config?.enabled
                ? theme.colors.tertiary
                : theme.colors.error,
            }}
          >
            {config?.enabled ? "ON" : "OFF"}
          </Text>
        </View>
      </View>

      {/* Actions */}
      {unreadCount > 0 && (
        <View style={styles.actionBar}>
          <Button
            mode="outlined"
            onPress={handleMarkAllAsRead}
            compact
            style={styles.actionButton}
          >
            Mark All Read
          </Button>
          <Button
            mode="outlined"
            onPress={handleClearAll}
            compact
            style={styles.actionButton}
          >
            Clear All
          </Button>
        </View>
      )}

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(renderNotification)
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="bell-off"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="bodyMedium" style={styles.emptyText}>
              {config?.enabled
                ? "No notifications yet"
                : "Webhook notifications are disabled"}
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              {config?.enabled
                ? "Notifications will appear here when webhooks are received"
                : "Enable webhooks in settings to receive real-time notifications"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  if (modal) {
    return (
      <Portal>
        <Modal visible={visible} onDismiss={onDismiss}>
          <View
            style={[styles.modal, { backgroundColor: theme.colors.background }]}
          >
            {renderContent()}
            <View style={styles.modalActions}>
              <Button mode="contained" onPress={onDismiss}>
                Close
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {renderContent()}
      {unreadCount > 0 && (
        <FAB
          icon="bell"
          style={styles.fab}
          onPress={() => {
            /* TODO: Show modal or navigate */
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
  },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: "#f5f5f5",
    borderRadius: borderRadius.md,
  },
  statItem: {
    alignItems: "center",
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  notificationCard: {
    marginBottom: spacing.xs,
    backgroundColor: "#fafafa",
  },
  unreadCard: {
    backgroundColor: "#f0f8ff",
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  notificationPressable: {
    padding: spacing.sm,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontWeight: "600",
    marginBottom: spacing.xxs,
  },
  unreadTitle: {
    color: "#1976D2",
  },
  notificationBody: {
    opacity: 0.8,
    marginBottom: spacing.xxs,
  },
  notificationTime: {
    opacity: 0.6,
  },
  notificationActions: {
    alignItems: "center",
  },
  unreadBadge: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: spacing.xs / 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: spacing.xxs,
    opacity: 0.7,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    margin: spacing.md,
    right: 0,
    bottom: 0,
  },
  modal: {
    margin: spacing.lg,
    borderRadius: borderRadius.md,
    maxHeight: "80%",
  },
  modalActions: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
});

export default WebhookNotifications;
