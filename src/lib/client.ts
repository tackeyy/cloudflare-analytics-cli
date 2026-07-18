import type {
  CfaConfig,
  QueryOptions,
  AnalyticsRow,
  SummaryData,
  TimeseriesPoint,
  SiteInfo,
  PagesProject,
  PagesDeployment,
  CloudflareZone,
  DnsRecord,
  DnsRecordInput,
  DnsRecordQuery,
  DnsUpsertResult,
  Dimension,
} from "./types.js";
import { buildAnalyticsQuery, buildSummaryQuery } from "./queries.js";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const REST_BASE = "https://api.cloudflare.com/client/v4";

interface CloudflareDnsRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  comment?: string;
}

interface RestResultInfo {
  page?: number;
  perPage?: number;
  totalPages?: number;
}

function mapDnsRecord(record: CloudflareDnsRecord): DnsRecord {
  return {
    id: record.id,
    zoneId: record.zone_id,
    zoneName: record.zone_name,
    name: record.name,
    type: record.type,
    content: record.content,
    ttl: record.ttl,
    proxied: record.proxied,
    comment: record.comment,
  };
}

export class CfaClient {
  private config: CfaConfig;

  constructor(config: CfaConfig) {
    const hasBearer = Boolean(config.apiToken);
    const hasApiKey = Boolean(config.apiKey);
    const hasEmail = Boolean(config.email);
    if (hasApiKey !== hasEmail) {
      throw new Error(
        "Global API Key authentication requires both apiKey and email",
      );
    }
    if (hasBearer === (hasApiKey && hasEmail)) {
      throw new Error("Configure exactly one Cloudflare authentication method");
    }
    this.config = config;
  }

