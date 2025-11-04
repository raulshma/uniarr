import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
  SettingsListItem,
  SettingsGroup,
} from "@/components/common";
import { TabHeader } from "@/components/common/TabHeader";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

const ElementsScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const handleBackPress = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    section: {
      marginVertical: spacing.md,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.sm,
      marginLeft: spacing.md,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TabHeader
        title="Elements Configuration"
        showBackButton
        onBackPress={handleBackPress}
      />
      <AnimatedScrollView contentContainerStyle={styles.content}>
        <AnimatedSection style={styles.section} delay={0} animated>
          <Text style={styles.sectionTitle}>Loaders & Animations</Text>
          <SettingsGroup>
            <AnimatedListItem index={0} totalItems={1} animated>
              <SettingsListItem
                title="UniArr Loader"
                subtitle="Configure the animated loading indicator"
                left={{ iconName: "loading" }}
                trailing={
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    Configurable
                  </Text>
                }
                onPress={() =>
                  router.push("/(auth)/settings/elements/uniarr-loader")
                }
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>
      </AnimatedScrollView>
    </SafeAreaView>
  );
};

export default ElementsScreen;
