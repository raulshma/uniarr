import type {
  components,
  operations,
} from "@/connectors/client-schemas/adguard-home-openapi";

export type AdGuardServerStatus = components["schemas"]["ServerStatus"];
export type AdGuardStats = components["schemas"]["Stats"];
export type AdGuardTopArrayEntry = components["schemas"]["TopArrayEntry"];
export type AdGuardQueryLog = components["schemas"]["QueryLog"];
export type AdGuardQueryLogItem = components["schemas"]["QueryLogItem"];

export type AdGuardQueryLogResponseStatus = NonNullable<
  NonNullable<operations["queryLog"]["parameters"]["query"]>["response_status"]
>;

export interface AdGuardTopEntry {
  name: string;
  count: number;
}

export interface AdGuardDashboardStats {
  dnsQueries: number;
  adsBlocked: number;
  trackersBlocked: number;
  avgProcessingTimeSeconds?: number;
  blockedPercentage: number;
  topBlockedDomains: AdGuardTopEntry[];
  topQueriedDomains: AdGuardTopEntry[];
  topClients: AdGuardTopEntry[];
}

export interface AdGuardDashboardOverview {
  status: AdGuardServerStatus;
  stats: AdGuardDashboardStats;
  rawStats: AdGuardStats;
  fetchedAt: Date;
}

export interface AdGuardQueryLogParams {
  limit?: number;
  offset?: number;
  olderThan?: string;
  search?: string;
  responseStatus?: AdGuardQueryLogResponseStatus;
}

export interface AdGuardQueryLogResult {
  items: AdGuardQueryLogItem[];
  oldest?: string;
}
