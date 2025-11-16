import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Searchbar,
  Chip,
  Button,
  IconButton,
  Card,
  Badge,
  SegmentedButtons,
  ProgressBar,
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { useResourcesStore } from "@/store/resourcesStore";
import type {
  Resource,
  ResourceCategory,
  ServiceType,
} from "@/models/resources.types";
import { AnimatedListItem } from "@/components/common";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { shouldAnimateLayout } from "@/utils/animations.utils";

const ResourcesScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const params = useLocalSearchParams();
  const initialCategory = params.category as ResourceCategory | undefined;
  const initialService = params.service as ServiceType | undefined;

  const {
    getFilteredResources,
    selectedCategory,
    selectedService,
    showFeaturedOnly,
    setFilter,
    getStats,
    getBookmarksForResource,
    getProgressForResource,
  } = useResourcesStore();

  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const stats = useMemo(() => getStats(), [getStats]);

  // Set initial filters from params
  useEffect(() => {
    if (initialCategory || initialService) {
      setFilter({
        category: initialCategory,
        service: initialService,
      });
    }
  }, [initialCategory, initialService, setFilter]);

  // Get filtered resources
  const filteredResources = useMemo(() => {
    return getFilteredResources({
      category: selectedCategory,
      service: selectedService,
      searchQuery: localSearchQuery,
      featured: showFeaturedOnly,
    });
  }, [
    getFilteredResources,
    selectedCategory,
    selectedService,
    localSearchQuery,
    showFeaturedOnly,
  ]);

  const animationsEnabled = shouldAnimateLayout(false, false);

  // Get resource metadata
  const getResourceProgress = useCallback(
    (resourceId: string) => {
      return getProgressForResource(resourceId);
    },
    [getProgressForResource],
  );

  const getResourceBookmarks = useCallback(
    (resourceId: string) => {
      return getBookmarksForResource(resourceId);
    },
    [getBookmarksForResource],
  );

  // Category data
  const categories = useMemo(() => {
    const cats: {
      id: ResourceCategory;
      label: string;
      icon: string;
      count: number;
    }[] = [
      {
        id: "getting-started",
        label: "Getting Started",
        icon: "rocket-launch",
        count:
          stats.categoryProgress["getting-started"]?.total ||
          filteredResources.filter((r) => r.category === "getting-started")
            .length,
      },
      {
        id: "service-guides",
        label: "Service Guides",
        icon: "book-open-variant",
        count:
          stats.categoryProgress["service-guides"]?.total ||
          filteredResources.filter((r) => r.category === "service-guides")
            .length,
      },
      {
        id: "api-reference",
        label: "API Reference",
        icon: "code-json",
        count:
          stats.categoryProgress["api-reference"]?.total ||
          filteredResources.filter((r) => r.category === "api-reference")
            .length,
      },
      {
        id: "troubleshooting",
        label: "Troubleshooting",
        icon: "tools",
        count:
          stats.categoryProgress["troubleshooting"]?.total ||
          filteredResources.filter((r) => r.category === "troubleshooting")
            .length,
      },
      {
        id: "configuration",
        label: "Configuration",
        icon: "cog",
        count:
          stats.categoryProgress["configuration"]?.total ||
          filteredResources.filter((r) => r.category === "configuration")
            .length,
      },
      {
        id: "advanced-features",
        label: "Advanced",
        icon: "star",
        count:
          stats.categoryProgress["advanced-features"]?.total ||
          filteredResources.filter((r) => r.category === "advanced-features")
            .length,
      },
    ];
    return cats;
  }, [stats, filteredResources]);

  // Service data
  const services = useMemo(() => {
    const srvs: {
      id: ServiceType;
      label: string;
      icon: string;
      count: number;
    }[] = [
      {
        id: "general",
        label: "General",
        icon: "apps",
        count:
          stats.serviceProgress["general"]?.total ||
          filteredResources.filter((r) => r.service === "general").length,
      },
      {
        id: "sonarr",
        label: "Sonarr",
        icon: "television",
        count:
          stats.serviceProgress["sonarr"]?.total ||
          filteredResources.filter((r) => r.service === "sonarr").length,
      },
      {
        id: "radarr",
        label: "Radarr",
        icon: "movie",
        count:
          stats.serviceProgress["radarr"]?.total ||
          filteredResources.filter((r) => r.service === "radarr").length,
      },
      {
        id: "jellyseerr",
        label: "Jellyseerr",
        icon: "hand-coin",
        count:
          stats.serviceProgress["jellyseerr"]?.total ||
          filteredResources.filter((r) => r.service === "jellyseerr").length,
      },
      {
        id: "qbittorrent",
        label: "qBittorrent",
        icon: "download",
        count:
          stats.serviceProgress["qbittorrent"]?.total ||
          filteredResources.filter((r) => r.service === "qbittorrent").length,
      },
      {
        id: "prowlarr",
        label: "Prowlarr",
        icon: "radar",
        count:
          stats.serviceProgress["prowlarr"]?.total ||
          filteredResources.filter((r) => r.service === "prowlarr").length,
      },
      {
        id: "jellyfin",
        label: "Jellyfin",
        icon: "play-box-multiple",
        count:
          stats.serviceProgress["jellyfin"]?.total ||
          filteredResources.filter((r) => r.service === "jellyfin").length,
      },
      {
        id: "bazarr",
        label: "Bazarr",
        icon: "subtitles",
        count:
          stats.serviceProgress["bazarr"]?.total ||
          filteredResources.filter((r) => r.service === "bazarr").length,
      },
      {
        id: "adguard",
        label: "AdGuard",
        icon: "shield-check",
        count:
          stats.serviceProgress["adguard"]?.total ||
          filteredResources.filter((r) => r.service === "adguard").length,
      },
      {
        id: "homarr",
        label: "Homarr",
        icon: "view-dashboard",
        count:
          stats.serviceProgress["homarr"]?.total ||
          filteredResources.filter((r) => r.service === "homarr").length,
      },
    ];
    return srvs;
  }, [stats, filteredResources]);

  const handleCategoryPress = (category: ResourceCategory | undefined) => {
    setFilter({ category });
  };

  const handleServicePress = (service: ServiceType | undefined) => {
    setFilter({ service });
  };

  const handleSearchChange = (query: string) => {
    setLocalSearchQuery(query);
  };

  const handleResourcePress = (resource: Resource) => {
    router.push(`/resources/${resource.id}`);
  };

  const clearFilters = () => {
    setFilter({
      category: undefined,
      service: undefined,
      showFeaturedOnly: false,
    });
    setLocalSearchQuery("");
  };

  const getDifficultyColor = (difficulty?: string) => {
    if (!difficulty) return theme.colors.surfaceVariant;
    switch (difficulty) {
      case "beginner":
        return theme.colors.primaryContainer;
      case "intermediate":
        return theme.colors.secondaryContainer;
      case "advanced":
        return theme.colors.tertiaryContainer;
      default:
        return theme.colors.surfaceVariant;
    }
  };

  const getDifficultyTextColor = (difficulty?: string) => {
    if (!difficulty) return theme.colors.onSurfaceVariant;
    switch (difficulty) {
      case "beginner":
        return theme.colors.onPrimaryContainer;
      case "intermediate":
        return theme.colors.onSecondaryContainer;
      case "advanced":
        return theme.colors.onTertiaryContainer;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.id === category);
    return cat?.icon || "information";
  };

  const getServiceIcon = (service?: string) => {
    const srv = services.find((s) => s.id === service);
    return srv?.icon || "help-circle";
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xxxxl,
    },
    headerSection: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
      marginTop: spacing.none,
    },
    headerTitle: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
      color: theme.colors.onBackground,
      marginBottom: spacing.md,
    },
    statsContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statBox: {
      flex: 1,
      padding: spacing.sm,
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: borderRadius.lg,
      alignItems: "center",
    },
    statValue: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: "bold",
      color: theme.colors.onPrimaryContainer,
      marginBottom: spacing.xs,
    },
    statLabel: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      color: theme.colors.onPrimaryContainer,
    },
    searchSection: {
      marginHorizontal: spacing.sm,
      marginBottom: spacing.md,
      marginTop: spacing.md,
    },
    searchbar: {
      elevation: 2,
      backgroundColor: theme.colors.surface,
    },
    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: spacing.sm,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    filterInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    filterText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      color: theme.colors.onSurfaceVariant,
    },
    viewModeContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.sm,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    filterSection: {
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
      color: theme.colors.onBackground,
    },
    categoryChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    serviceChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    chip: {
      borderRadius: borderRadius.lg,
      minHeight: 44,
      justifyContent: "center",
    },
    resourceCard: {
      marginHorizontal: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: borderRadius.xl,
      elevation: 1,
      overflow: "hidden",
    },
    resourceCardGrid: {
      flex: 1,
      margin: spacing.xs,
      minWidth: "48%",
      maxWidth: "48%",
    },
    resourceContent: {
      padding: spacing.md,
    },
    resourceHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.sm,
    },
    resourceInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    resourceTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
      marginBottom: spacing.xs,
      lineHeight: 24,
    },
    resourceMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
      flexWrap: "wrap",
    },
    resourceMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    resourceMetaText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      color: theme.colors.onSurfaceVariant,
    },
    resourceDescription: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    resourceFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
      flexWrap: "nowrap",
    },
    resourceTags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      flex: 1,
    },
    tagChip: {
      height: 28,
      borderRadius: borderRadius.lg,
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
    },
    progressIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    progressBar: {
      height: 4,
      width: 24,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.md,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxxxl,
      paddingHorizontal: spacing.xl,
    },
    emptyStateIcon: {
      marginBottom: spacing.md,
    },
    emptyStateTitle: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
      color: theme.colors.onBackground,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    emptyStateDescription: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      lineHeight: 24,
    },
    featuredBadge: {
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxxs,
      borderRadius: borderRadius.md,
      backgroundColor: theme.colors.primary,
      zIndex: 2,
    },
    difficultyBadge: {
      height: 24,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.sm,
      alignSelf: "flex-start",
      marginTop: spacing.lg,
      marginLeft: spacing.xs,
      zIndex: 1,
    },
  });

  const hasActiveFilters =
    selectedCategory || selectedService || localSearchQuery || showFeaturedOnly;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with stats */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Resources & Guides</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalResources}</Text>
            <Text style={styles.statLabel}>Resources</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.completedResources}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {Math.round(
                (stats.completedResources / Math.max(stats.totalResources, 1)) *
                  100,
              )}
              %
            </Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Search & View Mode */}
        <View style={styles.searchSection}>
          <Searchbar
            placeholder="Search resources..."
            onChangeText={handleSearchChange}
            value={localSearchQuery}
            style={styles.searchbar}
            inputStyle={{
              color: theme.colors.onSurface,
            }}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <SegmentedButtons
            value={viewMode}
            onValueChange={(value) => setViewMode(value as "grid" | "list")}
            buttons={[
              {
                value: "list",
                label: "List",
                icon: "view-list",
                style: { flex: 1 },
              },
              {
                value: "grid",
                label: "Grid",
                icon: "view-grid",
                style: { flex: 1 },
              },
            ]}
          />
        </View>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <View style={styles.filterBar}>
            <View style={styles.filterInfo}>
              <IconButton
                icon="filter-active"
                size={16}
                iconColor={theme.colors.primary}
                accessibilityLabel="Active filters"
                accessibilityRole="button"
              />
              <Text
                style={styles.filterText}
                accessibilityRole="text"
                numberOfLines={1}
              >
                {[
                  selectedCategory &&
                    categories.find((c) => c.id === selectedCategory)?.label,
                  selectedService &&
                    services.find((s) => s.id === selectedService)?.label,
                  localSearchQuery && `"${localSearchQuery}"`,
                  showFeaturedOnly && "Featured",
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            </View>
            <Button
              mode="text"
              onPress={clearFilters}
              compact
              icon="close"
              textColor={theme.colors.primary}
            >
              Clear
            </Button>
          </View>
        )}

        {/* Collapsible Filter Sections */}
        <View style={styles.filterSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Text
              style={{
                fontSize: theme.custom.typography.labelSmall.fontSize,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              (
              {
                filteredResources.filter(
                  (r) => !selectedCategory || r.category === selectedCategory,
                ).length
              }
              )
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChips}
          >
            {categories.map((category) => (
              <Chip
                key={category.id}
                icon={category.icon}
                mode={selectedCategory === category.id ? "flat" : "outlined"}
                style={styles.chip}
                textStyle={{
                  color:
                    selectedCategory === category.id
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.primary,
                  fontSize: theme.custom.typography.labelMedium.fontSize,
                }}
                onPress={() =>
                  handleCategoryPress(
                    selectedCategory === category.id ? undefined : category.id,
                  )
                }
                accessibilityLabel={category.label}
                accessibilityState={{
                  selected: selectedCategory === category.id,
                }}
              >
                {category.label}
              </Chip>
            ))}
          </ScrollView>
        </View>

        {/* Service Filters */}
        <View style={styles.filterSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services</Text>
            <Text
              style={{
                fontSize: theme.custom.typography.labelSmall.fontSize,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              (
              {
                filteredResources.filter(
                  (r) => !selectedService || r.service === selectedService,
                ).length
              }
              )
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serviceChips}
          >
            {services.map((service) => (
              <Chip
                key={service.id}
                icon={service.icon}
                mode={selectedService === service.id ? "flat" : "outlined"}
                style={styles.chip}
                textStyle={{
                  color:
                    selectedService === service.id
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.primary,
                  fontSize: theme.custom.typography.labelMedium.fontSize,
                }}
                onPress={() =>
                  handleServicePress(
                    selectedService === service.id ? undefined : service.id,
                  )
                }
                accessibilityLabel={service.label}
                accessibilityState={{
                  selected: selectedService === service.id,
                }}
              >
                {service.label}
              </Chip>
            ))}
          </ScrollView>
        </View>

        {/* Resources List */}
        {filteredResources.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="book-search-outline"
              size={64}
              color={theme.colors.onSurfaceVariant}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateTitle}>No resources found</Text>
            <Text style={styles.emptyStateDescription}>
              {localSearchQuery
                ? "Try different search terms"
                : "Adjust your filters to find resources"}
            </Text>
            {hasActiveFilters && (
              <Button
                mode="outlined"
                onPress={clearFilters}
                style={{ marginTop: spacing.md }}
              >
                Clear filters
              </Button>
            )}
          </View>
        ) : (
          <View
            style={{
              flexDirection: viewMode === "grid" ? "row" : "column",
              flexWrap: viewMode === "grid" ? "wrap" : "nowrap",
            }}
          >
            {filteredResources.map((resource, index) => {
              const progress = getResourceProgress(resource.id);
              const bookmarks = getResourceBookmarks(resource.id);
              const completionPercent =
                resource.sections.length > 0
                  ? Math.round(
                      ((progress?.sectionsCompleted?.length || 0) /
                        resource.sections.length) *
                        100,
                    )
                  : 0;

              const cardStyle = [
                styles.resourceCard,
                viewMode === "grid" && styles.resourceCardGrid,
              ];

              return (
                <AnimatedListItem
                  key={resource.id}
                  index={index}
                  totalItems={filteredResources.length}
                  animated={animationsEnabled}
                >
                  <Card
                    style={cardStyle}
                    onPress={() => handleResourcePress(resource)}
                    mode="elevated"
                    accessibilityLabel={`${resource.title}. ${resource.description}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.resourceContent}>
                      {/* Featured Badge */}
                      {resource.featured && (
                        <Badge
                          style={[
                            styles.featuredBadge,
                            {
                              backgroundColor: theme.colors.primaryContainer,
                            },
                          ]}
                        >
                          ⭐ Featured
                        </Badge>
                      )}

                      {/* Title & Meta */}
                      <View style={styles.resourceHeader}>
                        <View style={styles.resourceInfo}>
                          <Text style={styles.resourceTitle}>
                            {resource.title}
                          </Text>

                          <View style={styles.resourceMeta}>
                            <View style={styles.resourceMetaItem}>
                              <MaterialCommunityIcons
                                name={
                                  getCategoryIcon(
                                    resource.category,
                                  ) as React.ComponentProps<
                                    typeof MaterialCommunityIcons
                                  >["name"]
                                }
                                size={14}
                                color={theme.colors.primary}
                              />
                              <Text style={styles.resourceMetaText}>
                                {resource.category
                                  .split("-")
                                  .map(
                                    (word) =>
                                      word.charAt(0).toUpperCase() +
                                      word.slice(1),
                                  )
                                  .join(" ")}
                              </Text>
                            </View>

                            {resource.service && (
                              <View style={styles.resourceMetaItem}>
                                <MaterialCommunityIcons
                                  name={
                                    getServiceIcon(
                                      resource.service,
                                    ) as React.ComponentProps<
                                      typeof MaterialCommunityIcons
                                    >["name"]
                                  }
                                  size={14}
                                  color={theme.colors.secondary}
                                />
                                <Text style={styles.resourceMetaText}>
                                  {resource.service.charAt(0).toUpperCase() +
                                    resource.service.slice(1)}
                                </Text>
                              </View>
                            )}

                            {resource.readTime && (
                              <View style={styles.resourceMetaItem}>
                                <MaterialCommunityIcons
                                  name="clock-outline"
                                  size={14}
                                  color={theme.colors.tertiary}
                                />
                                <Text style={styles.resourceMetaText}>
                                  {resource.readTime}m
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Difficulty Badge */}
                        {resource.difficulty && (
                          <View
                            style={[
                              styles.difficultyBadge,
                              {
                                backgroundColor: getDifficultyColor(
                                  resource.difficulty,
                                ),
                              },
                            ]}
                          >
                            <Text
                              style={[
                                {
                                  fontSize:
                                    theme.custom.typography.labelSmall.fontSize,
                                  color: getDifficultyTextColor(
                                    resource.difficulty,
                                  ),
                                  fontWeight: "600",
                                },
                              ]}
                            >
                              {resource.difficulty
                                ? ((
                                    resource.difficulty as string | undefined
                                  )?.[0]?.toUpperCase?.() ?? "")
                                : ""}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Description */}
                      <Text
                        style={styles.resourceDescription}
                        numberOfLines={2}
                      >
                        {resource.description}
                      </Text>

                      {/* Progress Bar */}
                      {progress && (
                        <View
                          style={{
                            marginVertical: spacing.sm,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              marginBottom: spacing.xs,
                            }}
                          >
                            <Text
                              style={{
                                fontSize:
                                  theme.custom.typography.labelSmall.fontSize,
                                color: theme.colors.onSurfaceVariant,
                              }}
                            >
                              Progress
                            </Text>
                            <Text
                              style={{
                                fontSize:
                                  theme.custom.typography.labelSmall.fontSize,
                                fontWeight: "600",
                                color: theme.colors.primary,
                              }}
                            >
                              {completionPercent}%
                            </Text>
                          </View>
                          <ProgressBar
                            progress={completionPercent / 100}
                            color={theme.colors.primary}
                            style={{
                              height: 4,
                              borderRadius: borderRadius.md,
                            }}
                          />
                        </View>
                      )}

                      {/* Tags & Footer */}
                      <View style={styles.resourceFooter}>
                        <View style={styles.resourceTags}>
                          {resource.tags.slice(0, 2).map((tag) => (
                            <Chip
                              key={tag}
                              mode="outlined"
                              compact
                              style={styles.tagChip}
                            >
                              {tag}
                            </Chip>
                          ))}
                          {resource.tags.length > 2 && (
                            <Text
                              style={{
                                fontSize:
                                  theme.custom.typography.labelSmall.fontSize,
                                color: theme.colors.onSurfaceVariant,
                              }}
                            >
                              +{resource.tags.length - 2}
                            </Text>
                          )}
                        </View>

                        {/* Indicators */}
                        <View style={styles.progressIndicator}>
                          {bookmarks.length > 0 && (
                            <MaterialCommunityIcons
                              name="bookmark"
                              size={16}
                              color={theme.colors.primary}
                            />
                          )}
                          {progress?.completed && (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={16}
                              color={theme.colors.primary}
                            />
                          )}
                        </View>
                      </View>
                    </View>
                  </Card>
                </AnimatedListItem>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ResourcesScreen;
