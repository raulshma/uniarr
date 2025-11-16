import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";

import { logger } from "@/services/logger/LoggerService";

interface ChatErrorBoundaryProps {
  children: ReactNode;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ChatErrorBoundaryInner extends Component<
  ChatErrorBoundaryProps & { theme: MD3Theme },
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps & { theme: MD3Theme }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    void logger.error("Chat UI crashed", {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const { theme, children } = this.props;

    if (!hasError) {
      return children;
    }

    const styles = createStyles(theme);

    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.description}>
          {error?.message ??
            "The chat interface encountered an unexpected issue."}
        </Text>
        <Pressable
          style={styles.retryButton}
          accessibilityRole="button"
          accessibilityLabel="Retry loading chat"
          onPress={this.handleRetry}
        >
          <Text style={styles.retryLabel}>Try Again</Text>
        </Pressable>
      </View>
    );
  }
}

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 20,
      fontWeight: "600",
      marginBottom: 12,
      color: theme.colors.onSurface,
    },
    description: {
      fontSize: 14,
      marginBottom: 20,
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
    },
    retryLabel: {
      color: theme.colors.onPrimary,
      fontWeight: "600",
      fontSize: 15,
    },
  });

export const ChatErrorBoundary: React.FC<ChatErrorBoundaryProps> = ({
  children,
}) => {
  const theme = useTheme<MD3Theme>();
  return (
    <ChatErrorBoundaryInner theme={theme}>{children}</ChatErrorBoundaryInner>
  );
};
