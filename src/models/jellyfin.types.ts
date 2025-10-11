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

export interface JellyfinPerson {
  readonly Id: string;
  readonly Name?: string;
  readonly Type?: string;
  readonly Role?: string;
  readonly PrimaryImageTag?: string;
}

export interface JellyfinMediaStream {
  readonly Index?: number;
  readonly Type?: string;
  readonly Codec?: string;
  readonly Language?: string;
  readonly IsDefault?: boolean;
  readonly IsForced?: boolean;
  readonly DisplayTitle?: string;
  readonly ChannelLayout?: string;
  readonly BitRate?: number;
}

export interface JellyfinMediaSource {
  readonly Id?: string;
  readonly Protocol?: string;
  readonly MediaStreams?: readonly JellyfinMediaStream[];
  readonly RunTimeTicks?: number;
  readonly Container?: string;
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
  readonly MediaSources?: readonly JellyfinMediaSource[];
  readonly ProviderIds?: Record<string, string>;
  readonly Taglines?: readonly string[];
  readonly People?: readonly JellyfinPerson[];
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

export interface JellyfinSessionPlayState {
  readonly PositionTicks?: number;
  readonly RunTimeTicks?: number;
  readonly VolumeLevel?: number;
  readonly IsPaused?: boolean;
  readonly RepeatMode?: string;
  // Playback-specific identifiers exposed by some clients/servers. These may
  // be necessary when issuing playstate commands if the session 'Id' is
  // unavailable or different from the immediate playback identifier.
  readonly PlaySessionId?: string;
  readonly LiveStreamId?: string;
}

export interface JellyfinSession {
  readonly Id: string;
  readonly DeviceName?: string;
  readonly Client?: string;
  readonly UserId?: string;
  readonly UserName?: string;
  readonly PlayState?: JellyfinSessionPlayState;
  readonly NowPlayingItem?: JellyfinItem;
  // Some Jellyfin server responses include a NowViewingItem when the client
  // reports viewing state rather than playing state. Include it so callers
  // can fall back to this field when NowPlayingItem is not populated.
  readonly NowViewingItem?: JellyfinItem;
  // Whether the session is currently considered active by the server.
  readonly IsActive?: boolean;
  readonly AdditionalUsers?: readonly { readonly UserId?: string; readonly UserName?: string }[];
}
