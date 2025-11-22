import * as FileSystem from "expo-file-system/legacy";
import type { AggregatedHealth } from "@/services/health/HealthAggregationService";
import type { AggregatedMetrics } from "@/services/metrics/MetricsEngine";

/**
 * Format file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

/**
 * Report format options
 */
export type ReportFormat = "html" | "text";

/**
 * Report generation options
 */
export interface ReportOptions {
  /** Report format */
  format?: ReportFormat;
  /** Report title */
  title?: string;
  /** Include detailed metrics */
  includeMetrics?: boolean;
  /** Include health messages */
  includeHealthMessages?: boolean;
}

/**
 * Report generation result
 */
export interface ReportResult {
  /** File URI where the report was saved */
  uri: string;
  /** File size in bytes */
  size: number;
  /** Report format */
  format: ReportFormat;
}

/**
 * Generate health status summary report
 *
 * @param health - Aggregated health data
 * @param metrics - Optional aggregated metrics data
 * @param options - Report generation options
 * @returns Report result with file URI and metadata
 */
export async function generateHealthReport(
  health: AggregatedHealth,
  metrics?: AggregatedMetrics,
  options: ReportOptions = {},
): Promise<ReportResult> {
  const {
    format = "html",
    title = "Service Health Report",
    includeMetrics = true,
    includeHealthMessages = true,
  } = options;

  let content: string;
  let fileExtension: string;

  if (format === "html") {
    content = generateHTMLReport(
      health,
      metrics,
      title,
      includeMetrics,
      includeHealthMessages,
    );
    fileExtension = "html";
  } else {
    content = generateTextReport(
      health,
      metrics,
      title,
      includeMetrics,
      includeHealthMessages,
    );
    fileExtension = "txt";
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `health-report-${timestamp}.${fileExtension}`;

  // Save to cache directory
  const cacheDir = FileSystem.cacheDirectory || "";
  const uri = `${cacheDir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content);

  const size = new Blob([content]).size;

  return {
    uri,
    size,
    format,
  };
}

/**
 * Generate HTML format report
 */
function generateHTMLReport(
  health: AggregatedHealth,
  metrics: AggregatedMetrics | undefined,
  title: string,
  includeMetrics: boolean,
  includeHealthMessages: boolean,
): string {
  const html: string[] = [];

  // HTML header
  html.push("<!DOCTYPE html>");
  html.push("<html>");
  html.push("<head>");
  html.push(`<title>${escapeHtml(title)}</title>`);
  html.push("<meta charset='UTF-8'>");
  html.push("<style>");
  html.push(`
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { margin: 0 0 10px 0; color: #333; }
    .timestamp { color: #666; font-size: 14px; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-healthy { background: #4caf50; color: white; }
    .status-degraded { background: #ff9800; color: white; }
    .status-offline { background: #f44336; color: white; }
    .status-unknown { background: #9e9e9e; color: white; }
    .section {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h2 { margin-top: 0; color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    .service-card {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .service-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .service-name { font-weight: 600; font-size: 16px; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .metric-card {
      background: #f9f9f9;
      padding: 12px;
      border-radius: 4px;
      border-left: 3px solid #2196f3;
    }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .metric-value { font-size: 24px; font-weight: 600; color: #333; }
    .message {
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 8px;
      border-left: 3px solid;
    }
    .message-critical { background: #ffebee; border-color: #f44336; }
    .message-error { background: #fff3e0; border-color: #ff9800; }
    .message-warning { background: #fff9c4; border-color: #ffc107; }
    .message-info { background: #e3f2fd; border-color: #2196f3; }
    .message-text { margin: 0; font-size: 14px; }
    .message-source { font-size: 12px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f5f5f5; font-weight: 600; }
  `);
  html.push("</style>");
  html.push("</head>");
  html.push("<body>");

  // Header
  html.push("<div class='header'>");
  html.push(`<h1>${escapeHtml(title)}</h1>`);
  html.push(
    `<div class='timestamp'>Generated: ${health.lastUpdated.toLocaleString()}</div>`,
  );
  html.push(
    `<div style='margin-top: 10px;'>Overall Status: <span class='status-badge status-${health.overall}'>${health.overall.toUpperCase()}</span></div>`,
  );
  html.push("</div>");

  // Summary section
  html.push("<div class='section'>");
  html.push("<h2>Summary</h2>");
  html.push(
    `<p><strong>Total Services:</strong> ${health.services.length}</p>`,
  );

  const healthyCount = health.services.filter(
    (s) => s.status === "healthy",
  ).length;
  const degradedCount = health.services.filter(
    (s) => s.status === "degraded",
  ).length;
  const offlineCount = health.services.filter(
    (s) => s.status === "offline",
  ).length;

  html.push(
    `<p><strong>Healthy:</strong> ${healthyCount} | <strong>Degraded:</strong> ${degradedCount} | <strong>Offline:</strong> ${offlineCount}</p>`,
  );
  html.push(
    `<p><strong>Critical Issues:</strong> ${health.criticalIssues.length}</p>`,
  );
  html.push(`<p><strong>Warnings:</strong> ${health.warnings.length}</p>`);
  html.push("</div>");

  // Services section
  html.push("<div class='section'>");
  html.push("<h2>Service Status</h2>");

  for (const service of health.services) {
    html.push("<div class='service-card'>");
    html.push("<div class='service-header'>");
    html.push(
      `<div class='service-name'>${escapeHtml(service.serviceName)}</div>`,
    );
    html.push(
      `<span class='status-badge status-${service.status}'>${service.status.toUpperCase()}</span>`,
    );
    html.push("</div>");
    html.push(
      `<div style='font-size: 12px; color: #666;'>Type: ${service.serviceType} | Last Checked: ${service.lastChecked.toLocaleString()}</div>`,
    );

    if (includeHealthMessages && service.messages.length > 0) {
      html.push("<div style='margin-top: 10px;'>");
      for (const message of service.messages) {
        html.push(`<div class='message message-${message.severity}'>`);
        html.push(`<p class='message-text'>${escapeHtml(message.message)}</p>`);
        if (message.source) {
          html.push(
            `<div class='message-source'>Source: ${escapeHtml(message.source)}</div>`,
          );
        }
        html.push("</div>");
      }
      html.push("</div>");
    }

    html.push("</div>");
  }

  html.push("</div>");

  // Metrics section
  if (includeMetrics && metrics) {
    html.push("<div class='section'>");
    html.push("<h2>Metrics Overview</h2>");

    html.push("<div class='metric-grid'>");
    html.push("<div class='metric-card'>");
    html.push("<div class='metric-label'>Average Uptime</div>");
    html.push(
      `<div class='metric-value'>${metrics.overall.averageUptime.toFixed(1)}%</div>`,
    );
    html.push("</div>");

    html.push("<div class='metric-card'>");
    html.push("<div class='metric-label'>Total Errors</div>");
    html.push(`<div class='metric-value'>${metrics.overall.totalErrors}</div>`);
    html.push("</div>");

    html.push("<div class='metric-card'>");
    html.push("<div class='metric-label'>Healthy Services</div>");
    html.push(
      `<div class='metric-value'>${metrics.overall.healthyServices}/${metrics.overall.totalServices}</div>`,
    );
    html.push("</div>");
    html.push("</div>");

    // Service-specific metrics
    if (metrics.services.length > 0) {
      html.push("<h3 style='margin-top: 20px;'>Service Metrics</h3>");

      for (const serviceMetrics of metrics.services) {
        html.push("<div class='service-card'>");
        html.push(
          `<div class='service-name'>${escapeHtml(serviceMetrics.serviceName)}</div>`,
        );

        html.push("<div class='metric-grid'>");

        // Uptime
        html.push("<div class='metric-card'>");
        html.push("<div class='metric-label'>Uptime</div>");
        html.push(
          `<div class='metric-value'>${serviceMetrics.uptime.percentage.toFixed(1)}%</div>`,
        );
        html.push("</div>");

        // Errors
        html.push("<div class='metric-card'>");
        html.push("<div class='metric-label'>Total Errors</div>");
        html.push(
          `<div class='metric-value'>${serviceMetrics.errors.totalErrors}</div>`,
        );
        html.push("</div>");

        // Performance
        html.push("<div class='metric-card'>");
        html.push("<div class='metric-label'>Avg Response Time</div>");
        html.push(
          `<div class='metric-value'>${serviceMetrics.performance.averageResponseTime.toFixed(0)}ms</div>`,
        );
        html.push("</div>");

        html.push("</div>");
        html.push("</div>");
      }
    }

    html.push("</div>");
  }

  // Footer
  html.push(
    "<div style='text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px;'>",
  );
  html.push(`Report generated by UniArr on ${new Date().toLocaleString()}`);
  html.push("</div>");

  html.push("</body>");
  html.push("</html>");

  return html.join("\n");
}

/**
 * Generate plain text format report
 */
function generateTextReport(
  health: AggregatedHealth,
  metrics: AggregatedMetrics | undefined,
  title: string,
  includeMetrics: boolean,
  includeHealthMessages: boolean,
): string {
  const lines: string[] = [];

  // Header
  lines.push("=".repeat(80));
  lines.push(title);
  lines.push("=".repeat(80));
  lines.push(`Generated: ${health.lastUpdated.toLocaleString()}`);
  lines.push(`Overall Status: ${health.overall.toUpperCase()}`);
  lines.push("");

  // Summary
  lines.push("-".repeat(80));
  lines.push("SUMMARY");
  lines.push("-".repeat(80));
  lines.push(`Total Services: ${health.services.length}`);

  const healthyCount = health.services.filter(
    (s) => s.status === "healthy",
  ).length;
  const degradedCount = health.services.filter(
    (s) => s.status === "degraded",
  ).length;
  const offlineCount = health.services.filter(
    (s) => s.status === "offline",
  ).length;

  lines.push(
    `Healthy: ${healthyCount} | Degraded: ${degradedCount} | Offline: ${offlineCount}`,
  );
  lines.push(`Critical Issues: ${health.criticalIssues.length}`);
  lines.push(`Warnings: ${health.warnings.length}`);
  lines.push("");

  // Services
  lines.push("-".repeat(80));
  lines.push("SERVICE STATUS");
  lines.push("-".repeat(80));

  for (const service of health.services) {
    lines.push("");
    lines.push(`Service: ${service.serviceName}`);
    lines.push(`  Status: ${service.status.toUpperCase()}`);
    lines.push(`  Type: ${service.serviceType}`);
    lines.push(`  Last Checked: ${service.lastChecked.toLocaleString()}`);

    if (includeHealthMessages && service.messages.length > 0) {
      lines.push(`  Messages:`);
      for (const message of service.messages) {
        lines.push(
          `    [${message.severity.toUpperCase()}] ${message.message}`,
        );
        if (message.source) {
          lines.push(`      Source: ${message.source}`);
        }
      }
    }
  }

  lines.push("");

  // Metrics
  if (includeMetrics && metrics) {
    lines.push("-".repeat(80));
    lines.push("METRICS OVERVIEW");
    lines.push("-".repeat(80));
    lines.push(
      `Time Range: ${metrics.timeRange.start.toLocaleString()} - ${metrics.timeRange.end.toLocaleString()}`,
    );
    lines.push("");
    lines.push(`Average Uptime: ${metrics.overall.averageUptime.toFixed(1)}%`);
    lines.push(`Total Errors: ${metrics.overall.totalErrors}`);
    lines.push(
      `Healthy Services: ${metrics.overall.healthyServices}/${metrics.overall.totalServices}`,
    );
    lines.push(`Degraded Services: ${metrics.overall.degradedServices}`);
    lines.push(`Offline Services: ${metrics.overall.offlineServices}`);
    lines.push("");

    if (metrics.services.length > 0) {
      lines.push("SERVICE METRICS:");
      lines.push("");

      for (const serviceMetrics of metrics.services) {
        lines.push(`  ${serviceMetrics.serviceName}:`);
        lines.push(
          `    Uptime: ${serviceMetrics.uptime.percentage.toFixed(1)}% (${serviceMetrics.uptime.successfulChecks}/${serviceMetrics.uptime.totalChecks} checks)`,
        );
        lines.push(
          `    Errors: ${serviceMetrics.errors.totalErrors} (${serviceMetrics.errors.errorRate.toFixed(2)}%)`,
        );
        lines.push(
          `    Avg Response Time: ${serviceMetrics.performance.averageResponseTime.toFixed(0)}ms`,
        );
        lines.push(
          `    P95 Response Time: ${serviceMetrics.performance.p95ResponseTime.toFixed(0)}ms`,
        );
        lines.push("");
      }
    }
  }

  // Footer
  lines.push("=".repeat(80));
  lines.push(`Report generated by UniArr on ${new Date().toLocaleString()}`);
  lines.push("=".repeat(80));

  return lines.join("\n");
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
