import React, { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";

import { TabHeader } from "@/components/common/TabHeader";
import { UnifiedSearchPanel } from "@/components/search/UnifiedSearchPanel";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

const UnifiedSearchScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          flex: 1,
          marginTop: spacing.xs,
          marginHorizontal: spacing.sm,
        },
      }),
    [theme]
  );

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader
        title="Search"
        showTitle={true}
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        <UnifiedSearchPanel />
      </View>
    </SafeAreaView>
  );
};

export default UnifiedSearchScreen;
