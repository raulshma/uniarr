/**
 * Calendar and media release types for the universal calendar feature
 */

export type MediaType = 'movie' | 'series' | 'episode';

export type ReleaseStatus = 'upcoming' | 'released' | 'delayed' | 'cancelled';

export type CalendarView = 'month' | 'week' | 'day' | 'list';

export type CalendarServiceType = 'sonarr' | 'radarr' | 'jellyseerr';

export type CalendarMonitoredFilter = 'all' | 'monitored' | 'unmonitored';

export interface MediaRelease {
  readonly id: string;
  readonly title: string;
  readonly type: MediaType;
  readonly releaseDate: string; // ISO date string
  readonly status: ReleaseStatus;
  readonly posterUrl?: string;
  readonly backdropUrl?: string;
  readonly overview?: string;
  readonly genres?: string[];
  readonly runtime?: number; // in minutes
  readonly rating?: number; // 0-10 scale
  readonly voteCount?: number;
  readonly imdbId?: string;
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly network?: string;
  readonly year?: number;
  readonly seasonNumber?: number;
  readonly episodeNumber?: number;
  readonly seriesId?: string;
  readonly seriesTitle?: string;
  readonly monitored?: boolean;
  readonly downloadStatus?: 'missing' | 'queued' | 'downloading' | 'available' | 'unknown';
  readonly serviceId?: string;
  readonly serviceType?: CalendarServiceType;
}

export interface CalendarDay {
  readonly date: string; // ISO date string (YYYY-MM-DD)
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
  readonly releases: MediaRelease[];
}

export interface CalendarWeek {
  readonly weekNumber: number;
  readonly year: number;
  readonly days: CalendarDay[];
}

export interface CalendarMonth {
  readonly year: number;
  readonly month: number; // 1-12
  readonly weeks: CalendarWeek[];
  readonly totalReleases: number;
}

export interface CalendarFilters {
  readonly mediaTypes: MediaType[];
  readonly statuses: ReleaseStatus[];
  readonly services: string[];
  readonly serviceTypes: CalendarServiceType[];
  readonly monitoredStatus: CalendarMonitoredFilter;
  readonly dateRange?: {
    readonly start: string;
    readonly end: string;
  };
  readonly searchQuery?: string;
}

export interface CalendarState {
  readonly currentDate: string; // ISO date string
  readonly view: CalendarView;
  readonly selectedDate?: string;
  readonly filters: CalendarFilters;
  readonly isLoading: boolean;
  readonly error?: string;
}

export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly time?: string;
  readonly type: MediaType;
  readonly status: ReleaseStatus;
  readonly posterUrl?: string;
  readonly description?: string;
  readonly isMonitored?: boolean;
  readonly downloadStatus?: 'missing' | 'queued' | 'downloading' | 'available' | 'unknown';
}

export interface CalendarNavigation {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly currentPeriod: string; // e.g., "January 2024", "Week of Jan 1, 2024"
  readonly goToPrevious: () => void;
  readonly goToNext: () => void;
  readonly goToToday: () => void;
  readonly goToDate: (date: string) => void;
}

export interface CalendarStats {
  readonly totalReleases: number;
  readonly upcomingReleases: number;
  readonly releasedThisWeek: number;
  readonly monitoredReleases: number;
  readonly byType: Record<MediaType, number>;
  readonly byStatus: Record<ReleaseStatus, number>;
}