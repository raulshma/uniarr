import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

const AddServicePlaceholderScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl,
          justifyContent: 'space-between',
        },
        content: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        },
        title: {
          marginBottom: spacing.sm,
          textAlign: 'center',
          color: theme.colors.onBackground,
        },
        subtitle: {
          textAlign: 'center',
          color: theme.colors.onSurfaceVariant,
        },
        footer: {
          marginTop: spacing.xl,
        },
      }),
    [theme],
  );

  return (
    <SafeAreaView style={styles.container}>
      <Button mode="text" onPress={() => router.back()} accessibilityLabel="Go back">
        Back
      </Button>
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Add Service Coming Soon
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          The add service flow will be implemented shortly. Check back again after the setup task is
          complete.
        </Text>
      </View>
      <View style={styles.footer}>
        <Button mode="contained" onPress={() => router.back()}>
          Close
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default AddServicePlaceholderScreen;
