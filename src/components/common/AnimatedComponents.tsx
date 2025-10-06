import React from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  Layout,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutUp,
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
