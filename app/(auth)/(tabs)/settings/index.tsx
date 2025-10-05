import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

const SettingsScreen = () => {
  const router = useRouter();
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Button mode="contained" onPress={handleAddService} style={styles.button}>
        Add Service
      </Button>
      {/* Add more settings options here as needed */}
    </SafeAreaView>
  );
};

export default SettingsScreen;