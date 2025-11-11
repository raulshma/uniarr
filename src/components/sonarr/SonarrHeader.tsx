import React, { useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { SegmentedButtons, useTheme } from "react-native-paper";

import { TabHeader, type TabHeaderAction } from "@/components/common/TabHeader";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

type SonarrNavbarProps = {
  serviceName?: string;
  activeTab: "series" | "queue";
  onBackPress: () => void;
  onNavigateToSeries: () => void;
  onNavigateToQueue: () => void;
  onAddSeries?: () => void;
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    tabHeader: {
      paddingHorizontal: spacing.lg,
    },
    segmentContainer: {
      paddingHorizontal: spacing.lg,
    },
    segmentedButtons: {
      borderRadius: spacing.lg,
      backgroundColor: theme.colors.elevation.level1,
    },
    segmentButton: {
      flex: 1,
    },
  });

export const SonarrHeader: React.FC<SonarrNavbarProps> = ({
  serviceName,
  activeTab,
  onBackPress,
  onNavigateToSeries,
  onNavigateToQueue,
  onAddSeries,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (value === activeTab) {
        return;
      }

      if (value === "series") {
        onNavigateToSeries();
      } else if (value === "queue") {
        onNavigateToQueue();
      }
    },
    [activeTab, onNavigateToQueue, onNavigateToSeries],
  );

  const rightAction = useMemo<TabHeaderAction | undefined>(() => {
    if (activeTab !== "series" || !onAddSeries) {
      return undefined;
    }

    return {
      icon: "plus",
      onPress: onAddSeries,
      accessibilityLabel: "Add series",
    };
  }, [activeTab, onAddSeries]);

  return (
    <View style={styles.container}>
      <TabHeader
        showBackButton
        onBackPress={onBackPress}
        showTitle
        title={serviceName ?? "Sonarr"}
        rightAction={rightAction}
        style={styles.tabHeader}
      />
      <View style={styles.segmentContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={handleTabChange}
          buttons={[
            {
              value: "series",
              label: "Library",
              icon: "television-classic",
              style: styles.segmentButton,
            },
            {
              value: "queue",
              label: "Queue",
              icon: "download",
              style: styles.segmentButton,
            },
          ]}
          density="small"
          style={styles.segmentedButtons}
        />
      </View>
    </View>
  );
};
