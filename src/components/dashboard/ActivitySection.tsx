import React, { memo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface ActivitySectionProps {
  activeDownloadsCount: number;
  showDownloads: () => void;
  nextRelease: any;
}

const ActivitySection = memo(
  ({
    activeDownloadsCount,
    showDownloads,
    nextRelease,
  }: ActivitySectionProps) => {
    const theme = useTheme();
    const router = useRouter();

    const styles = StyleSheet.create({
      section: {
        paddingHorizontal: theme.custom.spacing.xs,
        marginBottom: theme.custom.spacing.md,
      },
      sectionTitle: {
        fontSize: theme.custom.typography.titleMedium.fontSize,
        fontWeight: "600",
        marginBottom: theme.custom.spacing.sm,
        color: theme.colors.onBackground,
        paddingHorizontal: theme.custom.spacing.xs,
      },
      card: {
        marginBottom: theme.custom.spacing.xs,
        marginHorizontal: theme.custom.spacing.xs,
        borderRadius: theme.custom.sizes.borderRadius.xxl,
        overflow: "hidden",
        elevation: 0,
        backgroundColor: theme.colors.elevation.level1,
      },
      cardContent: {
        flexDirection: "row",
        alignItems: "center",
        padding: theme.custom.spacing.md,
      },
      cardIcon: {
        width: 48,
        height: 48,
        borderRadius: theme.custom.sizes.borderRadius.lg,
        justifyContent: "center",
        alignItems: "center",
        marginRight: theme.custom.spacing.md,
        backgroundColor: theme.colors.surfaceVariant,
      },
      cardText: {
        flex: 1,
      },
      cardTitle: {
        fontSize: theme.custom.typography.bodyLarge.fontSize,
        fontWeight: "600",
        color: theme.colors.onSurface,
        marginBottom: 2,
      },
      cardSubtitle: {
        fontSize: theme.custom.typography.bodySmall.fontSize,
        color: theme.colors.onSurfaceVariant,
        fontWeight: "400",
      },
    });

    const handleNextReleasePress = () => {
      if (!nextRelease) {
        router.push("/(auth)/calendar");
        return;
      }

      if (
        nextRelease.type === "episode" &&
        nextRelease.seriesId &&
        nextRelease.serviceId &&
        nextRelease.serviceType === "sonarr"
      ) {
        try {
          router.push(
            `/(auth)/sonarr/${nextRelease.serviceId}/series/${nextRelease.seriesId}`,
          );
        } catch (error) {
          console.error("Navigation error:", error);
          router.push("/(auth)/calendar");
        }
      } else {
        router.push("/(auth)/calendar");
      }
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>

        <TouchableOpacity onPress={showDownloads} activeOpacity={0.7}>
          <Surface style={styles.card} elevation={0}>
            <View style={styles.cardContent}>
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons
                  name="download"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>
                  {activeDownloadsCount > 0
                    ? `${activeDownloadsCount} Active Downloads`
                    : "No Active Downloads"}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {activeDownloadsCount > 0
                    ? "Tap to view progress"
                    : "All downloads complete"}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNextReleasePress} activeOpacity={0.7}>
          <Surface style={styles.card} elevation={0}>
            <View style={styles.cardContent}>
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons
                  name="calendar-clock"
                  size={24}
                  color={theme.colors.tertiary}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>
                  {nextRelease ? nextRelease.title : "No Upcoming Releases"}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {nextRelease
                    ? `Airing ${new Date(nextRelease.releaseDate).toLocaleDateString()}`
                    : "Check calendar for schedule"}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </Surface>
        </TouchableOpacity>
      </View>
    );
  },
);

export default ActivitySection;
