import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Linking,
  Dimensions,
} from "react-native";
import {
  Text,
  useTheme,
  Button,
  IconButton,
  Chip,
  Portal,
  Modal,
  List,
} from "react-native-paper";
import AppMarkdown from "@/components/markdown/AppMarkdown";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { useResourcesStore } from "@/store/resourcesStore";
import type {
  Resource,
  ResourceSection,
  ResourceLink,
} from "@/models/resources.types";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";

const ResourceDetailScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const params = useLocalSearchParams<{ resourceId: string }>();

  const { resourceId } = params;

  const {
    getResourceById,
    getProgressForResource,
    markSectionCompleted,
    markResourceCompleted,
    addBookmark,
    removeBookmark,
    getBookmarksForResource,
    updateProgress,
  } = useResourcesStore();

  const [resource, setResource] = useState<Resource | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [readingStartTime, setReadingStartTime] = useState<number | null>(null);
  const [showTableOfContents, setShowTableOfContents] = useState(false);
  const [useFormattedContent, setUseFormattedContent] = useState(true);
  const screenWidth = Dimensions.get("window").width;

  // Define all hooks at the top level before any conditional logic
  const handleSectionToggle = useCallback(
    (section: ResourceSection) => {
      const isCompleted = progress?.sectionsCompleted?.includes(section.id);

      if (isCompleted) {
        // TODO: Implement unmark section if needed
        return;
      } else {
        markSectionCompleted(resource?.id || "", section.id);
      }
    },
    [progress, markSectionCompleted, resource],
  );

  const handleMarkCompleted = useCallback(() => {
    if (resource) {
      markResourceCompleted(resource.id);
    }
  }, [markResourceCompleted, resource]);

  const handleBookmark = useCallback(
    (sectionId?: string) => {
      if (resource) {
        const existingBookmark = bookmarks.find(
          (bookmark) =>
            bookmark.resourceId === resource.id &&
            bookmark.sectionId === sectionId,
        );

        if (existingBookmark) {
          removeBookmark(resource.id, sectionId);
        } else {
          addBookmark(resource.id, sectionId);
        }
      }
    },
    [bookmarks, addBookmark, removeBookmark, resource],
  );

  const handleShare = useCallback(async () => {
    if (resource) {
      try {
        await Share.share({
          message: `Check out this resource: ${resource.title}\n\n${resource.description}`,
          url: `uniarr://resources/${resource.id}`,
          title: resource.title,
        });
      } catch {
        // Handle share error silently
      }
    }
  }, [resource]);

  const handleLinkPress = useCallback(
    async (link: ResourceLink) => {
      if (link.type === "internal") {
        router.push(link.url);
      } else {
        try {
          const supported = await Linking.canOpenURL(link.url);
          if (supported) {
            await Linking.openURL(link.url);
          } else {
            Alert.alert(
              "Cannot open link",
              "This link cannot be opened on your device.",
            );
          }
        } catch {
          Alert.alert("Error", "Failed to open the link.");
        }
      }
    },
    [router],
  );

  const getSectionProgress = useCallback(
    (sectionId: string) => {
      return progress?.sectionsCompleted?.includes(sectionId) || false;
    },
    [progress],
  );

  // Format content for better markdown rendering
  const formatMarkdownContent = useCallback(
    (content: string, mode: "markdown" | "plain" = "markdown") => {
      const normalized = content
        .replace(/\r\n/g, "\n")
        .replace(/\n\n+/g, "\n\n")
        .trim();

      if (mode === "plain") {
        return normalized
          .replace(/^- /gm, "\u2022 ")
          .replace(/^\d+\. /gm, (match) => `${match} `);
      }

      return normalized;
    },
    [],
  );

  const isSectionBookmarked = useCallback(
    (sectionId: string) => {
      return bookmarks.some(
        (bookmark) =>
          bookmark.resourceId === resource?.id &&
          bookmark.sectionId === sectionId,
      );
    },
    [bookmarks, resource?.id],
  );

  const isResourceBookmarked = useCallback(() => {
    return bookmarks.some(
      (bookmark) => bookmark.resourceId === resource?.id && !bookmark.sectionId,
    );
  }, [bookmarks, resource]);

  const completionPercentage = useMemo(() => {
    if (!progress || !resource || resource.sections.length === 0) return 0;
    return Math.round(
      (progress.sectionsCompleted.length / resource.sections.length) * 100,
    );
  }, [progress, resource]);

  // Load resource and related data
  useEffect(() => {
    if (resourceId) {
      const foundResource = getResourceById(resourceId);
      if (foundResource) {
        setResource(foundResource);
        const resourceProgress = getProgressForResource(resourceId);
        setProgress(resourceProgress);
        const resourceBookmarks = getBookmarksForResource(resourceId);
        setBookmarks(resourceBookmarks);
        setReadingStartTime(Date.now());
      } else {
        // Resource not found, navigate back
        router.back();
      }
    }
  }, [
    resourceId,
    getResourceById,
    getProgressForResource,
    getBookmarksForResource,
    router,
  ]);

  // Track reading time
  useEffect(() => {
    return () => {
      if (readingStartTime && resource) {
        const timeSpent = Math.floor(
          (Date.now() - readingStartTime) / 1000 / 60,
        ); // minutes
        updateProgress(resource.id, {
          timeSpent: (progress?.timeSpent || 0) + timeSpent,
        });
      }
    };
  }, [readingStartTime, resource, progress, updateProgress]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "getting-started":
        return "rocket-launch";
      case "service-guides":
        return "book-open-variant";
      case "api-reference":
        return "code-json";
      case "troubleshooting":
        return "tools";
      case "configuration":
        return "cog";
      case "advanced-features":
        return "star";
      default:
        return "information";
    }
  };

  const getServiceIcon = (service?: string) => {
    if (!service) return "apps";
    switch (service) {
      case "sonarr":
        return "television";
      case "radarr":
        return "movie";
      case "jellyseerr":
        return "hand-coin";
      case "qbittorrent":
        return "download";
      case "prowlarr":
        return "radar";
      case "jellyfin":
        return "play-box-multiple";
      case "bazarr":
        return "subtitles";
      case "adguard":
        return "shield-check";
      case "homarr":
        return "view-dashboard";
      default:
        return "help-circle";
    }
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingBottom: spacing.xxxxl,
    },
    header: {
      padding: spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.md,
    },
    headerInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    title: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
      color: theme.colors.onSurface,
      marginBottom: spacing.sm,
      lineHeight: 32,
    },
    metaContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    metaText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      color: theme.colors.onSurfaceVariant,
    },
    description: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      color: theme.colors.onSurface,
      lineHeight: 26,
    },
    badgesContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: "center",
    },
    actionButtons: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
      flexWrap: "wrap",
    },
    progressSection: {
      margin: spacing.md,
      padding: spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: borderRadius.xl,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    progressTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
    },
    progressPercentage: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      color: theme.colors.primary,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.md,
      overflow: "hidden",
      marginBottom: spacing.sm,
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
      borderRadius: borderRadius.md,
    },
    progressText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    section: {
      margin: spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: borderRadius.xl,
      overflow: "hidden",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      paddingBottom: spacing.sm,
    },
    sectionTitle: {
      flex: 1,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
      marginLeft: spacing.sm,
    },
    sectionContent: {
      padding: spacing.md,
      paddingTop: 0,
    },
    sectionText: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      color: theme.colors.onSurface,
      lineHeight: 26,
    },
    markdownContainer: {
      flex: 1,
      width: "100%",
      alignSelf: "stretch",
    },
    tagsSection: {
      margin: spacing.md,
      padding: spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: borderRadius.xl,
    },
    tagsTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
      marginBottom: spacing.sm,
    },
    tagsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    tagChip: {
      borderRadius: borderRadius.lg,
    },
    linksSection: {
      margin: spacing.md,
      padding: spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: borderRadius.xl,
    },
    linksTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
      marginBottom: spacing.sm,
    },
    linkItem: {
      marginBottom: spacing.md,
    },
    linkTitle: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      fontWeight: "600",
      color: theme.colors.primary,
      marginBottom: spacing.xs,
    },
    linkDescription: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.xs,
    },
    linkType: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      color: theme.colors.outline,
      fontStyle: "italic",
    },
    tocModal: {
      backgroundColor: theme.colors.surface,
      margin: spacing.lg,
      borderRadius: borderRadius.xl,
      maxHeight: "80%",
    },
    tocHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    tocTitle: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      color: theme.colors.onSurface,
    },
    tocContent: {
      maxHeight: 400,
    },
    difficultyBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      alignSelf: "center",
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      maxWidth: screenWidth * 0.35,
    },
    difficultyText: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 16,
    },
    featuredBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      alignSelf: "center",
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      maxWidth: screenWidth * 0.35,
    },
    featuredText: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      color: theme.colors.onPrimary,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 16,
    },
  });

  if (!resource) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerInfo}>
              <Text style={styles.title}>{resource.title}</Text>

              <View style={styles.metaContainer}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons
                    name={getCategoryIcon(resource.category)}
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.metaText}>
                    {resource.category
                      .replace("-", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                </View>

                {resource.service && (
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                      name={getServiceIcon(resource.service)}
                      size={16}
                      color={theme.colors.secondary}
                    />
                    <Text style={styles.metaText}>
                      {resource.service.charAt(0).toUpperCase() +
                        resource.service.slice(1)}
                    </Text>
                  </View>
                )}

                {resource.readTime && (
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={16}
                      color={theme.colors.tertiary}
                    />
                    <Text style={styles.metaText}>
                      {resource.readTime} min read
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <Text style={styles.description}>{resource.description}</Text>

          <View style={styles.badgesContainer}>
            {resource.difficulty && (
              <View
                style={[
                  styles.difficultyBadge,
                  {
                    backgroundColor: getDifficultyColor(resource.difficulty),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.difficultyText,
                    { color: getDifficultyTextColor(resource.difficulty) },
                  ]}
                >
                  {resource.difficulty.toUpperCase()}
                </Text>
              </View>
            )}

            {resource.featured && (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredText}>FEATURED</Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            <Button
              mode={useFormattedContent ? "contained" : "outlined"}
              onPress={() => setUseFormattedContent(!useFormattedContent)}
              icon={useFormattedContent ? "format-text" : "code-tags"}
              compact
              style={{ minWidth: screenWidth * 0.22 }}
              accessibilityLabel={`Content is currently ${useFormattedContent ? "formatted as markdown" : "shown as plain text"}`}
            >
              {useFormattedContent ? "MD" : "TXT"}
            </Button>
            <Button
              mode="outlined"
              onPress={() => setShowTableOfContents(true)}
              icon="table-of-contents"
              compact
              accessibilityLabel="View table of contents"
              accessibilityRole="button"
              accessibilityHint="Opens a modal showing all sections"
            >
              Contents
            </Button>
            <Button
              mode={isResourceBookmarked() ? "contained" : "outlined"}
              onPress={() => handleBookmark()}
              icon="bookmark"
              compact
              accessibilityLabel={
                isResourceBookmarked() ? "Remove bookmark" : "Add bookmark"
              }
              accessibilityRole="button"
              accessibilityHint={
                isResourceBookmarked()
                  ? "Remove this resource from bookmarks"
                  : "Save this resource to bookmarks"
              }
            >
              {isResourceBookmarked() ? "Bookmarked" : "Bookmark"}
            </Button>
            <Button
              mode="outlined"
              onPress={handleShare}
              icon="share"
              compact
              accessibilityLabel="Share resource"
              accessibilityRole="button"
              accessibilityHint="Share this resource with others"
            >
              Share
            </Button>
            {!progress?.completed && (
              <Button
                mode="contained"
                onPress={handleMarkCompleted}
                icon="check"
                compact
                accessibilityLabel="Mark resource as completed"
                accessibilityRole="button"
                accessibilityHint="Mark this entire resource as read and completed"
              >
                Mark Complete
              </Button>
            )}
          </View>
        </View>

        {/* Progress Section */}
        {progress && (
          <View
            style={styles.progressSection}
            accessible={true}
            accessibilityLabel={`Reading progress: ${completionPercentage}% complete, ${progress.sectionsCompleted.length} of ${resource.sections.length} sections completed`}
          >
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Reading Progress</Text>
              <Text style={styles.progressPercentage}>
                {completionPercentage}%
              </Text>
            </View>
            <View
              style={styles.progressBar}
              accessible={true}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: completionPercentage,
              }}
              accessibilityLabel={`Progress: ${completionPercentage}% complete`}
              accessibilityLiveRegion="polite"
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${completionPercentage}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText} accessibilityLiveRegion="polite">
              {progress.sectionsCompleted.length} of {resource.sections.length}{" "}
              sections completed
            </Text>
          </View>
        )}

        {/* Content Sections */}
        {resource.sections.map((section, index) => (
          <View
            key={section.id}
            style={styles.section}
            accessible={true}
            accessibilityLabel={`Section ${index + 1}: ${section.title}${getSectionProgress(section.id) ? ", completed" : ", not started"}`}
          >
            <View style={styles.sectionHeader}>
              <IconButton
                icon={
                  getSectionProgress(section.id)
                    ? "check-circle"
                    : "circle-outline"
                }
                size={24}
                iconColor={
                  getSectionProgress(section.id)
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
                onPress={() => handleSectionToggle(section)}
                accessibilityLabel={
                  getSectionProgress(section.id)
                    ? "Section completed, tap to unmark"
                    : "Section not started, tap to mark as complete"
                }
                accessibilityRole="button"
                accessibilityState={{ checked: getSectionProgress(section.id) }}
                accessibilityLiveRegion="polite"
              />
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {index + 1}. {section.title}
              </Text>
              <IconButton
                icon={
                  isSectionBookmarked(section.id)
                    ? "bookmark"
                    : "bookmark-outline"
                }
                size={20}
                iconColor={theme.colors.primary}
                onPress={() => handleBookmark(section.id)}
                accessibilityLabel={
                  isSectionBookmarked(section.id)
                    ? "Remove section bookmark"
                    : "Add section bookmark"
                }
                accessibilityRole="button"
                accessibilityState={{
                  checked: isSectionBookmarked(section.id),
                }}
              />
            </View>
            <View style={styles.sectionContent}>
              {useFormattedContent ? (
                <View style={styles.markdownContainer}>
                  <AppMarkdown
                    value={formatMarkdownContent(section.content, "markdown")}
                  />
                </View>
              ) : (
                <Text style={styles.sectionText}>
                  {formatMarkdownContent(section.content, "plain")}
                </Text>
              )}
            </View>
          </View>
        ))}

        {/* Tags */}
        {resource.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {resource.tags.map((tag) => (
                <Chip key={tag} mode="outlined" compact style={styles.tagChip}>
                  {tag}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {/* Links */}
        {resource.links && resource.links.length > 0 && (
          <View style={styles.linksSection}>
            <Text style={styles.linksTitle}>Related Links</Text>
            {resource.links.map((link, index) => (
              <View key={index} style={styles.linkItem}>
                <Text
                  style={styles.linkTitle}
                  onPress={() => handleLinkPress(link)}
                >
                  {link.title}
                </Text>
                {link.description && (
                  <Text style={styles.linkDescription}>{link.description}</Text>
                )}
                <Text style={styles.linkType}>
                  {link.type === "internal"
                    ? "Internal Resource"
                    : "External Link"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Table of Contents Modal */}
      <Portal>
        <Modal
          visible={showTableOfContents}
          onDismiss={() => setShowTableOfContents(false)}
          contentContainerStyle={styles.tocModal}
        >
          <View style={styles.tocHeader}>
            <Text style={styles.tocTitle} accessibilityRole="header">
              Table of Contents
            </Text>
            <IconButton
              icon="close"
              onPress={() => setShowTableOfContents(false)}
              accessibilityLabel="Close table of contents"
              accessibilityRole="button"
              accessibilityHint="Closes the table of contents modal and returns to the resource"
            />
          </View>
          <ScrollView
            style={styles.tocContent}
            accessibilityLabel={`Table of contents with ${resource.sections.length} sections`}
          >
            {resource.sections.map((section, index) => (
              <List.Item
                key={section.id}
                title={`${index + 1}. ${section.title}`}
                description={
                  getSectionProgress(section.id) ? "Completed" : "Not started"
                }
                accessibilityLabel={`Section ${index + 1}: ${section.title}, ${getSectionProgress(section.id) ? "completed" : "not started"}`}
                accessibilityState={{ checked: getSectionProgress(section.id) }}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={
                      getSectionProgress(section.id)
                        ? "check-circle"
                        : "circle-outline"
                    }
                    color={
                      getSectionProgress(section.id)
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                )}
                onPress={() => {
                  setShowTableOfContents(false);
                  handleSectionToggle(section);
                }}
              />
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

export default ResourceDetailScreen;
