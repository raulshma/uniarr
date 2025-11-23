import React, { useState } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { Text, useTheme, Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
  SettingsListItem,
  SettingsGroup,
} from "@/components/common";
import { TabHeader } from "@/components/common/TabHeader";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

// Define available quick actions
interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
}

const AVAILABLE_ACTIONS: QuickAction[] = [
  {
    id: "search",
    label: "Search",
    icon: "magnify",
    route: "/(auth)/(tabs)/services",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "calendar",
    route: "/(auth)/calendar",
  },
  {
    id: "downloads",
    label: "Downloads",
    icon: "download",
    route: "/(auth)/(tabs)/downloads",
  },
  {
    id: "monitor",
    label: "Monitor",
    icon: "monitor-dashboard",
    route: "/(auth)/monitoring",
  },
  {
    id: "recent",
    label: "Recent",
    icon: "clock-outline",
    route: "/(auth)/recently-added",
  },
  {
    id: "discover",
    label: "Discover",
    icon: "compass-outline",
    route: "/(auth)/discover",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "cog",
    route: "/(auth)/(tabs)/settings",
  },
  {
    id: "services",
    label: "Services",
    icon: "server-network",
    route: "/(auth)/(tabs)/services",
  },
  {
    id: "recommendations",
    label: "Recommendations",
    icon: "star-outline",
    route: "/(auth)/(tabs)/recommendations",
  },
  {
    id: "anime",
    label: "Anime Hub",
    icon: "animation",
    route: "/(auth)/anime-hub",
  },
];

const QuickActionsScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  // For now, use default actions. In the future, this would come from settings store
  const [enabledActions, setEnabledActions] = useState<string[]>([
    "search",
    "calendar",
    "downloads",
    "monitor",
    "recent",
    "discover",
    "settings",
  ]);

  const handleBackPress = () => {
    router.back();
  };

  const toggleAction = (actionId: string) => {
    setEnabledActions((prev) => {
      if (prev.includes(actionId)) {
        if (prev.length === 1) {
          Alert.alert(
            "Cannot Remove",
            "You must have at least one quick action enabled.",
          );
          return prev;
        }
        return prev.filter((id) => id !== actionId);
      } else {
        return [...prev, actionId];
      }
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    section: {
      marginVertical: spacing.md,
    },
    sectionTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontWeight: "600",
      color: theme.colors.onBackground,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    description: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      lineHeight: 20,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.custom.sizes.borderRadius.lg,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.primaryContainer,
    },
    checkIcon: {
      marginLeft: spacing.sm,
    },
    footer: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    saveButton: {
      borderRadius: theme.custom.sizes.borderRadius.lg,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TabHeader
        title="Quick Actions"
        showBackButton
        onBackPress={handleBackPress}
      />
      <AnimatedScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Customize which actions appear in your dashboard. Tap to enable or
          disable actions.
        </Text>

        <AnimatedSection style={styles.section} delay={0} animated>
          <Text style={styles.sectionTitle}>Available Actions</Text>
          <SettingsGroup>
            {AVAILABLE_ACTIONS.map((action, index) => {
              const isEnabled = enabledActions.includes(action.id);
              return (
                <AnimatedListItem
                  key={action.id}
                  index={index}
                  totalItems={AVAILABLE_ACTIONS.length}
                  animated
                >
                  <SettingsListItem
                    title={action.label}
                    subtitle={isEnabled ? "Enabled" : "Disabled"}
                    left={{
                      iconName: action.icon as any,
                    }}
                    trailing={
                      isEnabled ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color={theme.colors.primary}
                          style={styles.checkIcon}
                        />
                      ) : null
                    }
                    onPress={() => toggleAction(action.id)}
                    groupPosition={
                      index === 0
                        ? "top"
                        : index === AVAILABLE_ACTIONS.length - 1
                          ? "bottom"
                          : "middle"
                    }
                  />
                </AnimatedListItem>
              );
            })}
          </SettingsGroup>
        </AnimatedSection>

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={() => {
              // TODO: Save to settings store
              Alert.alert(
                "Saved",
                "Quick actions will be updated in a future release.",
              );
              router.back();
            }}
            style={styles.saveButton}
          >
            Save Changes
          </Button>
        </View>
      </AnimatedScrollView>
    </SafeAreaView>
  );
};

export default QuickActionsScreen;
