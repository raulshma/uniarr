import { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Switch,
  Portal,
  Dialog,
  Button,
  Chip,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Slider from "@react-native-community/slider";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import {
  SettingsListItem,
  SettingsGroup,
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common";
import { useSettingsStore } from "@/store/settingsStore";
import {
  useConversationalAIConfigStore,
  selectConversationalAIProvider,
  selectConversationalAIModel,
} from "@/store/conversationalAIConfigStore";
import { shouldAnimateLayout } from "@/utils/animations.utils";

// Common genre list for exclusion
const COMMON_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];

// Content rating options
const CONTENT_RATINGS = [
  { label: "G - General Audiences", value: "G" },
  { label: "PG - Parental Guidance", value: "PG" },
  { label: "PG-13 - Parents Strongly Cautioned", value: "PG-13" },
  { label: "R - Restricted", value: "R" },
  { label: "NC-17 - Adults Only", value: "NC-17" },
  { label: "No Limit", value: undefined },
];

const ChevronTrailing = ({ onPress }: { onPress?: () => void }) => (
  <IconButton
    icon="chevron-right"
    size={16}
    iconColor={useTheme<AppTheme>().colors.outline}
    onPress={onPress}
  />
);

const RecommendationSettingsScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  // Settings store
  const {
    recommendationIncludeHiddenGems,
    recommendationLimit,
    recommendationExcludedGenres,
    recommendationContentRatingLimit,
    recommendationCacheDurationHours,
    recommendationBackgroundUpdatesEnabled,
    setRecommendationIncludeHiddenGems,
    setRecommendationLimit,
    setRecommendationExcludedGenres,
    setRecommendationContentRatingLimit,
    setRecommendationCacheDurationHours,
    setRecommendationBackgroundUpdatesEnabled,
  } = useSettingsStore();

  const recommendationProvider = useConversationalAIConfigStore(
    selectConversationalAIProvider,
  );
  const recommendationModel = useConversationalAIConfigStore(
    selectConversationalAIModel,
  );

  // Dialog states
  const [limitDialogVisible, setLimitDialogVisible] = useState(false);
  const [genreDialogVisible, setGenreDialogVisible] = useState(false);
  const [ratingDialogVisible, setRatingDialogVisible] = useState(false);
  const [cacheDurationDialogVisible, setCacheDurationDialogVisible] =
    useState(false);

  // Temporary states for dialogs
  const [tempLimit, setTempLimit] = useState(recommendationLimit);
  const [tempExcludedGenres, setTempExcludedGenres] = useState(
    recommendationExcludedGenres,
  );
  const [tempCacheDuration, setTempCacheDuration] = useState(
    recommendationCacheDurationHours,
  );

  const animationsEnabled = shouldAnimateLayout(false, false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.xxxxl,
      paddingTop: spacing.md,
    },
    section: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    dialogContent: {
      paddingTop: spacing.md,
    },
    sliderContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sliderLabel: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    sliderValue: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    genreChipsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    genreChip: {
      marginBottom: spacing.xs,
    },
    dialogActions: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    ratingOption: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceVariant,
    },
    ratingOptionText: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      color: theme.colors.onSurface,
    },
    selectedRatingOption: {
      backgroundColor: theme.colors.primaryContainer,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme.colors.background,
    },
    headerTitle: {
      flex: 1,
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontWeight: "600",
      color: theme.colors.onBackground,
      marginLeft: spacing.sm,
    },
  });

  const handleLimitPress = () => {
    setTempLimit(recommendationLimit);
    setLimitDialogVisible(true);
  };

  const handleLimitSave = () => {
    setRecommendationLimit(tempLimit);
    setLimitDialogVisible(false);
  };

  const handleGenrePress = () => {
    setTempExcludedGenres(recommendationExcludedGenres);
    setGenreDialogVisible(true);
  };

  const toggleGenre = (genre: string) => {
    setTempExcludedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const handleGenreSave = () => {
    setRecommendationExcludedGenres(tempExcludedGenres);
    setGenreDialogVisible(false);
  };

  const handleRatingPress = () => {
    setRatingDialogVisible(true);
  };

  const handleRatingSelect = (value: string | undefined) => {
    setRecommendationContentRatingLimit(value);
    setRatingDialogVisible(false);
  };

  const handleCacheDurationPress = () => {
    setTempCacheDuration(recommendationCacheDurationHours);
    setCacheDurationDialogVisible(true);
  };

  const handleCacheDurationSave = () => {
    setRecommendationCacheDurationHours(tempCacheDuration);
    setCacheDurationDialogVisible(false);
  };

  const excludedGenresValue = useMemo(() => {
    if (recommendationExcludedGenres.length === 0) {
      return "None";
    }
    if (recommendationExcludedGenres.length <= 3) {
      return recommendationExcludedGenres.join(", ");
    }
    return `${recommendationExcludedGenres.length} genres excluded`;
  }, [recommendationExcludedGenres]);

  const ratingLimitValue = useMemo(() => {
    if (!recommendationContentRatingLimit) {
      return "No Limit";
    }
    const rating = CONTENT_RATINGS.find(
      (r) => r.value === recommendationContentRatingLimit,
    );
    return rating?.label || recommendationContentRatingLimit;
  }, [recommendationContentRatingLimit]);

  const cacheDurationValue = useMemo(() => {
    if (recommendationCacheDurationHours === 24) {
      return "24 hours (default)";
    }
    if (recommendationCacheDurationHours < 24) {
      return `${recommendationCacheDurationHours} hours`;
    }
    const days = Math.floor(recommendationCacheDurationHours / 24);
    return `${days} day${days > 1 ? "s" : ""}`;
  }, [recommendationCacheDurationHours]);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Recommendation Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Engine */}
        <AnimatedSection
          style={styles.section}
          delay={0}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>AI Engine</Text>
          <SettingsGroup>
            <SettingsListItem
              title="Provider & Model"
              subtitle={
                recommendationProvider && recommendationModel
                  ? `${recommendationProvider} / ${recommendationModel}`
                  : "Not configured"
              }
              left={{ iconName: "brain" }}
              trailing={
                <ChevronTrailing
                  onPress={() => router.push("/(auth)/settings/conversational-ai")}
                />
              }
              onPress={() => router.push("/(auth)/settings/conversational-ai")}
              groupPosition="single"
            />
          </SettingsGroup>
          <Text
            style={{
              fontSize: 12,
              color: theme.colors.onSurfaceVariant,
              marginTop: spacing.sm,
              paddingHorizontal: spacing.xs,
            }}
          >
            The recommendation engine uses the same provider and model as the
            Conversational AI feature. Configure it on the Conversational AI
            settings page.
          </Text>
        </AnimatedSection>

        {/* General Settings */}
        <AnimatedSection
          style={styles.section}
          delay={0}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>General</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Include Hidden Gems"
                subtitle="Discover lesser-known quality content"
                left={{ iconName: "star-outline" }}
                trailing={
                  <Switch
                    value={recommendationIncludeHiddenGems}
                    onValueChange={setRecommendationIncludeHiddenGems}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Number of Recommendations"
                subtitle={`${recommendationLimit} recommendations per request`}
                left={{ iconName: "format-list-numbered" }}
                trailing={<ChevronTrailing onPress={handleLimitPress} />}
                onPress={handleLimitPress}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Content Filters */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Content Filters</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Excluded Genres"
                subtitle={excludedGenresValue}
                left={{ iconName: "filter-variant" }}
                trailing={<ChevronTrailing onPress={handleGenrePress} />}
                onPress={handleGenrePress}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Content Rating Limit"
                subtitle={ratingLimitValue}
                left={{ iconName: "shield-check" }}
                trailing={<ChevronTrailing onPress={handleRatingPress} />}
                onPress={handleRatingPress}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Performance */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Performance</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Cache Duration"
                subtitle={cacheDurationValue}
                left={{ iconName: "clock-outline" }}
                trailing={
                  <ChevronTrailing onPress={handleCacheDurationPress} />
                }
                onPress={handleCacheDurationPress}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Background Updates"
                subtitle="Precompute recommendations during idle time"
                left={{ iconName: "update" }}
                trailing={
                  <Switch
                    value={recommendationBackgroundUpdatesEnabled}
                    onValueChange={setRecommendationBackgroundUpdatesEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>
      </ScrollView>

      {/* Limit Dialog */}
      <Portal>
        <Dialog
          visible={limitDialogVisible}
          onDismiss={() => setLimitDialogVisible(false)}
        >
          <Dialog.Title>Number of Recommendations</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabel}>
                <Text>Recommendations per request</Text>
                <Text style={styles.sliderValue}>{tempLimit}</Text>
              </View>
              <Slider
                value={tempLimit}
                onValueChange={setTempLimit}
                minimumValue={3}
                maximumValue={10}
                step={1}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.surfaceVariant}
                thumbTintColor={theme.colors.primary}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setLimitDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleLimitSave}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Genre Exclusion Dialog */}
      <Portal>
        <Dialog
          visible={genreDialogVisible}
          onDismiss={() => setGenreDialogVisible(false)}
        >
          <Dialog.Title>Exclude Genres</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.genreChipsContainer}>
                {COMMON_GENRES.map((genre) => (
                  <Chip
                    key={genre}
                    mode={
                      tempExcludedGenres.includes(genre) ? "flat" : "outlined"
                    }
                    selected={tempExcludedGenres.includes(genre)}
                    onPress={() => toggleGenre(genre)}
                    style={styles.genreChip}
                  >
                    {genre}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setGenreDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleGenreSave}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Content Rating Dialog */}
      <Portal>
        <Dialog
          visible={ratingDialogVisible}
          onDismiss={() => setRatingDialogVisible(false)}
        >
          <Dialog.Title>Content Rating Limit</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              {CONTENT_RATINGS.map((rating) => (
                <View
                  key={rating.value || "none"}
                  style={[
                    styles.ratingOption,
                    recommendationContentRatingLimit === rating.value &&
                      styles.selectedRatingOption,
                  ]}
                >
                  <Button
                    mode="text"
                    onPress={() => handleRatingSelect(rating.value)}
                    contentStyle={{ justifyContent: "flex-start" }}
                  >
                    <Text style={styles.ratingOptionText}>{rating.label}</Text>
                  </Button>
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>

      {/* Cache Duration Dialog */}
      <Portal>
        <Dialog
          visible={cacheDurationDialogVisible}
          onDismiss={() => setCacheDurationDialogVisible(false)}
        >
          <Dialog.Title>Cache Duration</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabel}>
                <Text>Hours to cache recommendations</Text>
                <Text style={styles.sliderValue}>
                  {tempCacheDuration < 24
                    ? `${tempCacheDuration}h`
                    : `${Math.floor(tempCacheDuration / 24)}d`}
                </Text>
              </View>
              <Slider
                value={tempCacheDuration}
                onValueChange={setTempCacheDuration}
                minimumValue={1}
                maximumValue={168}
                step={1}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.surfaceVariant}
                thumbTintColor={theme.colors.primary}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: theme.colors.onSurfaceVariant,
                  marginTop: spacing.xs,
                }}
              >
                Longer cache reduces AI API calls but may show stale
                recommendations
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setCacheDurationDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleCacheDurationSave}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default RecommendationSettingsScreen;
