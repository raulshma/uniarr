import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  List,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
  PaperProvider,
} from 'react-native-paper';
import { router } from 'expo-router';

import { useThemeEditor } from '@/hooks/useThemeEditor';
import { ColorPicker } from '@/components/common/ColorPicker';
import { DensityMode } from '@/theme/spacing';
import { FontScale } from '@/theme/typography';
import { presetThemes } from '@/theme/colors';

const PRESET_NAMES = {
  uniarr: 'UniArr',
  netflix: 'Netflix',
  plex: 'Plex',
  jellyfin: 'Jellyfin',
  spotify: 'Spotify',
  youtube: 'YouTube',
};

export default function ThemeEditorScreen() {
  const theme = useTheme();
  const {
    config,
    updateConfig,
    resetToDefaults,
    previewTheme,
    saveTheme,
    isLoading,
  } = useThemeEditor();

  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  const handlePresetChange = (preset: keyof typeof presetThemes) => {
    updateConfig({ preset, customColors: undefined });
  };

  const handleFontScaleChange = (fontScale: FontScale) => {
    updateConfig({ fontScale });
  };

  const handleDensityChange = (densityMode: DensityMode) => {
    updateConfig({ densityMode });
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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading theme editor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.section}>
        <Card.Title title="Theme Presets" />
        <Card.Content>
          <View style={styles.presetGrid}>
            {Object.entries(presetThemes).map(([key, scheme]) => (
              <Chip
                key={key}
                selected={config.preset === key}
                onPress={() => handlePresetChange(key as keyof typeof presetThemes)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor:
                      config.preset === key
                        ? theme.colors.primaryContainer
                        : theme.colors.surfaceVariant,
                  },
                ]}
              >
                {PRESET_NAMES[key as keyof typeof PRESET_NAMES]}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Title title="Custom Colors" />
        <Card.Content>
          <List.Section>
            <List.Item
              title="Primary Color"
              description={config.customColors?.primary || 'Using preset color'}
              onPress={() => setShowColorPicker('primary')}
              right={() => (
                <View
                  style={[
                    styles.colorPreview,
                    {
                      backgroundColor: config.customColors?.primary || theme.colors.primary,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                />
              )}
            />
            <List.Item
              title="Secondary Color"
              description={config.customColors?.secondary || 'Using preset color'}
              onPress={() => setShowColorPicker('secondary')}
              right={() => (
                <View
                  style={[
                    styles.colorPreview,
                    {
                      backgroundColor: config.customColors?.secondary || theme.colors.secondary,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                />
              )}
            />
            <List.Item
              title="Background Color"
              description={config.customColors?.background || 'Using preset color'}
              onPress={() => setShowColorPicker('background')}
              right={() => (
                <View
                  style={[
                    styles.colorPreview,
                    {
                      backgroundColor: config.customColors?.background || theme.colors.background,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                />
              )}
            />
          </List.Section>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Title title="Typography" />
        <Card.Content>
          <SegmentedButtons
            value={config.fontScale}
            onValueChange={handleFontScaleChange}
            buttons={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
              { value: 'extra-large', label: 'Extra Large' },
            ]}
          />
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Title title="Density" />
        <Card.Content>
          <SegmentedButtons
            value={config.densityMode}
            onValueChange={handleDensityChange}
            buttons={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Title title="Poster Style" />
        <Card.Content>
          <List.Section>
            <List.Item
              title="Border Radius"
              description={`${config.posterStyle.borderRadius}px`}
              right={() => (
                <TextInput
                  value={config.posterStyle.borderRadius.toString()}
                  onChangeText={(text) => handlePosterStyleChange('borderRadius', parseInt(text) || 0)}
                  style={[
                    styles.numberInput,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      color: theme.colors.onSurface,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                  keyboardType="numeric"
                  maxLength={2}
                />
              )}
            />
            <List.Item
              title="Shadow Opacity"
              description={`${config.posterStyle.shadowOpacity}`}
              right={() => (
                <TextInput
                  value={config.posterStyle.shadowOpacity.toString()}
                  onChangeText={(text) => handlePosterStyleChange('shadowOpacity', parseFloat(text) || 0)}
                  style={[
                    styles.numberInput,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      color: theme.colors.onSurface,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  maxLength={4}
                />
              )}
            />
            <List.Item
              title="Shadow Radius"
              description={`${config.posterStyle.shadowRadius}px`}
              right={() => (
                <TextInput
                  value={config.posterStyle.shadowRadius.toString()}
                  onChangeText={(text) => handlePosterStyleChange('shadowRadius', parseInt(text) || 0)}
                  style={[
                    styles.numberInput,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      color: theme.colors.onSurface,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                  keyboardType="numeric"
                  maxLength={2}
                />
              )}
            />
          </List.Section>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Title title="Preview" />
        <Card.Content>
          <View
            style={[
              styles.previewContainer,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <PaperProvider theme={previewTheme}>
              <View
                style={[
                  styles.previewCard,
                  {
                    borderRadius: config.posterStyle.borderRadius,
                    backgroundColor: previewTheme.colors.surfaceVariant,
                  },
                ]}
              >
                <Text variant="titleMedium">Sample Title</Text>
                <Text variant="bodyMedium" style={{ opacity: 0.7, marginBottom: 12 }}>
                  Sample subtitle text
                </Text>
                <Text variant="bodySmall">
                  This is how your content will look with the current theme settings.
                </Text>
              </View>
            </PaperProvider>
          </View>
        </Card.Content>
      </Card>

      <View style={[styles.actions, { borderTopColor: theme.colors.outlineVariant }]}>
        <Button mode="outlined" onPress={handleReset} style={styles.actionButton}>
          Reset to Defaults
        </Button>
        <Button mode="contained" onPress={handleSave} style={styles.actionButton}>
          Save Theme
        </Button>
      </View>

      <Portal>
        <ColorPicker
          visible={showColorPicker !== null}
          onDismiss={() => setShowColorPicker(null)}
          onColorSelected={(color) => {
            if (showColorPicker) {
              handleColorChange(showColorPicker, color);
              setShowColorPicker(null);
            }
          }}
          initialColor={
            showColorPicker && config.customColors?.[showColorPicker as keyof typeof config.customColors]
              ? config.customColors[showColorPicker as keyof typeof config.customColors]!
              : (typeof theme.colors[showColorPicker as keyof typeof theme.colors] === 'string'
                  ? theme.colors[showColorPicker as keyof typeof theme.colors] as string
                  : '#000000')
          }
        />
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    margin: 4,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  numberInput: {
    width: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
  },
  previewContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewCard: {
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});
