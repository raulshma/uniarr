import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import { EmptyState } from '@/components/common/EmptyState';
import { logger } from '@/services/logger/LoggerService';

export type ErrorBoundaryFallbackProps = {
  error: Error;
  reset: () => void;
};

export type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: ReadonlyArray<unknown>;
  context?: Record<string, unknown>;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

const areResetKeysEqual = (
  currentKeys: ReadonlyArray<unknown> | undefined,
  previousKeys: ReadonlyArray<unknown> | undefined,
): boolean => {
  if (currentKeys === previousKeys) {
    return true;
  }

  if (!currentKeys || !previousKeys || currentKeys.length !== previousKeys.length) {
    return false;
  }

  return currentKeys.every((value, index) => Object.is(value, previousKeys[index]));
};

const DefaultFallback = ({ error, reset }: ErrorBoundaryFallbackProps) => {
  const theme = useTheme<AppTheme>();
  const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

  const description = isDevelopment && error.message ? error.message : 'Please try again in a moment.';

  return (
    <View style={[styles.fallbackContainer, { backgroundColor: theme.colors.background }]}> 
      <EmptyState
        title="Something went wrong"
        description={description}
        icon="alert-circle-outline"
        actionLabel="Try again"
        onActionPress={reset}
      >
        {isDevelopment && error.stack ? (
          <Text
            variant="bodySmall"
            style={{
              marginTop: theme.custom.spacing.sm,
              color: theme.colors.onSurfaceVariant,
              textAlign: 'center',
            }}
          >
            {error.stack.split('\n').slice(0, 2).join('\n')}
          </Text>
        ) : null}
      </EmptyState>
    </View>
  );
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { onError, context } = this.props;

    void logger.error('Unhandled UI error captured', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      context,
    });

    if (onError) {
      onError(error, info);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (this.state.hasError && !areResetKeysEqual(resetKeys, prevProps.resetKeys)) {
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
    const currentError = error ?? new Error('Unknown error');
    const reset = this.resetErrorBoundary;

    if (typeof fallback === 'function') {
      return fallback({ error: currentError, reset });
    }

    if (fallback) {
      return fallback;
    }

    return <DefaultFallback error={currentError} reset={reset} />;
  }

  render(): ReactNode {
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
