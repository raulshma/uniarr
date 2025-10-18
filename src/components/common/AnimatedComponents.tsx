import React from "react";
import { View, ScrollView, Pressable, ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface AnimatedViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AnimatedView: React.FC<AnimatedViewProps> = ({
  children,
  style,
}) => {
  return <View style={style}>{children}</View>;
};

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  style,
  delay = 0,
}) => {
  // Intentionally render plain view to remove entrance/exit animations
  return <View style={style}>{children}</View>;
};

interface AnimatedHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = React.memo(
  ({ children, style }) => {
    return (
      <Animated.View
        style={style}
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(150)}
        // Performance optimizations
        removeClippedSubviews={true}
        collapsable={true}
      >
        {children}
      </Animated.View>
    );
  },
);

interface AnimatedListProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  style,
}) => {
  return <View style={style}>{children}</View>;
};

interface AnimatedFilterProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
}

export const AnimatedFilter: React.FC<AnimatedFilterProps> = ({
  children,
  style,
  delay = 0,
}) => {
  return <View style={style}>{children}</View>;
};

// Staggered animation for list items
interface AnimatedListItemProps {
  children: React.ReactNode;
  style?: ViewStyle;
  index?: number;
  totalItems?: number;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = React.memo(
  ({ children, style, index = 0, totalItems = 1 }) => {
    // Skip animations entirely for performance
    return (
      <View style={style} removeClippedSubviews={true} collapsable={true}>
        {children}
      </View>
    );
  },
);

// Section animation for grouped content
interface AnimatedSectionProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = React.memo(
  ({ children, style, delay = 0 }) => {
    // Skip animations entirely for performance
    return (
      <View style={style} removeClippedSubviews={true} collapsable={true}>
        {children}
      </View>
    );
  },
);

// Progress bar animation
interface AnimatedProgressProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  children,
  style,
}) => {
  return <View style={style}>{children}</View>;
};

// Status indicator animation
interface AnimatedStatusProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AnimatedStatus: React.FC<AnimatedStatusProps> = ({
  children,
  style,
}) => {
  return <View style={style}>{children}</View>;
};

// Button press animation
interface AnimatedPressableProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  onPress,
}) => {
  return (
    <Pressable style={style as any} onPress={onPress}>
      {children}
    </Pressable>
  );
};

// Scroll view with staggered children animation
interface AnimatedScrollViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export const AnimatedScrollView: React.FC<AnimatedScrollViewProps> = ({
  children,
  style,
  contentContainerStyle,
}) => {
  return (
    <ScrollView
      style={style as any}
      contentContainerStyle={contentContainerStyle as any}
    >
      {children}
    </ScrollView>
  );
};
