import React from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  FadeOutLeft,
  FadeOutRight,
  Layout,
  SlideInDown,
  SlideInUp,
  SlideInLeft,
  SlideInRight,
  SlideOutDown,
  SlideOutUp,
  SlideOutLeft,
  SlideOutRight,
  LinearTransition,
  SequencedTransition,
  FadingTransition,
  JumpingTransition,
  CurvedTransition,
  EntryExitTransition,
} from 'react-native-reanimated';

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
  entering = FadeIn,
  exiting = FadeOut,
  layout = Layout,
}) => {
  return (
    <Animated.View
      style={style}
      entering={entering}
      exiting={exiting}
      layout={layout}
    >
      {children}
    </Animated.View>
  );
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
  return (
    <Animated.View
      style={style}
      entering={FadeInUp.delay(delay).springify()}
      exiting={FadeOutDown.springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
};

interface AnimatedHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  children,
  style,
}) => {
  return (
    <Animated.View
      style={style}
      entering={SlideInDown.springify()}
      exiting={SlideOutUp.springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
};

interface AnimatedListProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  style,
}) => {
  return (
    <Animated.View
      style={style}
      entering={FadeIn.delay(200).springify()}
      exiting={FadeOut.springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
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
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.delay(delay).springify()}
      exiting={FadeOutUp.springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
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
  // Calculate delay based on index for staggered animation
  const delay = Math.min(index * 50, 300); // Max 300ms delay

  return (
    <Animated.View
      style={style}
      entering={FadeInUp.delay(delay).springify()}
      exiting={FadeOutDown.springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
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
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.delay(delay).springify()}
      exiting={FadeOutUp.springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
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
  return (
    <Animated.View
      style={style}
      entering={FadeIn.delay(200).springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
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
  return (
    <Animated.View
      style={style}
      entering={FadeInRight.springify()}
      exiting={FadeOutLeft.springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.View>
  );
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
    <Animated.View
      style={style}
      entering={FadeIn.springify()}
      layout={Layout.springify()}
    >
      <Animated.View
        entering={FadeInUp.springify()}
        layout={Layout.springify()}
      >
        {children}
      </Animated.View>
    </Animated.View>
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
    <Animated.ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      entering={FadeIn.delay(100).springify()}
      layout={Layout.springify()}
    >
      {children}
    </Animated.ScrollView>
  );
};
