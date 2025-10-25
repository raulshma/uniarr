import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View, ScrollView, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  LinearTransition,
} from "react-native-reanimated";
import {
  ANIMATION_DURATIONS,
  PERFORMANCE_OPTIMIZATIONS,
  COMPONENT_ANIMATIONS,
} from "@/utils/animations.utils";

interface AnimatedViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  entering?: any;
  exiting?: any;
  layout?: any;
  animated?: boolean;
}

export const AnimatedView: React.FC<AnimatedViewProps> = ({
  children,
  style,
  entering,
  exiting,
  layout,
  animated = true,
}) => {
  if (!animated) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View
      style={style}
      entering={entering}
      exiting={exiting}
      layout={layout}
      {...PERFORMANCE_OPTIMIZATIONS}
    >
      {children}
    </Animated.View>
  );
};

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  animated?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  style,
  delay = 0,
  animated = true,
}) => {
  if (!animated) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View
      style={style}
      entering={COMPONENT_ANIMATIONS.CARD_ENTRANCE(delay)}
      exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
      {...PERFORMANCE_OPTIMIZATIONS}
    >
      {children}
    </Animated.View>
  );
};

interface AnimatedHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = React.memo(
  ({ children, style, animated = true }) => {
    if (!animated) {
      return <View style={style}>{children}</View>;
    }

    return (
      <Animated.View
        style={style}
        entering={FadeIn.duration(ANIMATION_DURATIONS.NORMAL)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
        {...PERFORMANCE_OPTIMIZATIONS}
      >
        {children}
      </Animated.View>
    );
  },
);

interface AnimatedListProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  style,
  animated = true,
}) => {
  if (!animated) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View style={style} {...PERFORMANCE_OPTIMIZATIONS}>
      {children}
    </Animated.View>
  );
};

interface AnimatedFilterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  animated?: boolean;
}

export const AnimatedFilter: React.FC<AnimatedFilterProps> = ({
  children,
  style,
  delay = 0,
  animated = true,
}) => {
  if (!animated) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View
      style={style}
      entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK).delay(delay)}
      exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
      {...PERFORMANCE_OPTIMIZATIONS}
    >
      {children}
    </Animated.View>
  );
};

// Staggered animation for list items
interface AnimatedListItemProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  totalItems?: number;
  staggerDelay?: number;
  animated?: boolean;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = React.memo(
  ({
    children,
    style,
    index = 0,
    totalItems = 1,
    staggerDelay = 50,
    animated = true,
  }) => {
    if (!animated) {
      return (
        <View style={style} {...PERFORMANCE_OPTIMIZATIONS}>
          {children}
        </View>
      );
    }

    return (
      <Animated.View
        style={style}
        entering={COMPONENT_ANIMATIONS.LIST_ITEM_STAGGER(index, staggerDelay)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
        {...PERFORMANCE_OPTIMIZATIONS}
      >
        {children}
      </Animated.View>
    );
  },
);

// Section animation for grouped content
interface AnimatedSectionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  animated?: boolean;
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = React.memo(
  ({ children, style, delay = 0, animated = true }) => {
    if (!animated) {
      return (
        <View style={style} {...PERFORMANCE_OPTIMIZATIONS}>
          {children}
        </View>
      );
    }

    return (
      <Animated.View
        style={style}
        entering={COMPONENT_ANIMATIONS.SECTION_ENTRANCE(delay)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
        {...PERFORMANCE_OPTIMIZATIONS}
      >
        {children}
      </Animated.View>
    );
  },
);

// Progress bar animation
interface AnimatedProgressProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  children,
  style,
  animated = true,
}) => {
  if (!animated) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View
      style={style}
      layout={LinearTransition.springify()}
      {...PERFORMANCE_OPTIMIZATIONS}
    >
      {children}
    </Animated.View>
  );
};

// Status indicator animation
interface AnimatedStatusProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export const AnimatedStatus: React.FC<AnimatedStatusProps> = ({
  children,
  style,
  animated = true,
}) => {
  if (!animated) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View
      style={style}
      entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
      exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
      {...PERFORMANCE_OPTIMIZATIONS}
    >
      {children}
    </Animated.View>
  );
};

// Button press animation
interface AnimatedPressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  animated?: boolean;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  onPress,
  animated = true,
}) => {
  return (
    <Pressable style={style as any} onPress={onPress}>
      {animated ? (
        <Animated.View {...PERFORMANCE_OPTIMIZATIONS}>{children}</Animated.View>
      ) : (
        children
      )}
    </Pressable>
  );
};

// Scroll view with staggered children animation
interface AnimatedScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export const AnimatedScrollView: React.FC<AnimatedScrollViewProps> = ({
  children,
  style,
  contentContainerStyle,
  animated = true,
}) => {
  return (
    <ScrollView
      style={style as any}
      contentContainerStyle={contentContainerStyle as any}
      scrollEventThrottle={16}
    >
      {children}
    </ScrollView>
  );
};

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  transitionType?: "slide" | "fade" | "none";
  duration?: number;
  animated?: boolean;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  style,
  transitionType = "fade",
  duration = ANIMATION_DURATIONS.NORMAL,
  animated = true,
}) => {
  if (!animated || transitionType === "none") {
    return <View style={style}>{children}</View>;
  }

  let entering;
  let exiting;

  switch (transitionType) {
    case "slide":
      entering = SlideInUp.duration(duration).springify();
      exiting = SlideOutDown.duration(duration - 50).springify();
      break;
    case "fade":
    default:
      entering = FadeIn.duration(duration);
      exiting = FadeOut.duration(duration - 50);
      break;
  }

  return (
    <Animated.View
      style={style}
      entering={entering}
      exiting={exiting}
      {...PERFORMANCE_OPTIMIZATIONS}
    >
      {children}
    </Animated.View>
  );
};
