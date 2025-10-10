export interface JellyfinServerInfo {
  readonly Version?: string;
  readonly ProductName?: string;
  readonly ProductVersion?: string;
  readonly ServerName?: string;
  readonly OperatingSystem?: string;
}

export interface JellyfinUserProfile {
  readonly Id: string;
  readonly Name?: string;
  readonly PrimaryImageTag?: string;
}

export type JellyfinCollectionType =
  | 'movies'
  | 'tvshows'
  | 'music'
  | 'playlists'
  | 'livetv'
  | 'folders'
  | 'boxsets'
  | 'unknown'
  | string;

export interface JellyfinImageTags {
  readonly Primary?: string;
  readonly Thumb?: string;
  readonly Banner?: string;
  readonly Logo?: string;
  readonly Art?: string;
  readonly Backdrop?: string;
}

export interface JellyfinLibraryView {
  readonly Id: string;
  readonly Name: string;
  readonly CollectionType?: JellyfinCollectionType;
  readonly ImageTags?: JellyfinImageTags;
  readonly PrimaryImageTag?: string;
}

export interface JellyfinUserData {
  readonly PlaybackPositionTicks?: number;
  readonly PlayedPercentage?: number;
  readonly PlayCount?: number;
  readonly Played?: boolean;
  readonly IsFavorite?: boolean;
  readonly LastPlayedDate?: string;
}

export interface JellyfinItem {
  readonly Id: string;
  readonly Name?: string;
  readonly OriginalTitle?: string;
  readonly Type?: string;
  readonly RunTimeTicks?: number;
  readonly IndexNumber?: number;
  readonly ParentIndexNumber?: number;
  readonly ProductionYear?: number;
  readonly PremiereDate?: string;
  readonly SeriesName?: string;
  readonly SeasonName?: string;
  readonly ParentId?: string;
  readonly Overview?: string;
  readonly OfficialRating?: string;
  readonly CommunityRating?: number;
  readonly CriticRating?: number;
  readonly MediaType?: string;
  readonly ImageTags?: JellyfinImageTags;
  readonly BackdropImageTags?: string[];
  readonly PrimaryImageTag?: string;
  readonly Genres?: string[];
  readonly Studios?: { readonly Name?: string }[];
  readonly Path?: string;
  readonly UserData?: JellyfinUserData;
  readonly SeriesId?: string;
  readonly SeasonId?: string;
  readonly ChannelId?: string;
  readonly MediaSources?: Array<{ readonly Id?: string; readonly Protocol?: string }>;
  readonly ProviderIds?: Record<string, string>;
}

export interface JellyfinItemsResponse<TItem = JellyfinItem> {
  readonly Items: readonly TItem[];
  readonly TotalRecordCount?: number;
}

export type JellyfinResumeItem = JellyfinItem;

export interface JellyfinLatestItem extends JellyfinItem {}

export interface JellyfinImageOptions {
  readonly tag?: string;
  readonly width?: number;
  readonly height?: number;
  readonly quality?: number;
  readonly fillWidth?: number;
  readonly fillHeight?: number;
  readonly blur?: number;
}
