import type {
  CfaConfig,
  QueryOptions,
  AnalyticsRow,
  SummaryData,
  TimeseriesPoint,
  SiteInfo,
  Dimension,
} from "./types.js";
import { buildAnalyticsQuery, buildSummaryQuery } from "./queries.js";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const REST_BASE = "https://api.cloudflare.com/client/v4";

export class CfaClient {
  private config: CfaConfig;

  constructor(config: CfaConfig) {
    this.config = config;
  }

  /** Execute a GraphQL query against Cloudflare API. */
  async graphql<T = unknown>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`Cloudflare API error: HTTP ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { data: T | null; errors?: Array<{ message: string }> };

    if (json.errors?.length) {
      throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
    }

    if (!json.data) {
      throw new Error("No data returned from Cloudflare API");
    }

    return json.data;
  }

  /** Execute a REST API call against Cloudflare API. */
  async rest<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${REST_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };

    const init: RequestInit = { method, headers };
    if (body) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare REST API error: HTTP ${res.status} — ${text}`);
    }

    const json = (await res.json()) as { success: boolean; result: T; errors?: Array<{ message: string }> };

    if (!json.success) {
      const msgs = json.errors?.map((e) => e.message).join(", ") || "Unknown error";
      throw new Error(`Cloudflare REST API error: ${msgs}`);
    }

    return json.result;
  }

  /** Fetch analytics data by dimension. */
  async getAnalytics(
    options: QueryOptions,
    dimensions: Dimension[],
  ): Promise<AnalyticsRow[]> {
    const { query, variables } = buildAnalyticsQuery(
      this.config.accountId,
      options,
      dimensions,
    );

    const data = await this.graphql<{
      viewer: {
        accounts: Array<{
          rumPageloadEventsAdaptiveGroups: Array<{
            dimensions: Record<string, string>;
            count: number;
            sum: { visits: number };
          }>;
        }>;
      };
    }>(query, variables);

    const groups = data.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups || [];

    return groups.map((g) => ({
      dimensions: g.dimensions,
      count: g.count,
      visits: g.sum.visits,
    }));
  }

  /** Fetch summary data (total PV/visits + top pages/referrers/countries). */
  async getSummary(options: QueryOptions): Promise<SummaryData> {
    const { query, variables } = buildSummaryQuery(
      this.config.accountId,
      options,
    );

    const data = await this.graphql<{
      viewer: {
        accounts: Array<{
          total: Array<{ count: number; sum: { visits: number } }>;
          topPages: Array<{ dimensions: Record<string, string>; count: number; sum: { visits: number } }>;
          topReferrers: Array<{ dimensions: Record<string, string>; count: number; sum: { visits: number } }>;
          topCountries: Array<{ dimensions: Record<string, string>; count: number; sum: { visits: number } }>;
        }>;
      };
    }>(query, variables);

    const account = data.viewer.accounts[0];
    const total = account?.total[0];

    const mapRows = (
      rows: Array<{ dimensions: Record<string, string>; count: number; sum: { visits: number } }>,
    ): AnalyticsRow[] =>
      rows.map((r) => ({
        dimensions: r.dimensions,
        count: r.count,
        visits: r.sum.visits,
      }));

    return {
      pageviews: total?.count ?? 0,
      visits: total?.sum.visits ?? 0,
      topPages: mapRows(account?.topPages || []),
      topReferrers: mapRows(account?.topReferrers || []),
      topCountries: mapRows(account?.topCountries || []),
    };
  }

  /** Fetch timeseries data (daily PV/visits). */
  async getTimeseries(options: QueryOptions): Promise<TimeseriesPoint[]> {
    const rows = await this.getAnalytics(options, ["date"]);
    return rows.map((r) => ({
      date: r.dimensions.date,
      pageviews: r.count,
      visits: r.visits,
    }));
  }

  /** List registered Web Analytics sites. */
  async listSites(): Promise<SiteInfo[]> {
    const result = await this.rest<{
      sites: Array<{
        site_tag: string;
        host: string;
        auto_install: boolean;
        created: string;
      }>;
    }>("GET", `/accounts/${this.config.accountId}/rum/site_info/list`);

    return (result.sites || []).map((s) => ({
      siteTag: s.site_tag,
      host: s.host,
      autoInstall: s.auto_install,
      created: s.created,
    }));
  }

  /** Create a new Web Analytics site. */
  async createSite(host: string, autoInstall = false): Promise<SiteInfo> {
    const result = await this.rest<{
      site_tag: string;
      host: string;
      auto_install: boolean;
      created: string;
    }>("POST", `/accounts/${this.config.accountId}/rum/site_info`, {
      host,
      auto_install: autoInstall,
    });

    return {
      siteTag: result.site_tag,
      host: result.host,
      autoInstall: result.auto_install,
      created: result.created,
    };
  }

  /** Delete a Web Analytics site. */
  async deleteSite(siteTag: string): Promise<void> {
    await this.rest(
      "DELETE",
      `/accounts/${this.config.accountId}/rum/site_info/${siteTag}`,
    );
  }

  /** Test authentication by verifying the token. */
  async authTest(): Promise<{ id: string; status: string }> {
    const res = await fetch(`${REST_BASE}/user/tokens/verify`, {
      headers: { Authorization: `Bearer ${this.config.apiToken}` },
    });

    if (!res.ok) {
      throw new Error(`Auth test failed: HTTP ${res.status}`);
    }

    const json = (await res.json()) as { success: boolean; result: { id: string; status: string } };
    if (!json.success) {
      throw new Error("Auth test failed: invalid token");
    }

    return json.result;
  }
}
