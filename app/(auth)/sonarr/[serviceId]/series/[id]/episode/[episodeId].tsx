import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import EpisodeDetailsSheet from "@/components/sonarr/EpisodeDetailsSheet";
import type { Episode } from "@/models/media.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useSonarrSeriesDetails } from "@/hooks/useSonarrSeriesDetails";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EpisodeDetailsModal() {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const {
    serviceId,
    id: seriesIdStr,
    seasonNumber: seasonStr,
    episodeData,
    seriesTitle: paramSeriesTitle,
  } = useLocalSearchParams();

  const seriesId = Number(seriesIdStr);
  const seasonNumber = Number(seasonStr);
  const seriesTitle = (paramSeriesTitle || "Series") as string;

  // Recreate episode object from stringified data passed through params
  const episode: Episode | null = useMemo(() => {
    try {
      if (typeof episodeData === "string") {
        return JSON.parse(episodeData);
      }
    } catch (error) {
      console.error("Failed to parse episode data:", error);
    }
    return null;
  }, [episodeData]);

  const {
    toggleEpisodeMonitor,
    isTogglingEpisodeMonitor,
    searchMissingEpisode,
    isSearchingMissingEpisode,
    removeAndSearchEpisodeAsync,
    isRemovingAndSearching,
  } = useSonarrSeriesDetails({
    serviceId: (serviceId as string) ?? "",
    seriesId,
  });

  const serviceConfig = useMemo(() => {
    if (!serviceId) return undefined;
    const connector = ConnectorManager.getInstance().getConnector(
      serviceId as string,
    );
    return connector?.config;
  }, [serviceId]);

  const handleRemoveAndSearch = (
    episodeFileId: number,
    seasonNum: number,
    episodeNum: number,
  ) => {
    removeAndSearchEpisodeAsync(episodeFileId, seasonNum, episodeNum);
    router.back();
  };

  const handleSearchMissing = (seasonNum: number, episodeNum: number) => {
    searchMissingEpisode(seasonNum, episodeNum);
    router.back();
  };

  const handleToggleMonitor = (
    seasonNum: number,
    episodeNum: number,
    nextState: boolean,
  ) => {
    toggleEpisodeMonitor(seasonNum, episodeNum, nextState);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });

  if (!episode) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <EpisodeDetailsSheet
        episode={episode}
        seasonNumber={seasonNumber}
        seriesTitle={seriesTitle}
        serviceConfig={serviceConfig}
        contentId={seriesIdStr as string}
        onRemoveAndSearchPress={handleRemoveAndSearch}
        onSearchMissingPress={handleSearchMissing}
        onToggleMonitorPress={handleToggleMonitor}
        isRemovingAndSearching={isRemovingAndSearching}
        isSearchingMissing={isSearchingMissingEpisode}
        isTogglingMonitor={isTogglingEpisodeMonitor}
        onClose={() => router.back()}
      />
    </SafeAreaView>
  );
}
