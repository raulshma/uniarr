import React from 'react';
import { View, ScrollView, Pressable, ViewStyle, ScrollViewProps, PressableProps } from 'react-native';

interface AnimatedViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  entering?: any;
  exiting?: any;
  layout?: any;
}

export const AnimatedView: React.FC<AnimatedViewProps> = ({
  children,
  style,
  // kept for compatibility but intentionally ignored to remove animations
  entering,
  exiting,
  layout,
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

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  children,
  style,
}) => {
  return <View style={style}>{children}</View>;
};

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

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  style,
  index = 0,
  totalItems = 1,
}) => {
  // Preserve API but render without animation so list renders instantly
  return <View style={style}>{children}</View>;
};

// Section animation for grouped content
interface AnimatedSectionProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  style,
  delay = 0,
}) => {
  return <View style={style}>{children}</View>;
};

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
    <ScrollView style={style as any} contentContainerStyle={contentContainerStyle as any}>
      {children}
    </ScrollView>
  );
};
