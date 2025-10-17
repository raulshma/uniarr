import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  type ViewStyle,
  type LayoutChangeEvent,
} from "react-native";
import { FlashList } from "@shopify/flash-list";

import { useResponsiveGrid } from "@/hooks/useResponsiveLayout";

export interface ResponsiveGridProps<T> {
  /**
   * Data array to render
   */
  data: T[];
  /**
   * Render item function
   */
  renderItem: (item: T, index: number) => React.ReactNode;
  /**
   * Key extractor function
   */
  keyExtractor: (item: T, index: number) => string;
  /**
   * Desired number of columns (auto-calculated if not provided)
   */
  numColumns?: number;
  /**
   * Fixed item width (calculated if not provided)
   */
  itemWidth?: number;
  /**
   * Spacing between items
   */
  spacing?: number;
  /**
   * Content container style
   */
  contentContainerStyle?: ViewStyle;
  /**
   * List header component
   */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  /**
   * List footer component
   */
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  /**
   * Empty list component
   */
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  /**
   * Whether to show horizontal scroll indicators
   */
  showsHorizontalScrollIndicator?: boolean;
  /**
   * Whether to show vertical scroll indicators
   */
  showsVerticalScrollIndicator?: boolean;
  /**
   * On refresh function
   */
  onRefresh?: () => void | Promise<void>;
  /**
   * Whether list is currently refreshing
   */
  refreshing?: boolean;
  /**
   * On end reached function
   */
  onEndReached?: () => void;
  /**
   * Distance from end before triggering onEndReached
   */
  onEndReachedThreshold?: number;
}

function ResponsiveGridComponent<T>({
  data,
  renderItem,
  keyExtractor,
  numColumns,
  itemWidth,
  spacing,
  contentContainerStyle,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  showsHorizontalScrollIndicator = false,
  showsVerticalScrollIndicator = true,
  onRefresh,
  refreshing = false,
  onEndReached,
  onEndReachedThreshold = 0.5,
}: ResponsiveGridProps<T>) {
  const {
    calculateGridColumns,
    calculateItemWidth,
    spacing: defaultSpacing,
  } = useResponsiveGrid();
  const [containerWidth, setContainerWidth] = React.useState(0);

  // Use medium spacing as default fallback
  const fallbackSpacing =
    typeof defaultSpacing === "object" ? defaultSpacing.medium : defaultSpacing;

  // Calculate grid configuration
  const gridConfig = useMemo(() => {
    const actualSpacing = spacing ?? fallbackSpacing;

    if (numColumns) {
      // Fixed number of columns
      const calculatedItemWidth = calculateItemWidth(numColumns, actualSpacing);
      return {
        numColumns,
        itemWidth: itemWidth ?? calculatedItemWidth,
        spacing: actualSpacing,
      };
    }

    if (itemWidth) {
      // Fixed item width
      const calculatedColumns = calculateGridColumns(itemWidth, actualSpacing);
      return {
        numColumns: calculatedColumns,
        itemWidth,
        spacing: actualSpacing,
      };
    }

    // Auto-calculate based on container width and responsive design
    const responsiveColumns =
      containerWidth > 0
        ? calculateGridColumns(160, actualSpacing) // Default target width
        : 3; // Fallback

    const calculatedItemWidth = calculateItemWidth(
      responsiveColumns,
      actualSpacing,
    );

    return {
      numColumns: responsiveColumns,
      itemWidth: calculatedItemWidth,
      spacing: actualSpacing,
    };
  }, [
    numColumns,
    itemWidth,
    spacing,
    calculateGridColumns,
    calculateItemWidth,
    fallbackSpacing,
    containerWidth,
  ]);

  // Handle container layout
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  }, []);

  // Group items into rows for FlashList
  const groupedData = useMemo(() => {
    const rows: T[][] = [];
    for (let i = 0; i < data.length; i += gridConfig.numColumns) {
      rows.push(data.slice(i, i + gridConfig.numColumns));
    }
    return rows;
  }, [data, gridConfig.numColumns]);

  // Render row with multiple items
  const renderRow = React.useCallback(
    (info: { item: T[]; index: number }) => {
      const { item: row, index } = info;

      return (
        <View style={styles.row}>
          {row.map((rowData, itemIndex) => {
            const globalIndex = index * gridConfig.numColumns + itemIndex;
            return (
              <View
                key={keyExtractor(rowData, globalIndex)}
                style={[
                  styles.gridItem,
                  {
                    width: gridConfig.itemWidth,
                    marginRight:
                      itemIndex < row.length - 1 ? gridConfig.spacing : 0,
                  },
                ]}
              >
                {renderItem(rowData, globalIndex)}
              </View>
            );
          })}
        </View>
      );
    },
    [gridConfig, keyExtractor, renderItem],
  );

  const getItemType = React.useCallback((item: T[]) => {
    return "row";
  }, []);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <FlashList
        data={groupedData}
        renderItem={renderRow}
        getItemType={getItemType}
        keyExtractor={(item, index) => `row-${index}`}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingHorizontal: gridConfig.spacing },
          contentContainerStyle,
        ]}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
      />
    </View>
  );
}

// Export as generic component
export const ResponsiveGrid = ResponsiveGridComponent as <T>(
  props: ResponsiveGridProps<T>,
) => React.ReactElement;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  gridItem: {
    // Item dimensions are set dynamically
  },
});
