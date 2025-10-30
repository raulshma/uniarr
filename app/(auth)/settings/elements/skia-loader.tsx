import { StyleSheet, View } from "react-native";
import { Text, useTheme, Button, Chip } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";

import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
  SettingsListItem,
  SettingsGroup,
  SkiaLoader,
  useSkiaLoaderConfig,
} from "@/components/common";
import { TabHeader } from "@/components/common/TabHeader";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useSettingsStore } from "@/store/settingsStore";

interface SkiaLoaderConfig {
  size: number;
  strokeWidth: number;
  duration: number;
  blur: number;
  colors: string[];
}

const SkiaLoaderConfigScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const defaultConfig = useSkiaLoaderConfig();

  // Get current config from store
  const skiaLoaderConfig = useSettingsStore(
    (s) => s.skiaLoaderConfig || defaultConfig,
  );

  const setSkiaLoaderConfig = useSettingsStore((s) => s.setSkiaLoaderConfig);

  const [tempConfig, setTempConfig] =
    useState<SkiaLoaderConfig>(skiaLoaderConfig);

  const handleBackPress = () => {
    router.back();
  };

  const updateConfig = useCallback((updates: Partial<SkiaLoaderConfig>) => {
    setTempConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = useCallback(() => {
    setSkiaLoaderConfig(tempConfig);
  }, [tempConfig, setSkiaLoaderConfig]);

  const handleReset = useCallback(() => {
    setTempConfig(defaultConfig);
    setSkiaLoaderConfig(defaultConfig);
  }, [defaultConfig, setSkiaLoaderConfig]);

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
    previewSection: {
      alignItems: "center",
      paddingVertical: spacing.lg,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      marginBottom: spacing.md,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: spacing.md,
    },
    sizeOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    strokeOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    durationOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    blurOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    colorPresets: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    actionButtons: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
  });

  const sizeOptions = [40, 60, 80, 100, 120];
  const strokeOptions = [6, 8, 10, 12, 14];
  const durationOptions = [500, 750, 1000, 1250, 1500];
  const blurOptions = [2, 3, 5, 7, 10];

  const colorPresets = [
    {
      name: "Neon",
      colors: [
        "#FF0080",
        "#FF1493",
        "#FF69B4",
        "#00FFFF",
        "#00BFFF",
        "#1E90FF",
        "#FF4500",
        "#FF6347",
        "#FFA500",
        "#00FF7F",
        "#32CD32",
        "#00FA9A",
        "#FF0080",
      ],
    },
    {
      name: "Ocean",
      colors: [
        "#001122",
        "#003366",
        "#0066CC",
        "#0099FF",
        "#33CCFF",
        "#66FFFF",
        "#001122",
      ],
    },
    { name: "Sunset", colors: ["#FF6B35", "#F7931E", "#FFD23F", "#FF6B35"] },
    {
      name: "Forest",
      colors: ["#2D5016", "#4A7C24", "#7FB069", "#A8DADC", "#2D5016"],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TabHeader
        title="Skia Loader Configuration"
        showBackButton
        onBackPress={handleBackPress}
      />
      <AnimatedScrollView contentContainerStyle={styles.content}>
        {/* Preview Section */}
        <AnimatedSection style={styles.section} delay={0} animated>
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Live Preview</Text>
            <SkiaLoader
              size={tempConfig.size}
              strokeWidth={tempConfig.strokeWidth}
              duration={tempConfig.duration}
              blur={tempConfig.blur}
              colors={tempConfig.colors}
            />
          </View>
        </AnimatedSection>

        {/* Size Configuration */}
        <AnimatedSection style={styles.section} delay={50} animated>
          <Text style={styles.sectionTitle}>Size</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={1} animated>
              <SettingsListItem
                title="Loader Size"
                subtitle={`Current: ${tempConfig.size}px`}
                left={{ iconName: "resize" }}
                trailing={
                  <View style={styles.sizeOptions}>
                    {sizeOptions.map((size) => (
                      <Chip
                        key={size}
                        mode={tempConfig.size === size ? "flat" : "outlined"}
                        onPress={() => updateConfig({ size })}
                      >
                        {size}
                      </Chip>
                    ))}
                  </View>
                }
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Stroke Width */}
        <AnimatedSection style={styles.section} delay={100} animated>
          <Text style={styles.sectionTitle}>Stroke Width</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={1} animated>
              <SettingsListItem
                title="Stroke Thickness"
                subtitle={`Current: ${tempConfig.strokeWidth}px`}
                left={{ iconName: "vector-circle" }}
                trailing={
                  <View style={styles.strokeOptions}>
                    {strokeOptions.map((width) => (
                      <Chip
                        key={width}
                        mode={
                          tempConfig.strokeWidth === width ? "flat" : "outlined"
                        }
                        onPress={() => updateConfig({ strokeWidth: width })}
                      >
                        {width}
                      </Chip>
                    ))}
                  </View>
                }
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Animation Duration */}
        <AnimatedSection style={styles.section} delay={150} animated>
          <Text style={styles.sectionTitle}>Animation Speed</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={1} animated>
              <SettingsListItem
                title="Rotation Duration"
                subtitle={`Current: ${tempConfig.duration}ms`}
                left={{ iconName: "speedometer" }}
                trailing={
                  <View style={styles.durationOptions}>
                    {durationOptions.map((duration) => (
                      <Chip
                        key={duration}
                        mode={
                          tempConfig.duration === duration ? "flat" : "outlined"
                        }
                        onPress={() => updateConfig({ duration })}
                      >
                        {duration}
                      </Chip>
                    ))}
                  </View>
                }
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Blur Amount */}
        <AnimatedSection style={styles.section} delay={200} animated>
          <Text style={styles.sectionTitle}>Glow Effect</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={1} animated>
              <SettingsListItem
                title="Blur Amount"
                subtitle={`Current: ${tempConfig.blur}px`}
                left={{ iconName: "blur" }}
                trailing={
                  <View style={styles.blurOptions}>
                    {blurOptions.map((blur) => (
                      <Chip
                        key={blur}
                        mode={tempConfig.blur === blur ? "flat" : "outlined"}
                        onPress={() => updateConfig({ blur })}
                      >
                        {blur}
                      </Chip>
                    ))}
                  </View>
                }
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Color Presets */}
        <AnimatedSection style={styles.section} delay={250} animated>
          <Text style={styles.sectionTitle}>Color Themes</Text>
          <SettingsGroup>
            {colorPresets.map((preset, index) => (
              <AnimatedListItem
                key={preset.name}
                index={index}
                totalItems={colorPresets.length}
                animated
              >
                <SettingsListItem
                  title={preset.name}
                  subtitle="Tap to apply this color scheme"
                  left={{ iconName: "palette" }}
                  onPress={() => updateConfig({ colors: preset.colors })}
                  groupPosition={
                    index === 0
                      ? "top"
                      : index === colorPresets.length - 1
                        ? "bottom"
                        : "middle"
                  }
                />
              </AnimatedListItem>
            ))}
          </SettingsGroup>
        </AnimatedSection>

        {/* Action Buttons */}
        <AnimatedSection style={styles.section} delay={300} animated>
          <View style={styles.actionButtons}>
            <Button mode="outlined" onPress={handleReset} style={{ flex: 1 }}>
              Reset to Default
            </Button>
            <Button mode="contained" onPress={handleSave} style={{ flex: 1 }}>
              Save Configuration
            </Button>
          </View>
        </AnimatedSection>
      </AnimatedScrollView>
    </SafeAreaView>
  );
};

export default SkiaLoaderConfigScreen;
