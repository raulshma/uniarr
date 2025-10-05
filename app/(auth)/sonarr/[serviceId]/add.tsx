import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

const SonarrAddSeriesPlaceholderScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl,
          justifyContent: 'space-between',
        },
        content: {
          alignItems: 'center',
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
      }),
    [theme],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Button mode="text" onPress={() => router.back()} accessibilityLabel="Go back">
          Back
        </Button>
        <View style={styles.content}>
          <Text variant="headlineSmall" style={styles.title}>
            Add Series Coming Soon
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            The add series workflow for Sonarr will be available shortly. Service ID: {serviceId ?? 'unknown'}
          </Text>
        </View>
        <Button mode="contained" onPress={() => router.back()}>
          Close
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default SonarrAddSeriesPlaceholderScreen;
