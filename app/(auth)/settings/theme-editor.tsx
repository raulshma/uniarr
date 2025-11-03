import React, { useState, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
  PaperProvider,
} from "react-native-paper";
import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
  SettingsGroup,
  SettingsListItem,
  UniArrLoader,
} from "@/components/common";
import { ColorPicker } from "@/components/common/ColorPicker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router } from "expo-router";

import { useThemeEditor } from "@/hooks/useThemeEditor";
import { TabHeader } from "@/components/common/TabHeader";
import type { AppTheme } from "@/constants/theme";
import { DensityMode, spacing } from "@/theme/spacing";
import { FontScale } from "@/theme/typography";
import { presetThemes } from "@/theme/colors";
import { borderRadius } from "@/constants/sizes";
import { shouldAnimateLayout } from "@/utils/animations.utils";

const PRESET_NAMES = {
  uniarr: "UniArr",
  cinematicRed: "Cinematic",
  goldenHour: "Golden Hour",
  oceanic: "Oceanic",
  forest: "Forest",
  vividRed: "Vivid Red",
  velvet: "Velvet",
  wonder: "Wonder",
  azure: "Azure",
  fresh: "Fresh",
  ember: "Ember",
  tracker: "Tracker",
  cobalt: "Cobalt",
  modern: "Modern",
  minimal: "Minimal",
  midnightDune: "Midnight Dune",
  neonArcade: "Neon Arcade",
  calmSlate: "Calm Slate",
  sunrise: "Sunrise",
  twilight: "Twilight",
  aurora: "Aurora",
  desertBloom: "Desert Bloom",
  arctic: "Arctic",
  retroWave: "Retro Wave",
  focus: "Focus",
  noirContrast: "Noir Contrast",
  warmPaper: "Warm Paper",
  terminal: "Terminal",
  pastel: "Pastel",
  // Newly added palettes
  royal: "Royal",
  subzero: "Sub-Zero",
  emerald: "Emerald",
  slate: "Slate",
  sunset: "Sunset",
  legacy: "UA Legacy",
};

