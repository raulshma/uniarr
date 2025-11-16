import { z } from "zod";
import type { ToolDefinition, ToolResult, ToolServiceType } from "./types";
import { ToolError, ToolErrorCategory, dateStringSchema } from "./types";
import { ToolContext } from "./ToolContext";
import { logger } from "@/services/logger/LoggerService";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";

/**
 * Parameters for the CalendarTool
 */
const calendarParamsSchema = z.object({
  startDate: dateStringSchema
    .optional()
    .describe(
      "Start date for calendar range (ISO format or relative like 'today', 'tomorrow', 'this week')",
    ),
  endDate: dateStringSchema
    .optional()
    .describe(
      "End date for calendar range (ISO format or relative like 'today', 'next week')",
    ),
  serviceType: z
    .enum(["sonarr", "radarr"])
    .optional()
    .describe(
      "Filter by service type (sonarr for TV shows, radarr for movies)",
    ),
  monitoredOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Filter to show only monitored items (actively tracked)"),
  qualityProfileId: z
    .number()
    .optional()
    .describe("Filter by quality profile ID"),
  groupBy: z
    .enum(["none", "day", "week", "month"])
    .optional()
    .default("none")
    .describe(
      "Group calendar events by time period: none (chronological list), day, week, or month",
    ),
});

type CalendarParams = z.infer<typeof calendarParamsSchema>;

/**
 * Unified calendar event structure for tool results
 */
interface CalendarEvent {
  id: number;
  title: string;
  releaseDate: string;
  mediaType: "series" | "movie";
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  overview?: string;
  posterUrl?: string;
  hasFile?: boolean;
  monitored: boolean;
  serviceId: string;
  serviceName: string;
  serviceType: ToolServiceType;
  qualityProfileId?: number;
}

/**
 * Grouped calendar events by time period
 */
interface GroupedCalendarEvents {
  [key: string]: CalendarEvent[];
}

/**
 * Result data structure for CalendarTool
 */
interface CalendarResult {
  events?: CalendarEvent[];
  groupedEvents?: GroupedCalendarEvents;
  totalCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  serviceTypes: string[];
  message: string;
  groupBy?: string;
}

/**
 * CalendarTool - Retrieve upcoming media releases from calendar
 *
 * This tool allows the LLM to query the user's media calendar across
 * configured services (Sonarr, Radarr) and retrieve information about
 * upcoming TV episodes and movie releases.
 *
 * @example
 * ```typescript
 * // Get releases for this week
 * const result = await execute({
 *   startDate: 'today',
 *   endDate: 'this week'
 * });
 *
 * // Get movie releases for next month
 * const result = await execute({
 *   serviceType: 'radarr',
 *   startDate: 'today',
 *   endDate: 'next month'
 * });
 * ```
 */
