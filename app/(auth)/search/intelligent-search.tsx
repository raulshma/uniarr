import React, { useMemo, useState } from "react";
import { StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";

import {
  AnimatedSection,
  PageTransition,
} from "@/components/common/AnimatedComponents";
import { TabHeader } from "@/components/common/TabHeader";
import { SearchInput } from "@/components/search/SearchInput";
import { SearchInterpretationView } from "@/components/search/SearchInterpretationView";
import { RecommendationsView } from "@/components/search/SearchRecommendationsView";
import { useAISearch } from "@/hooks/useAISearch";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { SearchInterpretation } from "@/utils/validation/searchSchemas";

interface SectionData {
  type: "input" | "interpretation" | "recommendations" | "results";
  data?: any;
}

const IntelligentSearchScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const {
    searchQuery,
    setSearchQuery,
    interpretation,
    partialInterpretation,
    isInterpretingSearch,
    interpretationError,
    results,
    isSearching,
    searchError,
    recommendations,
    isLoadingRecommendations,
    performSearch,
    refineInterpretation,
    clearSearch,
  } = useAISearch();

  const [currentPartialInterpretation, setCurrentPartialInterpretation] =
    useState<Partial<SearchInterpretation>>({});

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
        headerContainer: {
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.sm,
        },
        content: {
          flex: 1,
          marginTop: spacing.xs,
          marginHorizontal: spacing.sm,
        },
        section: {
          marginBottom: spacing.md,
        },
        streamingContainer: {
          padding: spacing.md,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: spacing.sm,
        },
        streamingText: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  const sections: SectionData[] = useMemo(() => {
    const sectionsList: SectionData[] = [{ type: "input" }];

    // Show interpretation if we have partial or full interpretation
    if (
      partialInterpretation &&
      Object.keys(partialInterpretation).length > 0
    ) {
      sectionsList.push({
        type: "interpretation",
        data: partialInterpretation,
      });
    }

    // Show recommendations if available
    if (recommendations && recommendations.length > 0) {
      sectionsList.push({ type: "recommendations", data: recommendations });
    }

    // Show results if available
    if (results && results.length > 0) {
      sectionsList.push({ type: "results", data: results });
    }

    return sectionsList;
  }, [partialInterpretation, recommendations, results]);

  const renderSection = ({ item }: { item: SectionData }) => {
    switch (item.type) {
      case "input":
        return (
          <View style={styles.section}>
            <SearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitSearch={() => performSearch()}
              onInterpretationStream={(partial) => {
                setCurrentPartialInterpretation((prev) => ({
                  ...prev,
                  ...partial,
                }));
              }}
              onInterpretationComplete={(interp) => {
                setCurrentPartialInterpretation({});
              }}
              isStreaming={isInterpretingSearch}
              interpretation={partialInterpretation}
            />
          </View>
        );

      case "interpretation":
        return (
          <View style={styles.section}>
            <SearchInterpretationView
              interpretation={item.data}
              isStreaming={isInterpretingSearch}
              onEditMedia={(mediaTypes) => {
                // Handle edit media types
              }}
              onEditGenres={(genres) => {
                // Handle edit genres
              }}
              onEditFilters={(filters) => {
                // Handle edit filters
              }}
            />
          </View>
        );

      case "recommendations":
        return (
          <View style={styles.section}>
            <RecommendationsView
              recommendations={item.data}
              isLoading={isLoadingRecommendations}
              onSelectRecommendation={(rec) => {
                // Handle recommendation selection
                setSearchQuery(rec.title);
                performSearch(rec.title);
              }}
            />
          </View>
        );

      case "results":
        // For now, show a placeholder - results component would be implemented separately
        return (
          <View style={styles.section}>
            {/* TODO: Implement SearchResultsView component */}
            <View
              style={{
                padding: spacing.md,
                backgroundColor: theme.colors.surface,
              }}
            >
              {/* Placeholder for results */}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderStreamingIndicator = () => {
    if (!isInterpretingSearch && !isSearching) return null;

    const message = isInterpretingSearch
      ? "Interpreting your search..."
      : "Searching services...";

    return (
      <View style={styles.streamingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.streamingText}>{message}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <PageTransition style={styles.page} transitionType="fade">
        <View style={styles.headerContainer}>
          <AnimatedSection delay={0} animated>
            <TabHeader
              title="AI Search"
              showTitle
              showBackButton
              onBackPress={() => router.back()}
            />
          </AnimatedSection>
        </View>

        <AnimatedSection style={styles.content} delay={80} animated>
          <FlashList
            data={sections}
            renderItem={renderSection}
            keyExtractor={(item: SectionData) => item.type}
            estimatedItemSize={150}
            ListHeaderComponent={renderStreamingIndicator}
            showsVerticalScrollIndicator={false}
          />
        </AnimatedSection>
      </PageTransition>
    </SafeAreaView>
  );
};

export default IntelligentSearchScreen;
