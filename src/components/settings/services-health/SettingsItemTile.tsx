import { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme, Card, IconButton, Switch } from "react-native-paper";

import { AnimatedListItem } from "@/components/common";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";

interface SettingItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  isActive: boolean;
  toggleAction: () => void;
}

interface SettingsItemTileProps {
  setting: SettingItem;
  index: number;
  totalItems: number;
  animated: boolean;
}

const SettingsItemTile: React.FC<SettingsItemTileProps> = ({
  setting,
  index,
  totalItems,
  animated,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.xxl,
      opacity: setting.isActive ? 1 : 0.7,
    },
    cardContent: {
      padding: spacing.sm,
    },
    contentRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusSection: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: spacing.md,
    },
    settingIcon: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.lg,
      backgroundColor: setting.isActive
        ? theme.colors.secondaryContainer
        : theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    settingInfo: {
      flex: 1,
    },
    settingName: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
    },
    settingDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: 14,
      marginTop: 1,
    },
    statusText: {
      color: setting.isActive
        ? theme.colors.primary
        : theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      fontWeight: "500" as any,
      marginRight: spacing.xs,
    },
  });

  return (
    <AnimatedListItem
      index={index}
      totalItems={totalItems}
      animated={animated}
      style={styles.container}
    >
      <Card style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.contentRow}>
            <View style={styles.settingIcon}>
              <IconButton
                icon={setting.icon}
                size={16}
                iconColor={
                  setting.isActive
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurfaceVariant
                }
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>{setting.title}</Text>
              <Text style={styles.settingDescription}>
                {setting.description}
              </Text>
            </View>
            <View style={styles.statusSection}>
              <Text style={styles.statusText}>
                {setting.isActive ? "Active" : "Inactive"}
              </Text>
              <Switch
                value={setting.isActive}
                onValueChange={setting.toggleAction}
                color={theme.colors.primary}
              />
            </View>
          </View>
        </View>
      </Card>
    </AnimatedListItem>
  );
};

export default memo(SettingsItemTile);
