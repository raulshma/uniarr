import React, { useCallback } from "react";
import { useRouter } from "expo-router";
import { FloatingChatButton } from "./FloatingChatButton";

interface FloatingChatContainerProps {
  variant?: "button" | "modal";
}

/**
 * Floating Chat Container
 * Provides a floating chat button that appears on all screens in the authenticated app.
 * Clicking the button navigates to the conversational AI screen or can open a modal in the future.
 */
export const FloatingChatContainer: React.FC<FloatingChatContainerProps> = ({
  variant = "button",
}) => {
  const router = useRouter();

  const handleOpenChat = useCallback(() => {
    router.push("/(auth)/settings/conversational-ai");
  }, [router]);

  if (variant === "button") {
    return <FloatingChatButton onPress={handleOpenChat} />;
  }

  // Modal variant can be implemented in the future
  return null;
};
