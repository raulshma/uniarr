import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

const SonarrSeriesDetailsPlaceholderScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { serviceId, id } = useLocalSearchParams<{ serviceId?: string; id?: string }>();

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
            Series Details Coming Soon
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Detailed information for series {id ?? 'unknown'} will be available after the next milestone.
          </Text>
          <Text variant="bodySmall" style={[styles.subtitle, { marginTop: spacing.md }]}>
            Service ID: {serviceId ?? 'unknown'}
          </Text>
        </View>
        <Button mode="contained" onPress={() => router.back()}>
          Close
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default SonarrSeriesDetailsPlaceholderScreen;
