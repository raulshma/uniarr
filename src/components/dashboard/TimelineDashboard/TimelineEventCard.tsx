import React, { memo, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/useTheme";
import type { TimelineEvent } from "@/models/timeline.types";

interface TimelineEventCardProps {
  event: TimelineEvent;
  showConnector?: boolean;
}

const TimelineEventCard = memo(
  ({ event, showConnector = false }: TimelineEventCardProps) => {
    const theme = useTheme();
    const router = useRouter();

    const handlePress = useCallback(() => {
      if (event.route) {
        try {
          router.push(event.route as any);
        } catch {
          // navigation failed
        }
      }
    }, [event.route, router]);

    const timeStr = new Date(event.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const styles = StyleSheet.create({
      container: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingLeft: theme.custom.spacing.sm,
      },
      timelineLine: {
        width: 40,
        alignItems: "center",
        paddingTop: theme.custom.spacing.md,
      },
      dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: event.color,
        backgroundColor: theme.colors.background,
      },
      line: {
        width: 2,
        flex: 1,
        backgroundColor: theme.colors.outlineVariant,
        opacity: 0.4,
      },
      card: {
        flex: 1,
        marginBottom: theme.custom.spacing.sm,
        marginHorizontal: theme.custom.spacing.xs,
        borderRadius: theme.custom.sizes.borderRadius.xl,
        overflow: "hidden",
        backgroundColor: theme.colors.elevation.level1,
      },
      cardContent: {
        flexDirection: "row",
        alignItems: "center",
        padding: theme.custom.spacing.md,
      },
      iconContainer: {
        width: 40,
        height: 40,
        borderRadius: theme.custom.sizes.borderRadius.lg,
        justifyContent: "center",
        alignItems: "center",
        marginRight: theme.custom.spacing.md,
        backgroundColor: `${event.color}20`,
      },
      textContainer: {
        flex: 1,
      },
      title: {
        fontSize: theme.custom.typography.bodyMedium.fontSize,
        fontWeight: "600",
        color: theme.colors.onSurface,
        marginBottom: 2,
      },
      subtitle: {
        fontSize: theme.custom.typography.bodySmall.fontSize,
        color: theme.colors.onSurfaceVariant,
      },
      timeText: {
        fontSize: theme.custom.typography.labelSmall.fontSize,
        color: theme.colors.onSurfaceVariant,
        marginTop: 2,
      },
      serviceBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
      },
      serviceText: {
        fontSize: theme.custom.typography.labelSmall.fontSize,
        color: theme.colors.onSurfaceVariant,
        opacity: 0.7,
      },
      progressContainer: {
        marginTop: theme.custom.spacing.xs,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.surfaceVariant,
        overflow: "hidden",
      },
      progressBar: {
        height: "100%",
        borderRadius: 2,
        backgroundColor: event.color,
      },
    });

    const content = (
      <View style={styles.cardContent}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={event.icon as any}
            size={20}
            color={event.color}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          {event.subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {event.subtitle}
            </Text>
          )}
          <Text style={styles.timeText}>{timeStr}</Text>
          {showConnector && (
            <View style={styles.serviceBadge}>
              <MaterialCommunityIcons
                name="server"
                size={10}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={styles.serviceText}>{event.serviceName}</Text>
            </View>
          )}
          {event.progress != null && event.progress > 0 && (
            <View style={styles.progressContainer}>
              <View
                style={[styles.progressBar, { width: `${event.progress}%` }]}
              />
            </View>
          )}
        </View>
      </View>
    );

    return (
      <View style={styles.container}>
        <View style={styles.timelineLine}>
          <View style={styles.dot} />
          <View style={styles.line} />
        </View>
        {event.route ? (
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            style={styles.card}
          >
            <Surface elevation={0} style={styles.card}>
              {content}
            </Surface>
          </TouchableOpacity>
        ) : (
          <Surface elevation={0} style={styles.card}>
            {content}
          </Surface>
        )}
      </View>
    );
  },
);

TimelineEventCard.displayName = "TimelineEventCard";

export default TimelineEventCard;
