import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Text, TextInput, useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitSearch?: () => void;
  placeholder?: string;
  isStreaming?: boolean;
  containerStyle?: ViewStyle;
  onClear?: () => void;
}

/**
 * SearchInput component with AI-powered suggestions
 * Displays streaming interpretation results in real-time
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search naturally: "anime from 2020 with romance"',
  onSubmitSearch,
  isStreaming = false,
  containerStyle,
  onClear,
}: SearchInputProps) {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: theme.colors.background,
        },
        inputContainer: {
          marginBottom: spacing.md,
        },
        input: {
          height: theme.custom.sizes.touchSizes.md,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: borderRadius.lg,
          fontSize: 16,
          paddingHorizontal: spacing.lg,
        },
        streamingIndicator: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        streamingText: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
        },
      }),
    [theme],
  );

  const handleClearInput = useCallback(() => {
    onClear?.();
    onChangeText("");
  }, [onChangeText, onClear]);

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Search Input */}
      <View style={styles.inputContainer}>
        <TextInput
          mode="flat"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          contentStyle={{
            backgroundColor: "transparent",
          }}
          underlineStyle={{ display: "none" }}
          left={
            <TextInput.Icon icon="magnify" size={20} onPress={onSubmitSearch} />
          }
          right={
            value.length > 0 ? (
              <TextInput.Icon
                icon="close"
                size={20}
                onPress={handleClearInput}
              />
            ) : undefined
          }
        />
      </View>

      {/* Streaming Indicator */}
      {isStreaming && (
        <View style={styles.streamingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.streamingText}>
            AI is interpreting your search...
          </Text>
        </View>
      )}
    </View>
  );
}
