import { useSignIn, useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { type AppTheme } from "@/constants/theme";
import { useAuth } from "@/services/auth/AuthProvider";
import { getClerkErrorMessage } from "@/services/auth/AuthService";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

const useWarmUpBrowser = () => {
  useEffect(() => {
    // Preloads the browser for Android devices to reduce authentication load time
    void WebBrowser.warmUpAsync();
    return () => {
      // Cleanup: closes browser when component unmounts
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

const LoginScreen = () => {
  const { isAuthenticated, continueAsGuest } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useWarmUpBrowser();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xxl,
          paddingBottom: spacing.lg,
          justifyContent: "space-between",
        },
        header: {
          alignItems: "center",
        },
        brand: {
          color: theme.colors.primary,
          marginBottom: spacing.md,
        },
        welcomeTitle: {
          color: theme.colors.onBackground,
          marginBottom: spacing.xs,
          textAlign: "center",
        },
        subtitle: {
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        form: {
          marginTop: spacing.xl,
        },
        formSpacing: {
          marginBottom: spacing.md,
        },
        forgotPasswordContainer: {
          alignItems: "flex-end",
          marginBottom: spacing.lg,
        },
        forgotPasswordText: {
          color: theme.colors.primary,
        },
        error: {
          marginBottom: spacing.md,
        },
        primaryButton: {
          marginBottom: spacing.md,
        },
        dividerRow: {
          flexDirection: "row",
          alignItems: "center",
          marginVertical: spacing.lg,
        },
        dividerLine: {
          flex: 1,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.outlineVariant,
        },
        dividerText: {
          marginHorizontal: spacing.sm,
          color: theme.colors.onSurfaceVariant,
        },
        socialRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: spacing.sm,
        },
        socialButton: {
          flex: 1,
          marginHorizontal: spacing.xs,
        },
        footer: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        },
        footerText: {
          color: theme.colors.onSurfaceVariant,
        },
        signUpText: {
          marginLeft: spacing.xs,
          color: theme.colors.primary,
        },
        guestButton: {
          marginTop: spacing.md,
        },
      }),
    [theme],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(auth)/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSignIn = useCallback(async () => {
    if (!isLoaded || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!signIn) {
        setErrorMessage(
          "Authentication service is not ready. Please try again.",
        );
        return;
      }

      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      });

      if (result.status !== "complete" || !result.createdSessionId) {
        setErrorMessage(
          "Additional verification is required to finish signing in.",
        );
        return;
      }

      if (!setActive) {
        setErrorMessage("Unable to finalize the session. Please try again.");
        return;
      }

      await setActive({ session: result.createdSessionId });
      router.replace("/(auth)/dashboard");
    } catch (error) {
      const message = getClerkErrorMessage(
        error,
        "Unable to sign in. Check your credentials and try again.",
      );
      setErrorMessage(message);

      void logger.warn("Sign-in attempt failed.", {
        location: "LoginScreen.handleSignIn",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [identifier, isLoaded, isSubmitting, password, router, setActive, signIn]);

  const handleGoogleSignIn = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Use a simple redirect URI that points to the app root
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "uniarr",
      });

      void logger.info("Starting Google SSO flow", {
        location: "LoginScreen.handleGoogleSignIn",
        redirectUrl,
      });

      const { createdSessionId, setActive: setOAuthActive } =
        await startSSOFlow({
          strategy: "oauth_google",
          redirectUrl,
        });

      void logger.info("Google SSO flow completed", {
        location: "LoginScreen.handleGoogleSignIn",
        hasSessionId: Boolean(createdSessionId),
        hasSetActive: Boolean(setOAuthActive),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        void logger.info("Google sign-in successful, navigating to dashboard");
        router.replace("/(auth)/dashboard");
      } else {
        setErrorMessage("Unable to complete Google sign-in. Please try again.");
      }
    } catch (error) {
      const message = getClerkErrorMessage(
        error,
        "Unable to sign in with Google. Please try again.",
      );
      setErrorMessage(message);

      void logger.warn("Google sign-in attempt failed.", {
        location: "LoginScreen.handleGoogleSignIn",
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, router, startSSOFlow]);

  const handleFacebookSignIn = useCallback(() => {
    void logger.info("Facebook sign-in pressed", {
      location: "LoginScreen.handleFacebookSignIn",
    });
  }, []);

  const handleForgotPassword = useCallback(() => {
    void logger.info("Forgot password pressed", {
      location: "LoginScreen.handleForgotPassword",
    });
  }, []);

  const handleSignUp = useCallback(() => {
    router.push("/(public)/signup");
  }, [router]);

  const handleContinueAsGuest = useCallback(() => {
    continueAsGuest();
  }, [continueAsGuest]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.brand}>
              Media Manager
            </Text>
            <Text variant="displaySmall" style={styles.welcomeTitle}>
              Welcome Back
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Sign in to continue your media journey.
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label="Email or Username"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.formSpacing}
              returnKeyType="next"
              accessibilityLabel="Email or username"
              mode="outlined"
              disabled={isSubmitting}
              left={<TextInput.Icon icon="email-outline" />}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              style={styles.formSpacing}
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              accessibilityLabel="Password"
              mode="outlined"
              disabled={isSubmitting}
              left={<TextInput.Icon icon="lock-outline" />}
            />
            <TouchableOpacity
              onPress={handleForgotPassword}
              accessibilityRole="button"
              style={styles.forgotPasswordContainer}
            >
              <Text variant="labelLarge" style={styles.forgotPasswordText}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
            {Boolean(errorMessage) && (
              <HelperText type="error" visible style={styles.error}>
                {errorMessage}
              </HelperText>
            )}
            <Button
              mode="contained"
              onPress={handleSignIn}
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                !isLoaded ||
                identifier.trim().length === 0 ||
                password.length === 0
              }
              accessibilityRole="button"
              style={styles.primaryButton}
            >
              Log In
            </Button>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text variant="labelLarge" style={styles.dividerText}>
                Or continue with
              </Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.socialRow}>
              <Button
                mode="outlined"
                onPress={handleGoogleSignIn}
                loading={isSubmitting}
                disabled={isSubmitting || !isLoaded}
                icon="google"
                accessibilityRole="button"
                style={styles.socialButton}
              >
                Google
              </Button>
              <Button
                mode="outlined"
                onPress={handleFacebookSignIn}
                disabled={isSubmitting || !isLoaded}
                icon="facebook"
                accessibilityRole="button"
                style={styles.socialButton}
              >
                Facebook
              </Button>
            </View>
            <Button
              mode="text"
              onPress={handleContinueAsGuest}
              disabled={isSubmitting}
              accessibilityRole="button"
              style={styles.guestButton}
            >
              Continue as Guest
            </Button>
          </View>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            Don't have an account?
          </Text>
          <TouchableOpacity onPress={handleSignUp} accessibilityRole="button">
            <Text variant="bodyMedium" style={styles.signUpText}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
