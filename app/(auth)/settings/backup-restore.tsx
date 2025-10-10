import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

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
    placeholderText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      lineHeight: theme.custom.typography.bodyLarge.lineHeight,
      letterSpacing: theme.custom.typography.bodyLarge.letterSpacing,
      fontWeight: theme.custom.typography.bodyLarge.fontWeight as any,
      textAlign: 'center',
      marginTop: spacing.xl,
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
          <Text style={styles.placeholderText}>
            Backup and restore functionality has been removed.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BackupRestoreScreen;
