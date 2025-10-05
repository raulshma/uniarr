export type JellyseerrMediaType = 'movie' | 'tv';

export type JellyseerrRequestStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'processing'
  | 'available'
  | 'unknown';

export type JellyseerrRequestFilter =
  | 'all'
  | 'pending'
  | 'approved'
  | 'declined'
  | 'processing'
  | 'available';

export interface JellyseerrUserSummary {
  readonly id: number;
  readonly email?: string;
  readonly username?: string;
  readonly plexUsername?: string;
  readonly displayName?: string;
  readonly avatar?: string;
}

export interface JellyseerrSeasonRequestStatus {
  readonly id?: number;
  readonly seasonNumber: number;
  readonly status: JellyseerrRequestStatus;
  readonly isRequested: boolean;
  readonly isApproved?: boolean;
  readonly isAvailable?: boolean;
}

export interface JellyseerrSeasonSummary {
  readonly seasonNumber: number;
  readonly episodeCount?: number;
  readonly airDate?: string;
  readonly name?: string;
  readonly overview?: string;
  readonly posterUrl?: string;
  readonly status?: JellyseerrRequestStatus;
}

export interface JellyseerrMediaSummary {
  readonly id?: number;
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly mediaType: JellyseerrMediaType;
  readonly title?: string;
  readonly originalTitle?: string;
  readonly alternateTitles?: string[];
  readonly overview?: string;
  readonly tagline?: string;
  readonly posterUrl?: string;
  readonly backdropUrl?: string;
  readonly releaseDate?: string;
  readonly firstAirDate?: string;
  readonly status?: JellyseerrRequestStatus;
  readonly rating?: number;
  readonly voteCount?: number;
  readonly popularity?: number;
  readonly runtime?: number;
  readonly network?: string;
  readonly genres?: string[];
  readonly studios?: string[];
  readonly certification?: string;
  readonly seasons?: JellyseerrSeasonSummary[];
  readonly externalUrl?: string;
}

export interface JellyseerrRequest {
  readonly id: number;
  readonly mediaType: JellyseerrMediaType;
  readonly status: JellyseerrRequestStatus;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly requestedBy?: JellyseerrUserSummary;
  readonly is4k?: boolean;
  readonly requestedSeasons?: JellyseerrSeasonRequestStatus[];
  readonly media: JellyseerrMediaSummary;
}

export interface JellyseerrPagedResult<TItem> {
  readonly items: TItem[];
  readonly total: number;
  readonly pageInfo?: {
    readonly page?: number;
    readonly pageSize?: number;
    readonly pages?: number;
    readonly results?: number;
    readonly totalResults?: number;
  };
}

export type JellyseerrRequestList = JellyseerrPagedResult<JellyseerrRequest>;

export interface JellyseerrRequestQueryOptions {
  take?: number;
  skip?: number;
  filter?: JellyseerrRequestFilter | 'processing';
  is4k?: boolean;
  includePending4k?: boolean;
  search?: string;
}

export interface CreateJellyseerrRequest {
  readonly mediaId: number;
  readonly mediaType: JellyseerrMediaType;
  readonly tvdbId?: number;
  readonly is4k?: boolean;
  readonly seasons?: number[] | 'all';
  readonly serverId?: number;
  readonly profileId?: number;
  readonly rootFolder?: string;
  readonly languageProfileId?: number;
  readonly userId?: number;
  readonly tags?: number[];
}

export interface JellyseerrApprovalOptions {
  readonly is4k?: boolean;
  readonly seasonIds?: number[];
}

export interface JellyseerrDeclineOptions {
  readonly is4k?: boolean;
  readonly seasonIds?: number[];
  readonly reason?: string;
}

export interface JellyseerrSearchResult {
  readonly id: number;
  readonly mediaType: JellyseerrMediaType;
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly title: string;
  readonly overview?: string;
  readonly releaseDate?: string;
  readonly firstAirDate?: string;
  readonly backdropUrl?: string;
  readonly posterUrl?: string;
  readonly rating?: number;
  readonly popularity?: number;
  readonly isRequested?: boolean;
  readonly mediaStatus?: JellyseerrRequestStatus;
}
