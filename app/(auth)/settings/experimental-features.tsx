import { StyleSheet } from "react-native";
import { Text, useTheme, Switch } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

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
  const router = useRouter();

  const frostedWidgetsEnabled = useSettingsStore(
    (s) => s.frostedWidgetsEnabled,
  );
  const gradientBackgroundEnabled = useSettingsStore(
    (s) => s.gradientBackgroundEnabled,
  );
  const experimentalWeatherEffectsEnabled = useSettingsStore(
    (s) => s.experimentalWeatherEffectsEnabled,
  );
  const enableBackdropWithBlur = useSettingsStore(
    (s) => s.enableBackdropWithBlur,
  );
  const trailerFeatureEnabled = useSettingsStore(
    (s) => s.trailerFeatureEnabled,
  );
  const setFrostedWidgetsEnabled = useSettingsStore(
    (s) => s.setFrostedWidgetsEnabled,
  );
  const setGradientBackgroundEnabled = useSettingsStore(
    (s) => s.setGradientBackgroundEnabled,
  );
  const setExperimentalWeatherEffectsEnabled = useSettingsStore(
    (s) => s.setExperimentalWeatherEffectsEnabled,
  );
  const setBackdropWithBlurEnabled = useSettingsStore(
    (s) => s.setBackdropWithBlurEnabled,
  );
  const setTrailerFeatureEnabled = useSettingsStore(
    (s) => s.setTrailerFeatureEnabled,
  );

  const handleBackPress = () => {
    router.back();
  };

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
      <TabHeader
        title="Experimental Features"
        showBackButton
        onBackPress={handleBackPress}
      />
      <AnimatedScrollView contentContainerStyle={styles.content}>
        <AnimatedSection style={styles.section} delay={0} animated>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={5} animated>
              <SettingsListItem
                title="Backdrop with Blur"
                subtitle="Blurry background effect with dissolve fade in Discover and Anime Hub"
                left={{ iconName: "image-filter-hdr" }}
                trailing={
                  <Switch
                    value={enableBackdropWithBlur}
                    onValueChange={setBackdropWithBlurEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem index={1} totalItems={5} animated>
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
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={2} totalItems={5} animated>
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
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={3} totalItems={5} animated>
              <SettingsListItem
                title="Weather Background Effects"
                subtitle="Ambient weather animations on dashboard (experimental)"
                left={{ iconName: "weather-partly-rainy" }}
                trailing={
                  <Switch
                    value={experimentalWeatherEffectsEnabled}
                    onValueChange={setExperimentalWeatherEffectsEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={4} totalItems={5} animated>
              <SettingsListItem
                title="Video Trailers"
                subtitle="Show trailers in detail pages"
                left={{ iconName: "play-circle" }}
                trailing={
                  <Switch
                    value={trailerFeatureEnabled}
                    onValueChange={setTrailerFeatureEnabled}
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
