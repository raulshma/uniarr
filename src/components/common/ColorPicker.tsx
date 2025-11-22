import React, { useState } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { Button, Text, TextInput, useTheme, Portal } from "react-native-paper";
import { BottomDrawer } from "@/components/common";

interface ColorPickerProps {
  visible: boolean;
  onDismiss: () => void;
  onColorSelected: (color: string) => void;
  initialColor: string;
}

const PRESET_COLORS = [
  "#000000",
  "#FFFFFF",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#FFC0CB",
  "#A52A2A",
  "#808080",
  "#C0C0C0",
  "#800000",
  "#808000",
  "#008000",
  "#008080",
  "#000080",
  "#FF6347",
  "#FFD700",
  "#90EE90",
  "#ADD8E6",
  "#DDA0DD",
  "#F0E68C",
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  visible,
  onDismiss,
  onColorSelected,
  initialColor,
}) => {
  const theme = useTheme();
  const [customColor, setCustomColor] = useState(initialColor.replace("#", ""));

  const handleColorSelect = (color: string) => {
    onColorSelected(color);
  };

  const handleCustomColorSubmit = () => {
    const hexColor = `#${customColor}`;
    if (/^#[0-9A-F]{6}$/i.test(hexColor)) {
      onColorSelected(hexColor);
    }
  };

  return (
    <Portal>
      <BottomDrawer
        visible={visible}
        onDismiss={onDismiss}
        title="Choose Color"
        maxHeight="75%"
      >
        <View style={styles.content}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Preset Colors
          </Text>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  {
                    backgroundColor: color,
                    borderWidth: initialColor === color ? 3 : 1,
                    borderColor:
                      initialColor === color
                        ? theme.colors.primary
                        : theme.colors.outlineVariant,
                  },
                ]}
                onPress={() => handleColorSelect(color)}
              />
            ))}
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Custom Color
          </Text>
          <View style={styles.customColorContainer}>
            <View style={styles.customColorPreview}>
              <View
                style={[
                  styles.colorPreview,
                  { backgroundColor: `#${customColor}` },
                ]}
              />
              <Text variant="bodyMedium" style={styles.colorText}>
                #{customColor.toUpperCase()}
              </Text>
            </View>
            <TextInput
              value={customColor}
              onChangeText={setCustomColor}
              placeholder="Enter hex color (e.g., FF0000)"
              style={[
                styles.hexInput,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
              maxLength={6}
              autoCapitalize="characters"
            />
            <Button mode="contained" onPress={handleCustomColorSubmit}>
              Use Color
            </Button>
          </View>

          <View style={styles.footer}>
            <Button
              mode="contained"
              onPress={onDismiss}
              style={styles.doneButton}
            >
              Done
            </Button>
          </View>
        </View>
      </BottomDrawer>
    </Portal>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    marginTop: 8,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  customColorContainer: {
    gap: 16,
  },
  customColorPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  colorText: {
    fontFamily: "monospace",
  },
  hexInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "monospace",
  },
  footer: {
    marginTop: 24,
  },
  doneButton: {
    width: "100%",
  },
});
