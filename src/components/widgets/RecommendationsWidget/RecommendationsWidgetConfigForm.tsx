import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Switch, useTheme } from "react-native-paper";
import Slider from "@react-native-community/slider";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { Widget } from "@/services/widgets/WidgetService";
import { widgetService } from "@/services/widgets/WidgetService";

interface RecommendationsWidgetConfigFormProps {
  widget: Widget;
  onConfigChange?: (config: any) => void;
}

const RecommendationsWidgetConfigForm: React.FC<
  RecommendationsWidgetConfigFormProps
> = ({ widget, onConfigChange }) => {
  const theme = useTheme<AppTheme>();
  const [limit, setLimit] = useState(3);
  const [includeHiddenGems, setIncludeHiddenGems] = useState(true);

  useEffect(() => {
    // Load current configuration
    const loadConfig = async () => {
      const widgetConfig = await widgetService.getWidget(widget.id);
      if (widgetConfig?.config) {
        setLimit(widgetConfig.config.limit || 3);
        setIncludeHiddenGems(widgetConfig.config.includeHiddenGems !== false);
      }
    };
    void loadConfig();
  }, [widget.id]);

  const handleLimitChange = async (value: number) => {
    const newLimit = Math.round(value);
    setLimit(newLimit);

    const config = {
      limit: newLimit,
      includeHiddenGems,
    };

    await widgetService.updateWidget(widget.id, { config });
    onConfigChange?.(config);
  };

  const handleHiddenGemsToggle = async () => {
    const newValue = !includeHiddenGems;
    setIncludeHiddenGems(newValue);

    const config = {
      limit,
      includeHiddenGems: newValue,
    };

    await widgetService.updateWidget(widget.id, { config });
    onConfigChange?.(config);
  };

  const styles = StyleSheet.create({
    container: {
      padding: spacing.md,
      gap: spacing.lg,
    },
    section: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    description: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: spacing.xxs,
    },
    sliderContainer: {
      marginTop: spacing.sm,
    },
    sliderValue: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: "600",
      textAlign: "center",
      marginTop: spacing.xs,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Number of Recommendations</Text>
        <Text style={styles.description}>
          How many recommendations to display in the widget
        </Text>
        <View style={styles.sliderContainer}>
          <Slider
            value={limit}
            onValueChange={handleLimitChange}
            minimumValue={1}
            maximumValue={5}
            step={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.surfaceVariant}
            thumbTintColor={theme.colors.primary}
          />
          <Text style={styles.sliderValue}>{limit} recommendations</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Include Hidden Gems</Text>
            <Text style={styles.description}>
              Show lesser-known content that matches your taste
            </Text>
          </View>
          <Switch
            value={includeHiddenGems}
            onValueChange={handleHiddenGemsToggle}
            color={theme.colors.primary}
          />
        </View>
      </View>
    </View>
  );
};

export default RecommendationsWidgetConfigForm;
