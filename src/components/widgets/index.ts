export { default as WidgetContainer } from "./WidgetContainer/WidgetContainer";
export type { WidgetContainerProps } from "./WidgetContainer/WidgetContainer";
export { default as ServiceStatusWidget } from "./ServiceStatusWidget/ServiceStatusWidget";
export type { ServiceStatusWidgetProps } from "./ServiceStatusWidget/ServiceStatusWidget";
export { default as DownloadProgressWidget } from "./DownloadProgressWidget/DownloadProgressWidget";
export type { DownloadProgressWidgetProps } from "./DownloadProgressWidget/DownloadProgressWidget";
export { default as RecentActivityWidget } from "./RecentActivityWidget/RecentActivityWidget";
export { default as StatisticsWidget } from "./StatisticsWidget/StatisticsWidget";
export { default as CalendarPreviewWidget } from "./CalendarPreviewWidget/CalendarPreviewWidget";
export { default as BookmarksWidget } from "./BookmarksWidget/BookmarksWidget";
export type { BookmarksWidgetProps } from "./BookmarksWidget/BookmarksWidget.types";
export { default as RssWidget } from "./RssWidget/RssWidget";
export { default as RedditWidget } from "./RedditWidget/RedditWidget";
export { default as HackerNewsWidget } from "./HackerNewsWidget/HackerNewsWidget";
export { default as WeatherWidget } from "./WeatherWidget/WeatherWidget";
export { default as YouTubeWidget } from "./YouTubeWidget/YouTubeWidget";
export { default as TwitchWidget } from "./TwitchWidget/TwitchWidget";

// Re-export widget types
export type {
  Widget,
  WidgetType,
  WidgetData,
} from "@/services/widgets/WidgetService";
