import { useSignUp } from "@clerk/clerk-expo";
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
import * as WebBrowser from "expo-web-browser";

import { type AppTheme } from "@/constants/theme";
import { useAuth } from "@/services/auth/AuthProvider";
import { getClerkErrorMessage } from "@/services/auth/AuthService";
import { logger } from "@/services/logger/LoggerService";

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

const SignupScreen = () => {
  const { isAuthenticated, continueAsGuest } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

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
          paddingHorizontal: theme.custom.spacing.lg,
          paddingTop: theme.custom.spacing.xxl,
          paddingBottom: theme.custom.spacing.lg,
          justifyContent: "space-between",
        },
        header: {
          alignItems: "center",
        },
        brand: {
          color: theme.colors.primary,
          marginBottom: theme.custom.spacing.md,
        },
        welcomeTitle: {
          color: theme.colors.onBackground,
          marginBottom: theme.custom.spacing.xs,
          textAlign: "center",
        },
        subtitle: {
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        form: {
          marginTop: theme.custom.spacing.xl,
        },
        formSpacing: {
          marginBottom: theme.custom.spacing.md,
        },
        nameRow: {
          flexDirection: "row",
          gap: theme.custom.spacing.sm,
        },
        nameInput: {
          flex: 1,
        },
        error: {
          marginBottom: theme.custom.spacing.md,
        },
        primaryButton: {
          marginBottom: theme.custom.spacing.md,
        },
        dividerRow: {
          flexDirection: "row",
          alignItems: "center",
          marginVertical: theme.custom.spacing.lg,
        },
        dividerLine: {
          flex: 1,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.outlineVariant,
        },
        dividerText: {
          marginHorizontal: theme.custom.spacing.sm,
          color: theme.colors.onSurfaceVariant,
        },
        footer: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        },
        footerText: {
          color: theme.colors.onSurfaceVariant,
        },
        signInText: {
          marginLeft: theme.custom.spacing.xs,
          color: theme.colors.primary,
        },
        verificationContainer: {
          alignItems: "center",
          paddingVertical: theme.custom.spacing.lg,
        },
        verificationText: {
          textAlign: "center",
          marginBottom: theme.custom.spacing.md,
        },
        guestButton: {
          marginTop: theme.custom.spacing.md,
        },
      }),
    [theme],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(auth)/dashboard");
    }
  }, [isAuthenticated, router]);

  const validateForm = useCallback(() => {
    if (!email.trim()) {
      setErrorMessage("Email is required");
      return false;
    }
    if (!password) {
      setErrorMessage("Password is required");
      return false;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long");
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return false;
    }
    if (!firstName.trim()) {
      setErrorMessage("First name is required");
      return false;
    }
    return true;
  }, [email, password, confirmPassword, firstName]);

  const handleSignUp = useCallback(async () => {
    if (!isLoaded || isSubmitting || isVerifying) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!signUp) {
        setErrorMessage(
          "Authentication service is not ready. Please try again.",
        );
        return;
      }

      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (result.status === "missing_requirements") {
        // Email verification required
        setIsVerifying(true);
        setIsSubmitting(false);
        return;
      }

      if (result.status === "complete" && result.createdSessionId) {
        if (!setActive) {
          setErrorMessage("Unable to finalize the session. Please try again.");
          return;
        }

        await setActive({ session: result.createdSessionId });
        router.replace("/(auth)/dashboard");
      } else {
        setErrorMessage("Unable to create account. Please try again.");
      }
    } catch (error) {
      const message = getClerkErrorMessage(
        error,
        "Unable to create account. Please check your information and try again.",
      );
      setErrorMessage(message);

      void logger.warn("Sign-up attempt failed.", {
        location: "SignupScreen.handleSignUp",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    email,
    password,
    firstName,
    lastName,
    isLoaded,
    isSubmitting,
    isVerifying,
    validateForm,
    signUp,
    setActive,
    router,
  ]);

  const handleResendVerification = useCallback(async () => {
    if (!signUp || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (error) {
      const message = getClerkErrorMessage(
        error,
        "Unable to resend verification email. Please try again.",
      );
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [signUp, isSubmitting]);

  const handleSignIn = useCallback(() => {
    router.replace("/(public)/login");
  }, [router]);

  const handleContinueAsGuest = useCallback(() => {
    continueAsGuest();
  }, [continueAsGuest]);

  if (isVerifying) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.verificationContainer}>
            <Text variant="headlineSmall" style={styles.welcomeTitle}>
              Check Your Email
            </Text>
            <Text variant="bodyLarge" style={styles.verificationText}>
              We've sent a verification link to {email}. Please check your email
              and click the link to verify your account.
            </Text>
            <Button
              mode="outlined"
              onPress={handleResendVerification}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.primaryButton}
            >
              Resend Verification Email
            </Button>
            <Button
              mode="text"
              onPress={handleSignIn}
              style={styles.primaryButton}
            >
              Back to Sign In
            </Button>
            <Button
              mode="text"
              onPress={handleContinueAsGuest}
              style={styles.guestButton}
            >
              Continue as Guest
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.brand}>
              Media Manager
            </Text>
            <Text variant="displaySmall" style={styles.welcomeTitle}>
              Create Account
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Join us and start managing your media.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.nameRow}>
              <TextInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                textContentType="givenName"
                autoComplete="given-name"
                style={[styles.formSpacing, styles.nameInput]}
                returnKeyType="next"
                accessibilityLabel="First name"
                mode="outlined"
                disabled={isSubmitting}
                left={<TextInput.Icon icon="account-outline" />}
              />
              <TextInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                textContentType="familyName"
                autoComplete="family-name"
                style={[styles.formSpacing, styles.nameInput]}
                returnKeyType="next"
                accessibilityLabel="Last name"
                mode="outlined"
                disabled={isSubmitting}
                left={<TextInput.Icon icon="account-outline" />}
              />
            </View>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.formSpacing}
              returnKeyType="next"
              accessibilityLabel="Email"
              mode="outlined"
              disabled={isSubmitting}
              left={<TextInput.Icon icon="email-outline" />}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              style={styles.formSpacing}
              returnKeyType="next"
              accessibilityLabel="Password"
              mode="outlined"
              disabled={isSubmitting}
              left={<TextInput.Icon icon="lock-outline" />}
            />
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              style={styles.formSpacing}
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              accessibilityLabel="Confirm password"
              mode="outlined"
              disabled={isSubmitting}
              left={<TextInput.Icon icon="lock-outline" />}
            />
            {Boolean(errorMessage) && (
              <HelperText type="error" visible style={styles.error}>
                {errorMessage}
              </HelperText>
            )}
            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                !isLoaded ||
                !email.trim() ||
                !password ||
                !firstName.trim() ||
                password !== confirmPassword
              }
              accessibilityRole="button"
              style={styles.primaryButton}
            >
              Create Account
            </Button>
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
            Already have an account?
          </Text>
          <TouchableOpacity onPress={handleSignIn} accessibilityRole="button">
            <Text variant="bodyMedium" style={styles.signInText}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SignupScreen;
