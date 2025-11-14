import React from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { AssistantMenuContent } from "@/components/chat/AssistantMenuContent";
import { SafeAreaView } from "react-native-safe-area-context";

const AssistantMenuModal: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <AssistantMenuContent onClose={handleClose} />
    </SafeAreaView>
  );
};

// Styles created inside component to access theme

export default AssistantMenuModal;
