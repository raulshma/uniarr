import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { TabHeader } from '@/components/common/TabHeader';
import { BackupRestoreSection } from '@/components/settings/BackupRestoreSection';
import { CloudBackupSettings } from '@/components/settings/CloudBackupSettings';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

const BackupRestoreScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.lg,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
      letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TabHeader
          showTitle
          title="Backup & Restore"
          showBackButton
          onBackPress={() => router.back()}
        />

        <View style={styles.section}>
          <BackupRestoreSection delay={50} />
        </View>

        <View style={styles.section}>
          <CloudBackupSettings delay={100} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BackupRestoreScreen;
