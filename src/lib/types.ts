/** Cloudflare Web Analytics configuration. */
export interface CfaConfig {
  apiToken: string;
  accountId: string;
  siteTag?: string;
}

/** Date range for queries. */
export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

/** Query options for analytics data. */
export interface QueryOptions {
  siteTag: string;
  dateRange: DateRange;
  limit?: number;
  filter?: string;
}

/** Dimension type for GraphQL queries. */
export type Dimension =
  | "date"
  | "requestPath"
  | "refererHost"
  | "countryName"
  | "deviceType"
  | "userAgentBrowser";

/** A single analytics data point with a dimension value. */
export interface AnalyticsRow {
  dimensions: Record<string, string>;
  count: number;
  visits: number;
}

/** Summary data. */
export interface SummaryData {
  pageviews: number;
  visits: number;
  topPages: AnalyticsRow[];
  topReferrers: AnalyticsRow[];
  topCountries: AnalyticsRow[];
}

/** Timeseries data point. */
export interface TimeseriesPoint {
  date: string;
  pageviews: number;
  visits: number;
}

/** Site information from Cloudflare Web Analytics. */
export interface SiteInfo {
  siteTag: string;
  host: string;
  autoInstall: boolean;
  created: string;
}

/** Cloudflare Pages project metadata. */
export interface PagesProject {
  name: string;
  subdomain: string;
  domains: string[];
  productionBranch: string;
}

/** Cloudflare Pages deployment metadata. */
export interface PagesDeployment {
  id: string;
  url: string;
  environment: string;
  createdOn: string;
  stage: string;
  status: string;
  branch?: string;
  commitHash?: string;
}

/** GraphQL response wrapper. */
export interface GraphQLResponse<T = unknown> {
  data: T | null;
  errors?: Array<{ message: string; path?: string[] }>;
}

/** RUM data from GraphQL. */
export interface RumPageloadData {
  viewer: {
    accounts: Array<{
      rumPageloadEventsAdaptiveGroups: Array<{
        dimensions: Record<string, string>;
        count: number;
        sum: { visits: number };
      }>;
    }>;
  };
}

/** Output format mode. */
export type OutputMode = "human" | "json" | "plain";
