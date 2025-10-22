import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Button, Text, useTheme, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { type AppTheme } from "@/constants/theme";

const { width: screenWidth } = Dimensions.get("window");

type OnboardingStep = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  backgroundColor?: string;
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to UniArr",
    subtitle: "Your Media Management Hub",
    description:
      "Manage all your media servers in one place with a beautiful, intuitive interface.",
    icon: "view-dashboard",
    backgroundColor: "#F5E6A3",
  },
  {
    id: "services",
    title: "Connect Your Services",
    subtitle: "Sonarr • Radarr • qBittorrent",
    description:
      "Easily connect and monitor your favorite media management tools from a single dashboard.",
    icon: "connection",
    backgroundColor: "#DDE8C8",
  },
  {
    id: "monitor",
    title: "Monitor Everything",
    subtitle: "Real-time Status Updates",
    description:
      "Keep track of downloads, recently added content, and service health all in real-time.",
    icon: "monitor-dashboard",
    backgroundColor: "#F2E5D4",
  },
  {
    id: "organize",
    title: "Stay Organized",
    subtitle: "Everything in One Place",
    description:
      "No more switching between multiple apps. UniArr brings everything together for you.",
    icon: "folder-multiple",
    backgroundColor: "#E8E2D4",
  },
];

const OnboardingScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollView: {
          flex: 1,
        },
        content: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: theme.custom.spacing.lg,
          paddingVertical: theme.custom.spacing.xl,
        },
        stepContainer: {
          width: screenWidth,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: theme.custom.spacing.lg,
        },
        iconContainer: {
          width: 120, // Keep original size for this specific hero element
          height: 120,
          borderRadius: 60, // Perfect circle
          alignItems: "center",
          justifyContent: "center",
          marginBottom: theme.custom.spacing.xl,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
          backgroundColor: "transparent",
        },
        title: {
          color: theme.colors.onBackground,
          textAlign: "center",
          marginBottom: theme.custom.spacing.sm,
        },
        subtitle: {
          color: theme.colors.primary,
          textAlign: "center",
          marginBottom: theme.custom.spacing.md,
        },
        description: {
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginBottom: theme.custom.spacing.xl,
          maxWidth: 280,
        },
        pagination: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: theme.custom.spacing.xl,
          gap: theme.custom.spacing.sm,
        },
        paginationDot: {
          width: 8, // Keep original size for pagination dots
          height: 8,
          borderRadius: 4, // Perfect circle
          backgroundColor: theme.colors.outlineVariant,
        },
        paginationDotActive: {
          backgroundColor: theme.colors.primary,
          width: 24, // Keep original active width
        },
        buttonContainer: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: 280,
          gap: theme.custom.spacing.md,
        },
        button: {
          flex: 1,
        },
        primaryButton: {
          backgroundColor: theme.colors.primary,
        },
        secondaryButton: {
          borderColor: theme.colors.outline,
        },
        skipText: {
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  const handleComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem("onboarding_completed", "true");
    } catch (error) {
      console.error("Error saving onboarding completion status:", error);
    }
    router.replace("/login");
  }, [router]);

  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(async () => {
    try {
      await AsyncStorage.setItem("onboarding_completed", "true");
    } catch (error) {
      console.error("Error saving onboarding completion status:", error);
    }
    router.replace("/login");
  }, [router]);

  const currentStepData = ONBOARDING_STEPS[currentStep];

  const renderStep = () => (
    <View style={styles.stepContainer}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor:
              currentStepData?.backgroundColor || theme.colors.primaryContainer,
          },
        ]}
      >
        <IconButton
          icon={currentStepData?.icon || "view-dashboard"}
          size={48}
          iconColor={theme.colors.primary}
        />
      </View>

      <Text variant="displaySmall" style={styles.title}>
        {currentStepData?.title}
      </Text>

      <Text variant="titleMedium" style={styles.subtitle}>
        {currentStepData?.subtitle}
      </Text>

      <Text variant="bodyLarge" style={styles.description}>
        {currentStepData?.description}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={theme.dark ? "light" : "dark"} />

      <View style={styles.scrollView}>
        <View style={styles.content}>
          {renderStep()}

          <View style={styles.pagination}>
            {ONBOARDING_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentStep && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.buttonContainer}>
            {currentStep > 0 && (
              <Button
                mode="outlined"
                onPress={handlePrevious}
                style={[styles.button, styles.secondaryButton]}
                labelStyle={styles.skipText}
              >
                Previous
              </Button>
            )}

            <Button
              mode="contained"
              onPress={handleNext}
              style={[styles.button, styles.primaryButton]}
            >
              {currentStep === ONBOARDING_STEPS.length - 1
                ? "Get Started"
                : "Next"}
            </Button>
          </View>

          {currentStep < ONBOARDING_STEPS.length - 1 && (
            <Button
              mode="text"
              onPress={handleSkip}
              style={styles.button}
              labelStyle={styles.skipText}
            >
              Skip
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;
