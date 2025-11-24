import React, { memo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface HeroStatsCardProps {
  healthOverview: {
    online: number;
    total: number;
    offline: number;
  };
}

const HeroStatsCard = memo(({ healthOverview }: HeroStatsCardProps) => {
  const theme = useTheme();
  const router = useRouter();

  const styles = StyleSheet.create({
    section: {
      paddingHorizontal: theme.custom.spacing.xs,
      marginBottom: theme.custom.spacing.md,
    },
    heroCard: {
      marginBottom: theme.custom.spacing.md,
      marginHorizontal: theme.custom.spacing.xs,
      borderRadius: theme.custom.sizes.borderRadius.xxl,
      overflow: "hidden",
      elevation: 0,
      backgroundColor: theme.colors.elevation.level1,
    },
    heroContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.custom.spacing.md,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.custom.sizes.borderRadius.lg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: theme.custom.spacing.md,
      backgroundColor: theme.colors.primaryContainer,
    },
    heroTextContainer: {
      flex: 1,
    },
    heroTitle: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      marginBottom: 2,
    },
    heroValue: {
      fontSize: theme.custom.typography.headlineLarge.fontSize,
      fontWeight: "700",
      color: theme.colors.onSurface,
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    heroSubtitle: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      color: theme.colors.onSurfaceVariant,
      fontWeight: "400",
    },
  });

  return (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={() => router.push("/(auth)/(tabs)/services")}
        activeOpacity={0.7}
      >
        <Surface style={styles.heroCard} elevation={0}>
          <View style={styles.heroContent}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons
                name="server-network"
                size={24}
                color={theme.colors.onPrimaryContainer}
              />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Services Status</Text>
              <Text style={styles.heroValue}>
                {healthOverview.online}/{healthOverview.total}
              </Text>
              <Text style={styles.heroSubtitle}>
                {healthOverview.offline > 0
                  ? `${healthOverview.offline} offline`
                  : "All operational"}
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
});

export default HeroStatsCard;
