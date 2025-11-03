import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
  SettingsListItem,
  SettingsGroup,
  UniArrLoader,
} from "@/components/common";
import { TabHeader } from "@/components/common/TabHeader";
import { useLoaderConfig } from "@/hooks/useLoaderConfig";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

const UniArrLoaderScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { loaderConfig, setLoaderConfig } = useLoaderConfig();

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
    previewContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.lg,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 8,
      marginBottom: spacing.md,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.onSurface,
      marginBottom: spacing.sm,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TabHeader
        title="UniArr Loader Configuration"
        showBackButton
        onBackPress={handleBackPress}
      />
      <AnimatedScrollView contentContainerStyle={styles.content}>
        <AnimatedSection style={styles.section} delay={0} animated>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Current Configuration</Text>
            <UniArrLoader centered />
          </View>
        </AnimatedSection>

        <AnimatedSection style={styles.section} delay={100} animated>
          <Text style={styles.sectionTitle}>Size</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={3} animated>
              <SettingsListItem
                title="Small"
                subtitle="32px"
                left={{ iconName: "circle-small" }}
                trailing={
                  loaderConfig.size === 32 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() => setLoaderConfig({ ...loaderConfig, size: 32 })}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem index={1} totalItems={3} animated>
              <SettingsListItem
                title="Medium"
                subtitle="50px (default)"
                left={{ iconName: "circle-medium" }}
                trailing={
                  loaderConfig.size === 50 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() => setLoaderConfig({ ...loaderConfig, size: 50 })}
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={2} totalItems={3} animated>
              <SettingsListItem
                title="Large"
                subtitle="64px"
                left={{ iconName: "circle-large" }}
                trailing={
                  loaderConfig.size === 64 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() => setLoaderConfig({ ...loaderConfig, size: 64 })}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        <AnimatedSection style={styles.section} delay={200} animated>
          <Text style={styles.sectionTitle}>Stroke Width</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={3} animated>
              <SettingsListItem
                title="Thin"
                subtitle="2px"
                left={{ iconName: "border-all-variant" }}
                trailing={
                  loaderConfig.strokeWidth === 2 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({ ...loaderConfig, strokeWidth: 2 })
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem index={1} totalItems={3} animated>
              <SettingsListItem
                title="Normal"
                subtitle="4px (default)"
                left={{ iconName: "border-all" }}
                trailing={
                  loaderConfig.strokeWidth === 4 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({ ...loaderConfig, strokeWidth: 4 })
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={2} totalItems={3} animated>
              <SettingsListItem
                title="Thick"
                subtitle="6px"
                left={{ iconName: "border-all-variant" }}
                trailing={
                  loaderConfig.strokeWidth === 6 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({ ...loaderConfig, strokeWidth: 6 })
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        <AnimatedSection style={styles.section} delay={300} animated>
          <Text style={styles.sectionTitle}>Animation Speed</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={3} animated>
              <SettingsListItem
                title="Slow"
                subtitle="1500ms"
                left={{ iconName: "speedometer-slow" }}
                trailing={
                  loaderConfig.duration === 1500 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({ ...loaderConfig, duration: 1500 })
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem index={1} totalItems={3} animated>
              <SettingsListItem
                title="Normal"
                subtitle="1000ms (default)"
                left={{ iconName: "speedometer-medium" }}
                trailing={
                  loaderConfig.duration === 1000 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({ ...loaderConfig, duration: 1000 })
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={2} totalItems={3} animated>
              <SettingsListItem
                title="Fast"
                subtitle="750ms"
                left={{ iconName: "speedometer" }}
                trailing={
                  loaderConfig.duration === 750 ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({ ...loaderConfig, duration: 750 })
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        <AnimatedSection style={styles.section} delay={400} animated>
          <Text style={styles.sectionTitle}>Color Scheme</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={4} animated>
              <SettingsListItem
                title="Theme Aware"
                subtitle="Use primary and secondary theme colors"
                left={{ iconName: "palette" }}
                trailing={
                  loaderConfig.useThemeColors ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({
                    ...loaderConfig,
                    useThemeColors: true,
                  })
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem index={1} totalItems={4} animated>
              <SettingsListItem
                title="Default"
                subtitle="Pink to Cyan"
                left={{ iconName: "palette" }}
                trailing={
                  !loaderConfig.useThemeColors &&
                  loaderConfig.colors.join(",") === "#FF0080,#00FFFF" ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({
                    ...loaderConfig,
                    useThemeColors: false,
                    colors: ["#FF0080", "#00FFFF"],
                  })
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={2} totalItems={4} animated>
              <SettingsListItem
                title="Blue"
                subtitle="Blue to Light Blue"
                left={{ iconName: "palette" }}
                trailing={
                  !loaderConfig.useThemeColors &&
                  loaderConfig.colors.join(",") === "#0066CC,#00CCFF" ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({
                    ...loaderConfig,
                    useThemeColors: false,
                    colors: ["#0066CC", "#00CCFF"],
                  })
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem index={3} totalItems={4} animated>
              <SettingsListItem
                title="Green"
                subtitle="Green to Lime"
                left={{ iconName: "palette" }}
                trailing={
                  !loaderConfig.useThemeColors &&
                  loaderConfig.colors.join(",") === "#00AA00,#66FF66" ? (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  ) : null
                }
                onPress={() =>
                  setLoaderConfig({
                    ...loaderConfig,
                    useThemeColors: false,
                    colors: ["#00AA00", "#66FF66"],
                  })
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

export default UniArrLoaderScreen;