  private requireAccountId(): string {
    if (!this.config.accountId) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID is required for account operations");
    }
    return this.config.accountId;
  }

  private authHeaders(): Record<string, string> {
    if (this.config.apiToken) {
      return { Authorization: `Bearer ${this.config.apiToken}` };
    }
    if (this.config.apiKey && this.config.email) {
      return {
        "X-Auth-Email": this.config.email,
        "X-Auth-Key": this.config.apiKey,
      };
    }
    throw new Error("Cloudflare authentication is not configured");
  }

  /** Execute a GraphQL query against Cloudflare API. */
  async graphql<T = unknown>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
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
  private async restEnvelope<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ result: T; resultInfo?: RestResultInfo }> {
    const url = `${REST_BASE}${path}`;
    const headers: Record<string, string> = {
      ...this.authHeaders(),
      "Content-Type": "application/json",
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare REST API error: HTTP ${res.status} — ${text}`);
    }

    const json = (await res.json()) as {
      success: boolean;
      result: T;
      result_info?: { page?: number; per_page?: number; total_pages?: number };
      errors?: Array<{ message: string }>;
    };

    if (!json.success) {
      const msgs = json.errors?.map((e) => e.message).join(", ") || "Unknown error";
      throw new Error(`Cloudflare REST API error: ${msgs}`);
    }

    return {
      result: json.result,
      resultInfo: json.result_info
        ? {
            page: json.result_info.page,
            perPage: json.result_info.per_page,
            totalPages: json.result_info.total_pages,
          }
        : undefined,
    };
  }

  /** Execute a REST API call against Cloudflare API. */
  async rest<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return (await this.restEnvelope<T>(method, path, body)).result;
  }

  /** Fetch analytics data by dimension. */
  async getAnalytics(
    options: QueryOptions,
    dimensions: Dimension[],
  ): Promise<AnalyticsRow[]> {
    const { query, variables } = buildAnalyticsQuery(
      this.requireAccountId(),
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
      this.requireAccountId(),
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
    }>("GET", `/accounts/${this.requireAccountId()}/rum/site_info/list`);

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
    }>("POST", `/accounts/${this.requireAccountId()}/rum/site_info`, {
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
      `/accounts/${this.requireAccountId()}/rum/site_info/${siteTag}`,
    );
  }

  /** List Cloudflare Pages projects for the configured account. */
  async listPagesProjects(): Promise<PagesProject[]> {
    const projects = await this.rest<Array<{
      name: string;
      subdomain: string;
      domains: string[];
      production_branch: string;
    }>>("GET", `/accounts/${this.requireAccountId()}/pages/projects`);

    return projects.map((project) => ({
      name: project.name,
      subdomain: project.subdomain,
      domains: project.domains,
      productionBranch: project.production_branch,
    }));
  }

  /** List recent deployments for a Cloudflare Pages project. */
  async listPagesDeployments(projectName: string): Promise<PagesDeployment[]> {
    const deployments = await this.rest<Array<{
      id: string;
      url: string;
      environment: string;
      created_on: string;
      latest_stage: { name: string; status: string };
      deployment_trigger?: {
        metadata?: { branch?: string; commit_hash?: string };
      };
    }>>(
      "GET",
      `/accounts/${this.requireAccountId()}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
    );

    return deployments.map((deployment) => ({
      id: deployment.id,
      url: deployment.url,
      environment: deployment.environment,
      createdOn: deployment.created_on,
      stage: deployment.latest_stage.name,
      status: deployment.latest_stage.status,
      branch: deployment.deployment_trigger?.metadata?.branch,
      commitHash: deployment.deployment_trigger?.metadata?.commit_hash,
    }));
  }

  /** Resolve one active zone by its exact name. */
  async findZoneByName(zoneName: string): Promise<CloudflareZone> {
    const query = new URLSearchParams({ name: zoneName, status: "active" });
    const zones = await this.rest<CloudflareZone[]>("GET", `/zones?${query.toString()}`);
    const exactMatches = zones.filter((zone) => zone.name === zoneName);

    if (exactMatches.length === 0) {
      throw new Error(`Active Cloudflare zone not found: ${zoneName}`);
    }
    if (exactMatches.length > 1) {
      throw new Error(`Multiple active Cloudflare zones found: ${zoneName}`);
    }
    return exactMatches[0];
  }

  private async listDnsRecordsInZone(
    zoneId: string,
    query: DnsRecordQuery = {},
  ): Promise<DnsRecord[]> {
    const params = new URLSearchParams();
    if (query.type) params.set("type", query.type.toUpperCase());
    if (query.name) params.set("name", query.name);
    params.set("per_page", "100");
    const records: CloudflareDnsRecord[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      params.set("page", String(page));
      const envelope = await this.restEnvelope<CloudflareDnsRecord[]>(
        "GET",
        `/zones/${encodeURIComponent(zoneId)}/dns_records?${params.toString()}`,
      );
      records.push(...envelope.result);
      totalPages = envelope.resultInfo?.totalPages ?? page;
      page += 1;
    } while (page <= totalPages);

    const expectedType = query.type?.toUpperCase();
    const expectedName = query.name?.toLowerCase();
    return records
      .filter(
        (record) =>
          (!expectedType || record.type === expectedType) &&
          (!expectedName || record.name.toLowerCase() === expectedName),
      )
      .map(mapDnsRecord);
  }

  /** List DNS records in a zone with optional exact type/name filters. */
  async listDnsRecords(
    zoneName: string,
    query: DnsRecordQuery = {},
  ): Promise<DnsRecord[]> {
    const zone = await this.findZoneByName(zoneName);
    return this.listDnsRecordsInZone(zone.id, query);
  }

  /** Create or replace exactly one matching DNS record. */
  async upsertDnsRecord(
    zoneName: string,
    input: DnsRecordInput,
    options: { dryRun?: boolean; matchContentPrefix?: string } = {},
  ): Promise<DnsUpsertResult> {
    const normalizedInput: DnsRecordInput = {
      ...input,
      type: input.type.toUpperCase(),
      ttl: input.ttl ?? 1,
    };
    const zone = await this.findZoneByName(zoneName);
    const records = await this.listDnsRecordsInZone(zone.id, {
      type: normalizedInput.type,
      name: normalizedInput.name,
    });

    if (
      normalizedInput.type === "TXT" &&
      records.length > 0 &&
      !options.matchContentPrefix
    ) {
      throw new Error(
        `matchContentPrefix is required to update TXT records for ${normalizedInput.name}`,
      );
    }

    const matchingRecords = options.matchContentPrefix
      ? records.filter((record) => record.content.startsWith(options.matchContentPrefix!))
      : records;

    if (matchingRecords.length > 1) {
      throw new Error(
        `Multiple ${normalizedInput.type} records found for ${normalizedInput.name}; refusing to choose one`,
      );
    }

    const existing = matchingRecords[0];
    const dryRun = options.dryRun ?? false;
    if (!existing) {
      if (dryRun) {
        return { action: "create", changed: true, dryRun, record: normalizedInput };
      }
      const created = await this.rest<CloudflareDnsRecord>(
        "POST",
        `/zones/${encodeURIComponent(zone.id)}/dns_records`,
        normalizedInput,
      );
      return { action: "create", changed: true, dryRun, record: mapDnsRecord(created) };
    }

    const isIdentical =
      existing.type === normalizedInput.type &&
      existing.name === normalizedInput.name &&
      existing.content === normalizedInput.content &&
      existing.ttl === normalizedInput.ttl &&
      (normalizedInput.proxied === undefined || existing.proxied === normalizedInput.proxied) &&
      (normalizedInput.comment === undefined || existing.comment === normalizedInput.comment);

    if (isIdentical) {
      return { action: "noop", changed: false, dryRun, record: existing };
    }
    if (dryRun) {
      return {
        action: "update",
        changed: true,
        dryRun,
        record: normalizedInput,
        previousRecord: existing,
      };
    }

    const updated = await this.rest<CloudflareDnsRecord>(
      "PATCH",
      `/zones/${encodeURIComponent(zone.id)}/dns_records/${encodeURIComponent(existing.id)}`,
      normalizedInput,
    );
    return {
      action: "update",
      changed: true,
      dryRun,
      record: mapDnsRecord(updated),
      previousRecord: existing,
    };
  }

  /** Test authentication by verifying the token. */
  async authTest(): Promise<{ id: string; status: string }> {
    if (this.config.apiKey && this.config.email) {
      const user = await this.rest<{ id: string }>("GET", "/user");
      return { id: user.id, status: "active" };
    }
    const res = await fetch(`${REST_BASE}/user/tokens/verify`, {
      headers: this.authHeaders(),
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
