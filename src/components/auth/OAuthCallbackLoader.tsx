import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface OAuthCallbackLoaderProps {
  message?: string;
  title?: string;
}

export const OAuthCallbackLoader = ({
  message = "Processing authentication...",
  title = "Signing In",
}: OAuthCallbackLoaderProps) => {
  const theme = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    content: {
      alignItems: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.primary,
      marginBottom: 16,
      textAlign: "center",
    },
    message: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 32,
      maxWidth: 300,
    },
    loader: {
      marginBottom: 24,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={styles.loader}
        />
        <Text variant="titleLarge" style={styles.title}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={styles.message}>
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );
};
