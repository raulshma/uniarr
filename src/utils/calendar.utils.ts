import type { MediaRelease, CalendarDay, CalendarWeek, CalendarMonth } from '@/models/calendar.types';

/**
 * Utility functions for calendar operations
 */

export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
};

export const formatDateDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatRelativeDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffTime = dateObj.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const isToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return formatDate(dateObj) === formatDate(today);
};

export const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
  return formatDate(date1) === formatDate(date2);
};

export const getStartOfWeek = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
  const startOfWeek = new Date(dateObj);
  startOfWeek.setDate(dateObj.getDate() - dateObj.getDay());
  return startOfWeek;
};

export const getEndOfWeek = (date: Date | string): Date => {
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return endOfWeek;
};

export const getStartOfMonth = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
};

export const getEndOfMonth = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
};

export const addDays = (date: Date | string, days: number): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
  const newDate = new Date(dateObj);
  newDate.setDate(dateObj.getDate() + days);
  return newDate;
};

export const addMonths = (date: Date | string, months: number): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
  const newDate = new Date(dateObj);
  newDate.setMonth(dateObj.getMonth() + months);
  return newDate;
};

export const getWeekNumber = (date: Date | string): number => {
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
  const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
  const pastDaysOfYear = (dateObj.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
};

export const groupReleasesByDate = (releases: MediaRelease[]): { [date: string]: MediaRelease[] } => {
  const grouped: { [date: string]: MediaRelease[] } = {};
  
  releases.forEach(release => {
    if (!grouped[release.releaseDate]) {
      grouped[release.releaseDate] = [];
    }
    grouped[release.releaseDate].push(release);
  });

  // Sort releases within each date by title
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => a.title.localeCompare(b.title));
  });

  return grouped;
};

export const sortReleasesByDate = (releases: MediaRelease[]): MediaRelease[] => {
  return [...releases].sort((a, b) => {
    const dateA = new Date(a.releaseDate).getTime();
    const dateB = new Date(b.releaseDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.title.localeCompare(b.title);
  });
};

export const filterReleasesByDateRange = (
  releases: MediaRelease[],
  startDate: string,
  endDate: string
): MediaRelease[] => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  
  return releases.filter(release => {
    const releaseDate = new Date(release.releaseDate).getTime();
    return releaseDate >= start && releaseDate <= end;
  });
};

export const getReleasesForDate = (releases: MediaRelease[], date: string): MediaRelease[] => {
  return releases.filter(release => release.releaseDate === date);
};

export const getReleasesForWeek = (releases: MediaRelease[], date: string): MediaRelease[] => {
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = getEndOfWeek(date);
  return filterReleasesByDateRange(
    releases,
    formatDate(startOfWeek),
    formatDate(endOfWeek)
  );
};

export const getReleasesForMonth = (releases: MediaRelease[], date: string): MediaRelease[] => {
  const startOfMonth = getStartOfMonth(date);
  const endOfMonth = getEndOfMonth(date);
  return filterReleasesByDateRange(
    releases,
    formatDate(startOfMonth),
    formatDate(endOfMonth)
  );
};

export const validateDateString = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
};

export const getDateRangeForView = (currentDate: string, view: 'month' | 'week' | 'day'): { start: string; end: string } => {
  switch (view) {
    case 'month':
      return {
        start: formatDate(getStartOfMonth(currentDate)),
        end: formatDate(getEndOfMonth(currentDate)),
      };
    case 'week':
      return {
        start: formatDate(getStartOfWeek(currentDate)),
        end: formatDate(getEndOfWeek(currentDate)),
      };
    case 'day':
      return {
        start: currentDate,
        end: currentDate,
      };
    default:
      return {
        start: formatDate(getStartOfMonth(currentDate)),
        end: formatDate(getEndOfMonth(currentDate)),
      };
  }
};