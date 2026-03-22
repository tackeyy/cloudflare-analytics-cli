import { describe, it, expect } from "vitest";
import { buildAnalyticsQuery, buildSummaryQuery } from "../lib/queries.js";
import type { QueryOptions } from "../lib/types.js";

const baseOptions: QueryOptions = {
  siteTag: "test-tag",
  dateRange: { from: "2026-03-01", to: "2026-03-22" },
  limit: 10,
};

describe("buildAnalyticsQuery", () => {
  it("builds a query with requestPath dimension", () => {
    const { query, variables } = buildAnalyticsQuery(
      "acc-123",
      baseOptions,
      ["requestPath"],
    );

    expect(query).toContain("rumPageloadEventsAdaptiveGroups");
    expect(query).toContain("requestPath");
    expect(query).toContain("count_DESC");
    expect(variables.accountId).toBe("acc-123");
    expect(variables.siteTag).toBe("test-tag");
    expect(variables.dateStart).toBe("2026-03-01");
    expect(variables.dateEnd).toBe("2026-03-22");
    expect(variables.limit).toBe(10);
  });

  it("uses date_ASC ordering when date dimension is included", () => {
    const { query } = buildAnalyticsQuery("acc-123", baseOptions, ["date"]);
    expect(query).toContain("date_ASC");
  });

  it("includes path filter when specified", () => {
    const opts: QueryOptions = { ...baseOptions, filter: "/lp/*" };
    const { query, variables } = buildAnalyticsQuery("acc-123", opts, ["requestPath"]);
    expect(query).toContain("requestPath_like");
    expect(query).toContain("$pathFilter");
    expect(variables.pathFilter).toBe("/lp/*");
  });

  it("does not include path filter when not specified", () => {
    const { query, variables } = buildAnalyticsQuery("acc-123", baseOptions, ["requestPath"]);
    expect(query).not.toContain("$pathFilter");
    expect(variables).not.toHaveProperty("pathFilter");
  });

  it("supports multiple dimensions", () => {
    const { query } = buildAnalyticsQuery("acc-123", baseOptions, [
      "requestPath",
      "countryName",
    ]);
    expect(query).toContain("requestPath");
    expect(query).toContain("countryName");
  });
});

describe("buildSummaryQuery", () => {
  it("builds a summary query with total, topPages, topReferrers, topCountries", () => {
    const { query, variables } = buildSummaryQuery("acc-123", baseOptions);

    expect(query).toContain("total:");
    expect(query).toContain("topPages:");
    expect(query).toContain("topReferrers:");
    expect(query).toContain("topCountries:");
    expect(variables.accountId).toBe("acc-123");
    expect(variables.siteTag).toBe("test-tag");
  });
});
