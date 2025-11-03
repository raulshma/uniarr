import { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme, Card, IconButton, Button } from "react-native-paper";

import { AnimatedListItem } from "@/components/common";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";

interface SettingsCategoryItem {
  title: string;
  route: string;
  icon: string;
}

interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  items: SettingsCategoryItem[];
}

interface SettingsCategoryTileProps {
  category: SettingsCategory;
  index: number;
  totalItems: number;
  animated: boolean;
  onNavigateToSetting: (route: string) => void;
}

const SettingsCategoryTile: React.FC<SettingsCategoryTileProps> = ({
  category,
  index,
  totalItems,
  animated,
  onNavigateToSetting,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.xxl,
    },
    cardContent: {
      padding: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.xl,
      backgroundColor: theme.colors.secondaryContainer,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    categoryInfo: {
      flex: 1,
    },
    categoryName: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
    },
    categoryDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: 16,
      marginTop: 2,
    },
    itemsContainer: {
      marginTop: spacing.sm,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginVertical: 1,
      borderRadius: borderRadius.lg,
    },
    itemIcon: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.md,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    itemInfo: {
      flex: 1,
    },
    itemTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
    },
    actionButton: {
      marginLeft: spacing.xs,
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
          <View style={styles.header}>
            <View style={styles.categoryIcon}>
              <IconButton
                icon={category.icon}
                size={20}
                iconColor={theme.colors.onSecondaryContainer}
              />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.title}</Text>
              <Text style={styles.categoryDescription}>
                {category.description}
              </Text>
            </View>
          </View>

          <View style={styles.itemsContainer}>
            {category.items.map((item, itemIndex) => (
              <View key={item.route} style={styles.itemRow}>
                <View style={styles.itemIcon}>
                  <IconButton
                    icon={item.icon}
                    size={16}
                    iconColor={theme.colors.onSurfaceVariant}
                  />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                </View>
                <Button
                  mode="text"
                  compact
                  onPress={() => onNavigateToSetting(item.route)}
                  style={styles.actionButton}
                >
                  Open
                </Button>
              </View>
            ))}
          </View>
        </View>
      </Card>
    </AnimatedListItem>
  );
};

export default memo(SettingsCategoryTile);
