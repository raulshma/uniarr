import React, { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { useRouter } from "expo-router";

import {
  AnimatedSection,
  PageTransition,
} from "@/components/common/AnimatedComponents";
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
        page: {
          flex: 1,
        },
        content: {
          flex: 1,
          marginTop: spacing.xs,
          marginHorizontal: spacing.sm,
        },
      }),
    [theme],
  );

  return (
    <SafeAreaView style={styles.container}>
      <PageTransition style={styles.page} transitionType="fade">
        <AnimatedSection delay={0} animated>
          <TabHeader
            title="Search"
            showTitle
            showBackButton
            onBackPress={() => router.back()}
          />
        </AnimatedSection>

        <AnimatedSection style={styles.content} delay={80} animated>
          <UnifiedSearchPanel />
        </AnimatedSection>
      </PageTransition>
    </SafeAreaView>
  );
};

export default UnifiedSearchScreen;
