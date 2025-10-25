import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import { useTheme, Icon } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { EmptyState } from "@/components/common/EmptyState";
import { logger } from "@/services/logger/LoggerService";

export type ErrorBoundaryFallbackProps = {
  error: Error;
  reset: () => void;
};

export type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: readonly unknown[];
  context?: Record<string, unknown>;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

const areResetKeysEqual = (
  currentKeys: readonly unknown[] | undefined,
  previousKeys: readonly unknown[] | undefined,
): boolean => {
  if (currentKeys === previousKeys) {
    return true;
  }

  if (
    !currentKeys ||
    !previousKeys ||
    currentKeys.length !== previousKeys.length
  ) {
    return false;
  }

  return currentKeys.every((value, index) =>
    Object.is(value, previousKeys[index]),
  );
};

const DefaultFallback = ({ error, reset }: ErrorBoundaryFallbackProps) => {
  const theme = useTheme<AppTheme>();
  const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

  const description =
    isDevelopment && error.message
      ? error.message
      : "Please try again in a moment.";

  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }],
    };
  });

  React.useEffect(() => {
    rotation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(withTiming(10, { duration: 100 }), 5, true),
      withTiming(0, { duration: 50 }),
    );
  }, [rotation]);

  const AnimatedIcon = () => (
    <Animated.View style={animatedStyle}>
      <Icon
        source="alert-circle-outline"
        size={48}
        color={theme.colors.onSurfaceVariant}
      />
    </Animated.View>
  );

  return (
    <Animated.View
      entering={FadeInUp.duration(400).springify()}
      style={[
        styles.fallbackContainer,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Animated.View entering={FadeIn.duration(300).delay(200)}>
        <EmptyState
          title="Something went wrong"
          description={description}
          customIcon={<AnimatedIcon />}
          actionLabel="Try again"
          onActionPress={reset}
        >
          {isDevelopment && error.stack ? (
            <Animated.Text
              entering={FadeIn.duration(300).delay(400)}
              style={{
                marginTop: theme.custom.spacing.sm,
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                fontSize: theme.custom.typography.bodySmall.fontSize,
                fontFamily: theme.custom.typography.bodySmall.fontFamily,
                lineHeight: theme.custom.typography.bodySmall.lineHeight,
              }}
            >
              {error.stack.split("\n").slice(0, 2).join("\n")}
            </Animated.Text>
          ) : null}
        </EmptyState>
      </Animated.View>
    </Animated.View>
  );
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const { onError, context } = this.props;

    void logger.error("Unhandled UI error captured", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      context,
    });

    if (onError) {
      onError(error, info);
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (
      this.state.hasError &&
      !areResetKeysEqual(resetKeys, prevProps.resetKeys)
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private renderFallback(): ReactNode {
    const { fallback } = this.props;
    const { error } = this.state;
    const currentError = error ?? new Error("Unknown error");
    const reset = this.resetErrorBoundary;

    if (typeof fallback === "function") {
      return fallback({ error: currentError, reset });
    }

    if (fallback) {
      return fallback;
    }

    return <DefaultFallback error={currentError} reset={reset} />;
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
  },
});
