import React from "react";
import { View, StyleSheet } from "react-native";

import MediaCardSkeleton from "./MediaCardSkeleton";
import ServiceCardSkeleton from "./ServiceCardSkeleton";

export interface ListSkeletonProps {
  /**
   * Type of list skeleton to show
   */
  type: "media-grid" | "media-list" | "services" | "custom";
  /**
   * Number of items to show
   * @default 6
   */
  itemCount?: number;
  /**
   * Number of columns for grid layouts
   * @default 3
   */
  columns?: number;
  /**
   * Custom skeleton component for 'custom' type
   */
  customSkeleton?: React.ComponentType<any>;
  /**
   * Props to pass to custom skeleton component
   */
  customSkeletonProps?: any;
}

const ListSkeleton: React.FC<ListSkeletonProps> = ({
  type,
  itemCount = 6,
  columns = 3,
  customSkeleton: CustomSkeleton,
  customSkeletonProps,
}) => {
  const renderSkeletonItem = (index: number) => {
    switch (type) {
      case "media-grid":
        return (
          <MediaCardSkeleton key={index} size="medium" showMetadata={true} />
        );

      case "media-list":
        return (
          <View key={index} style={listStyles.listItem}>
            <MediaCardSkeleton
              size="small"
              showMetadata={true}
              style={listStyles.listPoster}
            />
            <View style={listStyles.listContent}>
              <MediaCardSkeleton
                size="large"
                showMetadata={true}
                style={listStyles.listDetails}
              />
            </View>
          </View>
        );

      case "services":
        return <ServiceCardSkeleton key={index} extended={false} />;

      case "custom":
        return CustomSkeleton ? (
          <CustomSkeleton key={index} {...customSkeletonProps} />
        ) : null;

      default:
        return null;
    }
  };

  const getContainerStyle = () => {
    switch (type) {
      case "media-grid":
        return [gridStyles.container, { gap: 16 }];
      case "media-list":
        return listStyles.container;
      case "services":
        return servicesStyles.container;
      case "custom":
        return customSkeletonProps?.containerStyle;
      default:
        return null;
    }
  };

  return (
    <View style={getContainerStyle()}>
      {Array.from({ length: itemCount }, (_, index) =>
        renderSkeletonItem(index),
      )}
    </View>
  );
};

const gridStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
});

const listStyles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
  },
  listItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  listPoster: {
    flexShrink: 0,
  },
  listContent: {
    flex: 1,
  },
  listDetails: {
    width: "100%",
  },
});

const servicesStyles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
  },
});

export default ListSkeleton;
