import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable, Animated } from "react-native";
import { Badge } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";

interface FloatingChatButtonProps {
  onPress: () => void;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  onPress,
}) => {
  const theme = useTheme();
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
          bottom: 95 + insets.bottom,
          left: 16,
          zIndex: 99,
          elevation: 12,
          shadowColor: theme.colors.shadow || "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        button: {
          width: 52,
          height: 52,
          borderRadius: theme.custom.spacing.lg,
          backgroundColor: theme.colors.surface,
          justifyContent: "center",
          alignItems: "center",
          /* Allow the badge to overflow outside the circular button so it isn't clipped */
          overflow: "visible",
        },
        badge: {
          position: "absolute",
          top: -4,
          right: -4,
          /* Ensure the badge has a higher zIndex on Android */
          zIndex: 999,
          elevation: 20,
        },
      }),
    [
      insets.bottom,
      theme.colors.shadow,
      theme.colors.surface,
      theme.custom.spacing.lg,
    ],
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
