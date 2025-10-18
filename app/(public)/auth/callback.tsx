import { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { AppTheme } from "@/constants/theme";
import { logger } from "@/services/logger/LoggerService";

const OAuthCallbackScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Log the callback
    void logger.info("OAuth callback received", {
      location: "OAuthCallbackScreen",
      timestamp: new Date().toISOString(),
    });

    // Show loading state for 1-2 seconds, then redirect
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 100;
        // After 1.5 seconds, redirect to dashboard
        if (next >= 1500) {
          clearInterval(timer);
          void logger.info("Redirecting to dashboard from OAuth callback", {
            location: "OAuthCallbackScreen",
          });
          router.replace("/(auth)/dashboard");
        }
        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [router]);

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    content: {
      alignItems: "center",
      gap: 16,
    },
    spinner: {
      marginBottom: 8,
    },
    title: {
      color: theme.colors.onBackground,
      textAlign: "center",
      marginTop: 8,
    },
    description: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    timer: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      marginTop: 8,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.spinner}>
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              animating
            />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            Completing Sign In
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            Verifying your credentials and logging you in...
          </Text>
          <Text style={styles.timer}>{Math.round(elapsed / 100) / 10}s</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OAuthCallbackScreen;
