import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { Text, useTheme, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { useSettingsStore } from "@/store/settingsStore";
import {
  AnimatedListItem,
  AnimatedSection,
  SettingsGroup,
  SettingsListItem,
} from "@/components/common";
import { shouldAnimateLayout } from "@/utils/animations.utils";

const ByokLandingScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { byokGeocodeMapsCoApiKey } = useSettingsStore();

  const animationsEnabled = shouldAnimateLayout(false, false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    sectionDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <AnimatedSection
          style={styles.section}
          delay={0}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Bring Your Own Keys (BYOK)</Text>
          <Text style={styles.sectionDescription}>
            Configure your own API keys and credentials for enhanced app
            features. All keys are stored securely on your device.
          </Text>
        </AnimatedSection>

        {/* Location Services Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Location Services</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Geocode.maps.co"
                subtitle={
                  byokGeocodeMapsCoApiKey ? "Configured" : "Not configured"
                }
                left={{ iconName: "map-marker" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/settings/byok/geocode")}
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* More Features Section */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>More Features Coming Soon</Text>
          <SettingsGroup>
            <View
              style={{
                backgroundColor: theme.colors.elevation.level1,
                marginHorizontal: spacing.xs,
                marginVertical: spacing.xs / 2,
                borderRadius: borderRadius.xxl,
                padding: spacing.md,
              }}
            >
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: theme.custom.typography.bodySmall.fontSize,
                  fontFamily: theme.custom.typography.bodySmall.fontFamily,
                  lineHeight: theme.custom.typography.bodySmall.lineHeight,
                  letterSpacing:
                    theme.custom.typography.bodySmall.letterSpacing,
                  fontWeight: theme.custom.typography.bodySmall
                    .fontWeight as any,
                }}
              >
                We're planning to add more API key configuration options for
                additional features in upcoming releases.
              </Text>
            </View>
          </SettingsGroup>
        </AnimatedSection>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ByokLandingScreen;
