import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { spacing } from '@/theme/spacing';

const SettingsScreen = () => {
  const router = useRouter();
  const { signOut } = useAuth();
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: spacing.md,
    },
    title: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      color: theme.colors.onBackground,
      marginBottom: spacing.lg,
    },
    button: {
      marginVertical: spacing.sm,
    },
  });

  const handleAddService = () => {
    router.push('/(auth)/add-service');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(public)/login');
    } catch (signOutError) {
      const message =
        signOutError instanceof Error
          ? signOutError.message
          : 'Unable to sign out. Please try again.';

      Alert.alert('Sign out failed', message);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Button mode="contained" onPress={handleAddService} style={styles.button}>
        Add Service
      </Button>

      <Button
        mode="outlined"
        onPress={confirmSignOut}
        style={styles.button}
        textColor={theme.colors.error}
      >
        Sign out
      </Button>

      {/* Add more settings options here as needed */}
    </SafeAreaView>
  );
};

export default SettingsScreen;