import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { alert } from '@/services/dialogService';
import { SafeAreaView } from "react-native-safe-area-context";
import {
  IconButton,
  Portal,
  Dialog,
  Button as PaperButton,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { TabHeader } from "@/components/common/TabHeader";
import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import type { AppTheme } from "@/constants/theme";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";
import type { DiscoverMediaItem } from "@/models/discover.types";
import { spacing } from "@/theme/spacing";

const placeholderText = "Search for movies, shows, and more";

const DiscoverCard = ({
  item,
  onAdd,
  onPress,
}: {
  item: DiscoverMediaItem;
  onAdd: (media: DiscoverMediaItem) => void;
  onPress: (media: DiscoverMediaItem) => void;
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: 152,
          marginRight: spacing.md,
        },
        posterWrapper: {
          marginBottom: spacing.xs,
        },
        title: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleSmall.fontSize,
          fontFamily: theme.custom.typography.titleSmall.fontFamily,
          lineHeight: theme.custom.typography.titleSmall.lineHeight,
          letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
          fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
        },
        addButton: {
          position: "absolute",
          top: spacing.xs,
          right: spacing.xs,
          backgroundColor: theme.colors.primary,
        },
      }),
    [theme]
  );

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={styles.container}
      accessibilityRole="button"
    >
      <View style={styles.posterWrapper}>
        <MediaPoster uri={item.posterUrl} size={152} />
        <IconButton
          icon="plus"
          size={20}
          mode="contained"
          style={styles.addButton}
          iconColor={theme.colors.onPrimary}
          onPress={() => onAdd(item)}
          accessibilityLabel={`Add ${item.title}`}
        />
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {item.title}
      </Text>
    </Pressable>
  );
};

const DiscoverScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const { sections, services, isLoading, isFetching, isError, error, refetch } =
    useUnifiedDiscover();

  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogItem, setDialogItem] = useState<DiscoverMediaItem | undefined>(
    undefined
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          gap: spacing.lg,
        },
        searchBar: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.colors.elevation.level2,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 24,
        },
        searchPlaceholder: {
          flex: 1,
          marginLeft: spacing.sm,
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyLarge.fontSize,
          fontFamily: theme.custom.typography.bodyLarge.fontFamily,
        },
        sectionsContainer: {
          gap: spacing.lg,
        },
        searchBarWrapper: {
          marginBottom: spacing.lg,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontFamily: theme.custom.typography.titleLarge.fontFamily,
          lineHeight: theme.custom.typography.titleLarge.lineHeight,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
          fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
        },
        sectionSubtitle: {
          color: theme.colors.onSurfaceVariant,
        },
        listContent: {
          paddingRight: spacing.md,
        },
        dialogContent: {
          paddingVertical: spacing.sm,
        },
        dialogRadio: {
          paddingVertical: spacing.xs,
        },
        emptyWrapper: {
          marginTop: spacing.xl,
        },
      }),
    [theme]
  );

  const isRefreshing = isFetching && !isLoading;

  const openUnifiedSearch = useCallback(() => {
    router.push("/(auth)/search");
  }, [router]);

  const openSettings = useCallback(() => {
    router.push("/(auth)/(tabs)/settings");
  }, [router]);

  const openServicePicker = useCallback(
    (item: DiscoverMediaItem) => {
      const options =
        item.mediaType === "series" ? services.sonarr : services.radarr;
      if (!options.length) {
        alert(
          "No services available",
          `Add a ${
            item.mediaType === "series" ? "Sonarr" : "Radarr"
          } service first to request this title.`
        );
        return;
      }

      setDialogItem(item);
      setSelectedServiceId((current) => {
        if (current && options.some((service) => service.id === current)) {
          return current;
        }
        return options[0]?.id ?? "";
      });
      setDialogVisible(true);
    },
    [services]
  );

  const handleCardPress = useCallback(
    (item: DiscoverMediaItem) => {
      // Navigate to unified search and prefill with the selected item's title/ids
      const params: Record<string, string> = { query: item.title };
      if (item.tmdbId) {
        params.tmdbId = String(item.tmdbId);
      }
      if (item.tvdbId) {
        params.tvdbId = String(item.tvdbId);
      }
      if (item.mediaType) {
        params.mediaType = item.mediaType;
      }

      router.push({ pathname: "/(auth)/search", params });
    },
    [router]
  );

  const handleDialogDismiss = useCallback(() => {
    setDialogVisible(false);
    setDialogItem(undefined);
  }, []);

  const handleConfirmAdd = useCallback(() => {
    if (!dialogItem || !selectedServiceId) {
      handleDialogDismiss();
      return;
    }

    const params: Record<string, string> = {
      serviceId: selectedServiceId,
      query: dialogItem.title,
    };

    if (dialogItem.tmdbId) {
      params.tmdbId = String(dialogItem.tmdbId);
    }

    if (dialogItem.tvdbId) {
      params.tvdbId = String(dialogItem.tvdbId);
    }

    if (dialogItem.mediaType === "series") {
      router.push({ pathname: "/(auth)/sonarr/[serviceId]/add", params });
    } else {
      router.push({ pathname: "/(auth)/radarr/[serviceId]/add", params });
    }

    handleDialogDismiss();
  }, [dialogItem, handleDialogDismiss, router, selectedServiceId]);

  const renderSection = useCallback(
    (
      sectionTitle: string,
      subtitle: string | undefined,
      items: DiscoverMediaItem[]
    ) => (
      <View>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            {subtitle ? (
              <Text style={styles.sectionSubtitle}>{subtitle}</Text>
            ) : null}
          </View>
          <PaperButton
            mode="text"
            compact
            onPress={openUnifiedSearch}
            textColor={theme.colors.primary}
          >
            View all
          </PaperButton>
        </View>
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <DiscoverCard
              item={item}
              onPress={handleCardPress}
              onAdd={openServicePicker}
            />
          )}
        />
      </View>
    ),
    [
      handleCardPress,
      openServicePicker,
      openUnifiedSearch,
      styles.listContent,
      styles.sectionHeader,
      styles.sectionSubtitle,
      styles.sectionTitle,
      theme.colors.primary,
    ]
  );

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader
        title="Discover"
        showTitle={true}
        rightAction={{
          icon: "cog",
          onPress: openSettings,
          accessibilityLabel: "Open settings",
        }}
      />

      <FlatList
        data={sections}
        keyExtractor={(section) => section.id}
        renderItem={({ item }) =>
          renderSection(item.title, item.subtitle, item.items)
        }
        contentContainerStyle={[styles.content, styles.sectionsContainer]}
        ListHeaderComponent={
          <View style={styles.searchBarWrapper}>
            <Pressable
              style={styles.searchBar}
              onPress={openUnifiedSearch}
              accessibilityRole="button"
            >
              <IconButton
                icon="magnify"
                size={24}
                onPress={openUnifiedSearch}
                accessibilityLabel="Open search"
              />
              <Text style={styles.searchPlaceholder}>{placeholderText}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            {isLoading ? (
              <EmptyState
                title="Loading recommendations"
                description="Fetching popular titles across your services."
              />
            ) : isError ? (
              <EmptyState
                title="Unable to load recommendations"
                description={
                  error instanceof Error
                    ? error.message
                    : "Try refreshing to retry the request."
                }
                actionLabel="Retry"
                onActionPress={() => void refetch()}
              />
            ) : (
              <EmptyState
                title="No recommendations yet"
                description="Configure Jellyseerr to see trending picks or refresh to try again."
                actionLabel="Refresh"
                onActionPress={() => void refetch()}
              />
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refetch()}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDialogDismiss}>
          <Dialog.Title>Add to service</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              Choose where to add{" "}
              <Text style={{ fontWeight: "600" }}>{dialogItem?.title}</Text>
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setSelectedServiceId(value)}
              value={selectedServiceId}
            >
              {(dialogItem?.mediaType === "series"
                ? services.sonarr
                : services.radarr
              ).map((service) => (
                <RadioButton.Item
                  key={service.id}
                  value={service.id}
                  label={service.name}
                  style={styles.dialogRadio}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={handleDialogDismiss}>Cancel</PaperButton>
            <PaperButton
              onPress={handleConfirmAdd}
              disabled={!selectedServiceId}
            >
              Add
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default DiscoverScreen;