export const calendarTool: ToolDefinition<CalendarParams, CalendarResult> = {
  name: "get_calendar",
  description:
    "Get upcoming media releases from the calendar. Returns TV episodes and movie releases scheduled within the specified date range. Supports natural language dates like 'today', 'tomorrow', 'this week', 'next month'.",
  parameters: calendarParamsSchema,

  async execute(params: CalendarParams): Promise<ToolResult<CalendarResult>> {
    const startTime = Date.now();
    const context = ToolContext.getInstance();
    const connectorManager = context.getConnectorManager();

    try {
      void logger.debug("CalendarTool execution started", { params });

      // Parse date parameters with defaults
      const { startDate, endDate } = parseDateRange(context, params);

      void logger.debug("CalendarTool date range parsed", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Collect all calendar events from relevant connectors
      const allEvents: CalendarEvent[] = [];
      const serviceTypes = new Set<string>();

      // Determine which connectors to query
      const serviceTypesToQuery: ToolServiceType[] = [];
      if (!params.serviceType || params.serviceType === "sonarr") {
        serviceTypesToQuery.push("sonarr");
      }
      if (!params.serviceType || params.serviceType === "radarr") {
        serviceTypesToQuery.push("radarr");
      }

      // Query each service type
      for (const serviceType of serviceTypesToQuery) {
        const connectors = connectorManager.getConnectorsByType(serviceType);

        if (connectors.length === 0) {
          continue; // Skip if no connectors configured for this type
        }

        // Query each connector
        await Promise.all(
          connectors.map(async (connector) => {
            try {
              const events = await fetchCalendarEvents(
                connector as SonarrConnector | RadarrConnector,
                serviceType,
                startDate,
                endDate,
              );
              allEvents.push(...events);
              serviceTypes.add(serviceType);
            } catch (error) {
              // Log error but continue with other connectors
              void logger.warn("Failed to fetch calendar from connector", {
                serviceId: connector.config.id,
                serviceType,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }),
        );
      }

      if (serviceTypes.size === 0) {
        // No connectors configured
        const serviceTypeHint = params.serviceType
          ? params.serviceType === "sonarr"
            ? "Sonarr"
            : "Radarr"
          : "Sonarr or Radarr";

        throw new ToolError(
          `No ${serviceTypeHint} services configured`,
          ToolErrorCategory.SERVICE_NOT_CONFIGURED,
          `Please add a ${serviceTypeHint} service in Settings > Services to view calendar events.`,
          {
            requestedServiceType: params.serviceType,
          },
        );
      }

      // Apply advanced filters
      let filteredEvents = applyCalendarFilters(allEvents, params);

      // Sort events chronologically
      const sortedEvents = filteredEvents.sort((a, b) => {
        const dateA = new Date(a.releaseDate).getTime();
        const dateB = new Date(b.releaseDate).getTime();
        return dateA - dateB;
      });

      const message = generateResultMessage(
        sortedEvents.length,
        startDate,
        endDate,
        params.serviceType,
      );

      void logger.debug("CalendarTool execution completed", {
        totalEvents: sortedEvents.length,
        serviceTypes: Array.from(serviceTypes),
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });

      // Group events if requested
      if (params.groupBy && params.groupBy !== "none") {
        const groupedEvents = groupCalendarEvents(sortedEvents, params.groupBy);

        return {
          success: true,
          data: {
            groupedEvents,
            totalCount: sortedEvents.length,
            dateRange: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
            serviceTypes: Array.from(serviceTypes),
            message,
            groupBy: params.groupBy,
          },
          metadata: {
            executionTime: Date.now() - startTime,
            serviceTypes: Array.from(serviceTypes),
          },
        };
      }

      return {
        success: true,
        data: {
          events: sortedEvents,
          totalCount: sortedEvents.length,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          serviceTypes: Array.from(serviceTypes),
          message,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          serviceTypes: Array.from(serviceTypes),
        },
      };
    } catch (error) {
      void logger.error("CalendarTool execution failed", {
        params,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ToolError) {
        return {
          success: false,
          error: error.toUserMessage(),
          metadata: {
            executionTime: Date.now() - startTime,
            errorCategory: error.category,
          },
        };
      }

      return {
        success: false,
        error: context.formatError(error),
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse date range parameters with defaults
 */
function parseDateRange(
  context: ToolContext,
  params: CalendarParams,
): { startDate: Date; endDate: Date } {
  // Default to current date if startDate not provided
  const startDate = params.startDate
    ? context.parseRelativeDate(params.startDate)
    : new Date();

  // Default to 7 days ahead if endDate not provided
  const endDate = params.endDate
    ? context.parseRelativeDate(params.endDate)
    : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { startDate, endDate };
}

/**
 * Fetch calendar events from a connector
 */
async function fetchCalendarEvents(
  connector: SonarrConnector | RadarrConnector,
  serviceType: ToolServiceType,
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  const serviceId = connector.config.id;
  const serviceName = connector.config.name;

  // Format dates as ISO strings for API
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  if (serviceType === "sonarr") {
    const sonarrConnector = connector as SonarrConnector;
    const episodes = await sonarrConnector.getCalendar(startStr, endStr, false);

    return episodes.map((episode) => ({
      id: episode.id ?? 0,
      title: episode.series?.title ?? "Unknown Series",
      releaseDate: episode.airDateUtc ?? "",
      mediaType: "series" as const,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title ?? undefined,
      // Truncate overview to reduce token usage
      overview: episode.overview
        ? episode.overview.length > 150
          ? `${episode.overview.substring(0, 150)}...`
          : episode.overview
        : undefined,
      posterUrl:
        episode.series?.images?.find((img) => img.coverType === "poster")
          ?.remoteUrl ?? undefined,
      hasFile: episode.hasFile,
      monitored: episode.monitored ?? false,
      serviceId,
      serviceName,
      serviceType,
      qualityProfileId: episode.series?.qualityProfileId,
    }));
  } else if (serviceType === "radarr") {
    const radarrConnector = connector as RadarrConnector;
    const movies = await radarrConnector.getCalendar(startStr, endStr, false);

    return movies.map((movie) => ({
      id: movie.id ?? 0,
      title: movie.title ?? "Unknown Movie",
      releaseDate:
        movie.inCinemas ?? movie.digitalRelease ?? movie.physicalRelease ?? "",
      mediaType: "movie" as const,
      // Truncate overview to reduce token usage
      overview: movie.overview
        ? movie.overview.length > 150
          ? `${movie.overview.substring(0, 150)}...`
          : movie.overview
        : undefined,
      posterUrl:
        movie.images?.find((img) => img.coverType === "poster")?.remoteUrl ??
        undefined,
      hasFile: movie.hasFile ?? false,
      monitored: movie.monitored ?? false,
      serviceId,
      serviceName,
      serviceType,
      qualityProfileId: movie.qualityProfileId,
    }));
  }

  return [];
}

/**
 * Apply advanced filters to calendar events
 */
function applyCalendarFilters(
  events: CalendarEvent[],
  params: CalendarParams,
): CalendarEvent[] {
  let filtered = events;

  // Filter by monitored status
  if (params.monitoredOnly) {
    filtered = filtered.filter((event) => event.monitored === true);
  }

  // Filter by quality profile ID
  if (params.qualityProfileId !== undefined) {
    filtered = filtered.filter(
      (event) => event.qualityProfileId === params.qualityProfileId,
    );
  }

  return filtered;
}

/**
 * Group calendar events by time period
 */
function groupCalendarEvents(
  events: CalendarEvent[],
  groupBy: "day" | "week" | "month",
): GroupedCalendarEvents {
  const grouped: GroupedCalendarEvents = {};

  for (const event of events) {
    const date = new Date(event.releaseDate);
    let key: string;

    switch (groupBy) {
      case "day":
        key = date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        break;

      case "week": {
        // Get the start of the week (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        key = `Week of ${weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} - ${weekEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
        break;
      }

      case "month":
        key = date.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        break;

      default:
        key = "Unknown";
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key]!.push(event);
  }

  return grouped;
}

/**
 * Generate a user-friendly result message
 */
function generateResultMessage(
  eventCount: number,
  startDate: Date,
  endDate: Date,
  serviceType?: "sonarr" | "radarr",
): string {
  const mediaTypeStr = serviceType
    ? serviceType === "sonarr"
      ? "TV episodes"
      : "movies"
    : "releases";

  if (eventCount === 0) {
    return `No ${mediaTypeStr} scheduled between ${formatDate(startDate)} and ${formatDate(endDate)}.`;
  }

  return `Found ${eventCount} ${mediaTypeStr} scheduled between ${formatDate(startDate)} and ${formatDate(endDate)}.`;
}

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (dateOnly.getTime() === today.getTime()) {
    return "today";
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return "tomorrow";
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}