export default function ThemeEditorScreen() {
  const theme = useTheme<AppTheme>();
  const {
    config,
    updateConfig,
    resetToDefaults,
    previewTheme,
    saveTheme,
    isLoading,
  } = useThemeEditor();

  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const animationsEnabled = shouldAnimateLayout(isLoading, false);

  const handlePresetChange = (preset: keyof typeof presetThemes) => {
    updateConfig({ preset, customColors: undefined });
  };

  const handleFontScaleChange = (fontScale: FontScale) => {
    updateConfig({ fontScale });
  };

  const handleDensityChange = (densityMode: DensityMode) => {
    updateConfig({ densityMode });
  };

  const handleGlobalBorderRadiusChange = (
    radius: keyof typeof borderRadius,
  ) => {
    updateConfig({ globalBorderRadius: radius });
  };

  const handleColorChange = (colorKey: string, value: string) => {
    updateConfig({
      customColors: {
        ...config.customColors,
        [colorKey]: value,
      },
    });
  };

  const handlePosterStyleChange = (key: string, value: number) => {
    updateConfig({
      posterStyle: {
        ...config.posterStyle,
        [key]: value,
      },
    });
  };

  const handleOledToggle = (enabled: boolean) => {
    updateConfig({ oledEnabled: enabled });
  };

  const handleReset = () => {
    setShowColorPicker(null);
    resetToDefaults();
  };

  const handleSave = async () => {
    const success = await saveTheme();
    if (success) {
      router.back();
    }
  };

  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollContainer: {
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.xxxxl,
        },
        centered: {
          justifyContent: "center",
          alignItems: "center",
        },
        loadingText: {
          marginTop: 16,
          textAlign: "center",
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
        presetGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
          marginTop: spacing.xs,
        },
        presetChip: {
          borderRadius: borderRadius.lg,
          height: 32,
        },
        colorPreview: {
          width: 24,
          height: 24,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        numberInput: {
          width: 60,
          textAlign: "center",
          borderWidth: 1,
          borderRadius: borderRadius.sm,
          paddingVertical: 6,
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.onSurface,
          borderColor: theme.colors.outlineVariant,
        },
        previewContainer: {
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
        previewCard: {
          padding: spacing.md,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
          borderRadius: config.posterStyle.borderRadius,
          backgroundColor: previewTheme.colors.surfaceVariant,
        },
        actions: {
          flexDirection: "row",
          justifyContent: "space-between",
          padding: spacing.md,
          paddingTop: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
        },
        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          elevation: 8,
        },
        actionButton: {
          flex: 1,
          marginHorizontal: spacing.xs,
        },
      }),
    [
      theme,
      config.posterStyle.borderRadius,
      previewTheme.colors.surfaceVariant,
    ],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <UniArrLoader size={80} />
        <Text style={styles.loadingText}>Loading theme editor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedScrollView
        contentContainerStyle={styles.scrollContainer}
        animated={animationsEnabled}
      >
        {/* Header */}
        <TabHeader
          title="Theme Editor"
          leftAction={{
            icon: "arrow-left",
            onPress: () => router.back(),
            accessibilityLabel: "Go back",
          }}
        />
        {/* Theme Presets Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Theme Presets</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
              style={{
                padding: spacing.sm,
                paddingTop: spacing.xxs,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View style={styles.presetGrid}>
                {Object.entries(presetThemes).map(([key, scheme]) => (
                  <Chip
                    key={key}
                    selected={config.preset === key}
                    onPress={() =>
                      handlePresetChange(key as keyof typeof presetThemes)
                    }
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor:
                          config.preset === key
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceVariant,
                      },
                    ]}
                    textStyle={{
                      color:
                        config.preset === key
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant,
                      fontSize: 12,
                    }}
                  >
                    {PRESET_NAMES[key as keyof typeof PRESET_NAMES]}
                  </Chip>
                ))}
              </View>
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Custom Colors Section */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Custom Colors</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Primary Color"
                subtitle={config.customColors?.primary || "Using preset color"}
                left={{ iconName: "palette" }}
                trailing={
                  <View
                    style={[
                      styles.colorPreview,
                      {
                        backgroundColor:
                          config.customColors?.primary || theme.colors.primary,
                      },
                    ]}
                  />
                }
                onPress={() => setShowColorPicker("primary")}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Secondary Color"
                subtitle={
                  config.customColors?.secondary || "Using preset color"
                }
                left={{ iconName: "palette" }}
                trailing={
                  <View
                    style={[
                      styles.colorPreview,
                      {
                        backgroundColor:
                          config.customColors?.secondary ||
                          theme.colors.secondary,
                      },
                    ]}
                  />
                }
                onPress={() => setShowColorPicker("secondary")}
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={2}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Background Color"
                subtitle={
                  config.customColors?.background || "Using preset color"
                }
                left={{ iconName: "palette" }}
                trailing={
                  <View
                    style={[
                      styles.colorPreview,
                      {
                        backgroundColor:
                          config.customColors?.background ||
                          theme.colors.background,
                      },
                    ]}
                  />
                }
                onPress={() => setShowColorPicker("background")}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Typography Section */}
        <AnimatedSection
          style={styles.section}
          delay={150}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Typography</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <SegmentedButtons
                value={config.fontScale}
                onValueChange={handleFontScaleChange}
                buttons={[
                  { value: "small", label: "Small" },
                  { value: "medium", label: "Medium" },
                  { value: "large", label: "Large" },
                  { value: "extra-large", label: "Extra Large" },
                ]}
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Density Section */}
        <AnimatedSection
          style={styles.section}
          delay={200}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Density</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <SegmentedButtons
                value={config.densityMode}
                onValueChange={handleDensityChange}
                buttons={[
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfortable" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Border Radius Section */}
        <AnimatedSection
          style={styles.section}
          delay={250}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Border Radius</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
              style={{ padding: spacing.sm }}
            >
              <SegmentedButtons
                value={config.globalBorderRadius || "md"}
                onValueChange={handleGlobalBorderRadiusChange}
                buttons={[
                  { value: "none", label: "None" },
                  { value: "xs", label: "XS" },
                  { value: "sm", label: "SM" },
                  { value: "md", label: "MD" },
                  { value: "lg", label: "LG" },
                ]}
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
              style={{ padding: spacing.sm, paddingTop: spacing.none }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <SegmentedButtons
                  value={config.globalBorderRadius || "md"}
                  onValueChange={handleGlobalBorderRadiusChange}
                  buttons={[
                    { value: "xl", label: "XL" },
                    { value: "xxl", label: "XXL" },
                    { value: "xxxl", label: "XXXL" },
                    { value: "round", label: "Round" },
                  ]}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    marginLeft: spacing.sm,
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  Current:{" "}
                  {
                    borderRadius[
                      (config.globalBorderRadius ||
                        "md") as keyof typeof borderRadius
                    ]
                  }
                  px
                </Text>
              </View>
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Display Options Section */}
        <AnimatedSection
          style={styles.section}
          delay={300}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Display Options</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="OLED Mode"
                subtitle="Pure black backgrounds for OLED displays (dark mode only)"
                left={{ iconName: "monitor-star" }}
                trailing={
                  <Switch
                    value={config.oledEnabled || false}
                    onValueChange={handleOledToggle}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Poster Style Section */}
        <AnimatedSection
          style={styles.section}
          delay={350}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Poster Style</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Border Radius"
                subtitle={`${config.posterStyle.borderRadius}px`}
                left={{ iconName: "image-outline" }}
                trailing={
                  <TextInput
                    value={config.posterStyle.borderRadius.toString()}
                    onChangeText={(text) =>
                      handlePosterStyleChange(
                        "borderRadius",
                        parseInt(text) || 0,
                      )
                    }
                    style={styles.numberInput}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Shadow Opacity"
                subtitle={`${config.posterStyle.shadowOpacity}`}
                left={{ iconName: "blur" }}
                trailing={
                  <TextInput
                    value={config.posterStyle.shadowOpacity.toString()}
                    onChangeText={(text) =>
                      handlePosterStyleChange(
                        "shadowOpacity",
                        parseFloat(text) || 0,
                      )
                    }
                    style={styles.numberInput}
                    keyboardType="decimal-pad"
                    maxLength={4}
                  />
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={2}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Shadow Radius"
                subtitle={`${config.posterStyle.shadowRadius}px`}
                left={{ iconName: "shadow" }}
                trailing={
                  <TextInput
                    value={config.posterStyle.shadowRadius.toString()}
                    onChangeText={(text) =>
                      handlePosterStyleChange(
                        "shadowRadius",
                        parseInt(text) || 0,
                      )
                    }
                    style={styles.numberInput}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Preview Section */}
        <AnimatedSection
          style={styles.section}
          delay={400}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Preview</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <View style={styles.previewContainer}>
                <PaperProvider theme={previewTheme}>
                  <View style={styles.previewCard}>
                    <Text variant="titleMedium">Sample Title</Text>
                    <Text
                      variant="bodyMedium"
                      style={{ opacity: 0.7, marginBottom: 12 }}
                    >
                      Sample subtitle text
                    </Text>
                    <Text variant="bodySmall">
                      This is how your content will look with the current theme
                      settings.
                    </Text>
                  </View>
                </PaperProvider>
              </View>
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>
      </AnimatedScrollView>

      <View
        style={[
          styles.actions,
          styles.footer,
          {
            borderTopColor: theme.colors.outlineVariant,
            backgroundColor: theme.colors.surface,
            paddingBottom: 8 + insets.bottom,
          },
        ]}
      >
        <Button
          mode="outlined"
          onPress={handleReset}
          style={styles.actionButton}
        >
          Reset to Defaults
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.actionButton}
        >
          Save Theme
        </Button>
      </View>

      <Portal>
        <ColorPicker
          visible={showColorPicker !== null}
          onDismiss={() => setShowColorPicker(null)}
          onColorSelected={(color: string) => {
            if (showColorPicker) {
              handleColorChange(showColorPicker, color);
              setShowColorPicker(null);
            }
          }}
          initialColor={
            showColorPicker &&
            config.customColors?.[
              showColorPicker as keyof typeof config.customColors
            ]
              ? config.customColors[
                  showColorPicker as keyof typeof config.customColors
                ]!
              : typeof theme.colors[
                    showColorPicker as keyof typeof theme.colors
                  ] === "string"
                ? (theme.colors[
                    showColorPicker as keyof typeof theme.colors
                  ] as string)
                : "#000000"
          }
        />
      </Portal>
    </SafeAreaView>
  );
}
