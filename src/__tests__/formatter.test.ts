import { describe, it, expect } from "vitest";
import {
  formatRows,
  formatSummary,
  formatTimeseries,
  formatSites,
} from "../lib/formatter.js";
import type { AnalyticsRow, SummaryData, TimeseriesPoint, SiteInfo } from "../lib/types.js";

const sampleRows: AnalyticsRow[] = [
  { dimensions: { requestPath: "/lp/" }, count: 100, visits: 80 },
  { dimensions: { requestPath: "/about" }, count: 50, visits: 30 },
];

describe("formatRows", () => {
  it("formats as JSON", () => {
    const output = formatRows(sampleRows, "requestPath", "json");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].count).toBe(100);
  });

  it("formats as plain TSV", () => {
    const output = formatRows(sampleRows, "requestPath", "plain");
    const lines = output.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("/lp/\t100\t80");
    expect(lines[1]).toBe("/about\t50\t30");
  });

  it("formats as human-readable table", () => {
    const output = formatRows(sampleRows, "requestPath", "human");
    expect(output).toContain("requestPath");
    expect(output).toContain("PV");
    expect(output).toContain("Visits");
    expect(output).toContain("/lp/");
    expect(output).toContain("100");
  });

  it("shows 'No data found.' for empty rows", () => {
    const output = formatRows([], "requestPath", "human");
    expect(output).toBe("No data found.");
  });

  it("handles empty dimension values", () => {
    const rows: AnalyticsRow[] = [
      { dimensions: { refererHost: "" }, count: 10, visits: 5 },
    ];
    const output = formatRows(rows, "refererHost", "human");
    expect(output).toContain("(empty)");
  });
});

describe("formatSummary", () => {
  const summaryData: SummaryData = {
    pageviews: 1000,
    visits: 500,
    topPages: [{ dimensions: { requestPath: "/" }, count: 200, visits: 150 }],
    topReferrers: [{ dimensions: { refererHost: "google.com" }, count: 100, visits: 80 }],
    topCountries: [{ dimensions: { countryName: "Japan" }, count: 800, visits: 400 }],
  };
  const dateRange = { from: "2026-03-01", to: "2026-03-22" };

  it("formats as JSON", () => {
    const output = formatSummary(summaryData, dateRange, "json");
    const parsed = JSON.parse(output);
    expect(parsed.pageviews).toBe(1000);
  });

  it("formats as plain", () => {
    const output = formatSummary(summaryData, dateRange, "plain");
    expect(output).toBe("1000\t500");
  });

  it("formats as human-readable", () => {
    const output = formatSummary(summaryData, dateRange, "human");
    expect(output).toContain("Analytics Summary");
    expect(output).toContain("1,000");
    expect(output).toContain("Top Pages:");
    expect(output).toContain("Top Referrers:");
    expect(output).toContain("google.com");
  });
});

describe("formatTimeseries", () => {
  const points: TimeseriesPoint[] = [
    { date: "2026-03-01", pageviews: 100, visits: 50 },
    { date: "2026-03-02", pageviews: 120, visits: 60 },
  ];

  it("formats as JSON", () => {
    const output = formatTimeseries(points, "json");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
  });

  it("formats as plain TSV", () => {
    const output = formatTimeseries(points, "plain");
    const lines = output.split("\n");
    expect(lines[0]).toBe("2026-03-01\t100\t50");
  });

  it("formats as human-readable", () => {
    const output = formatTimeseries(points, "human");
    expect(output).toContain("Date");
    expect(output).toContain("2026-03-01");
  });

  it("shows 'No data found.' for empty points", () => {
    expect(formatTimeseries([], "human")).toBe("No data found.");
  });
});

describe("formatSites", () => {
  const sites: SiteInfo[] = [
    { siteTag: "abc123", host: "example.com", autoInstall: true, created: "2026-01-01T00:00:00Z" },
  ];

  it("formats as JSON", () => {
    const output = formatSites(sites, "json");
    const parsed = JSON.parse(output);
    expect(parsed[0].siteTag).toBe("abc123");
  });

  it("formats as plain TSV", () => {
    const output = formatSites(sites, "plain");
    expect(output).toContain("abc123\texample.com\ttrue");
  });

  it("formats as human-readable", () => {
    const output = formatSites(sites, "human");
    expect(output).toContain("Site Tag");
    expect(output).toContain("abc123");
    expect(output).toContain("example.com");
  });

  it("shows 'No sites registered.' for empty list", () => {
    expect(formatSites([], "human")).toBe("No sites registered.");
  });
});
