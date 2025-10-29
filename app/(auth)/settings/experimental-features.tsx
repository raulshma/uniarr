import { StyleSheet } from "react-native";
import { Text, useTheme, Switch } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
  SettingsListItem,
  SettingsGroup,
} from "@/components/common";
import { TabHeader } from "@/components/common/TabHeader";

import type { AppTheme } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { spacing } from "@/theme/spacing";

const ExperimentalFeaturesScreen = () => {
  const theme = useTheme<AppTheme>();

  const frostedWidgetsEnabled = useSettingsStore(
    (s) => s.frostedWidgetsEnabled,
  );
  const gradientBackgroundEnabled = useSettingsStore(
    (s) => s.gradientBackgroundEnabled,
  );
  const setFrostedWidgetsEnabled = useSettingsStore(
    (s) => s.setFrostedWidgetsEnabled,
  );
  const setGradientBackgroundEnabled = useSettingsStore(
    (s) => s.setGradientBackgroundEnabled,
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    section: {
      marginVertical: spacing.md,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.sm,
      marginLeft: spacing.md,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TabHeader title="Experimental Features" showBackButton />
      <AnimatedScrollView contentContainerStyle={styles.content}>
        <AnimatedSection style={styles.section} delay={0} animated>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={2} animated>
              <SettingsListItem
                title="Frosted Widgets"
                subtitle="Frosted glass effect for all widgets"
                left={{ iconName: "blur" }}
                trailing={
                  <Switch
                    value={frostedWidgetsEnabled}
                    onValueChange={setFrostedWidgetsEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem index={1} totalItems={2} animated>
              <SettingsListItem
                title="Dashboard Gradient"
                subtitle="Animated gradient background effect"
                left={{ iconName: "gradient-vertical" }}
                trailing={
                  <Switch
                    value={gradientBackgroundEnabled}
                    onValueChange={setGradientBackgroundEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>
      </AnimatedScrollView>
    </SafeAreaView>
  );
};

export default ExperimentalFeaturesScreen;
