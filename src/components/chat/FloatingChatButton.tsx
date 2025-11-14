import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable, Animated } from "react-native";
import { useTheme, Badge } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FloatingChatButtonProps {
  onPress: () => void;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  onPress,
}) => {
  const theme = useTheme<MD3Theme>();
  const insets = useSafeAreaInsets();
  const messages = useConversationalAIStore((state) => state.messages);

  // Count unread assistant messages as indicator
  const unreadCount = useMemo(() => {
    return messages.filter((msg) => msg.role === "assistant").length;
  }, [messages]);

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [scaleAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: "absolute",
          bottom: 85 + insets.bottom,
          right: 16,
          zIndex: 99,
          elevation: 12,
          shadowColor: theme.colors.shadow || "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        button: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.primary,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        },
        badge: {
          position: "absolute",
          top: -4,
          right: -4,
        },
      }),
    [insets.bottom, theme.colors.primary, theme.colors.shadow],
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Pressable
          style={styles.button}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          android_ripple={{
            color: "rgba(255, 255, 255, 0.3)",
            borderless: true,
          }}
        >
          <MaterialCommunityIcons
            name="chat-outline"
            size={28}
            color="#FFFFFF"
          />
          {unreadCount > 0 && (
            <Badge size={24} style={styles.badge} visible={true}>
              {unreadCount}
            </Badge>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
};
