import { describe, it, expect, vi, beforeEach } from "vitest";
import { CfaClient } from "../lib/client.js";
import type { CfaConfig } from "../lib/types.js";

const config: CfaConfig = {
  apiToken: "test-token",
  accountId: "test-account",
  siteTag: "test-site",
};

function mockFetch(response: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Bad Request",
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("CfaClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("graphql", () => {
    it("sends correct headers and body", async () => {
      const fetchMock = mockFetch({
        data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [] }] } },
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new CfaClient(config);
      await client.graphql("query Test { viewer { accounts { id } } }", { accountId: "test" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/graphql",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("throws on HTTP error", async () => {
      vi.stubGlobal("fetch", mockFetch({}, false, 401));

      const client = new CfaClient(config);
      await expect(client.graphql("query {}", {})).rejects.toThrow("HTTP 401");
    });

    it("throws on GraphQL errors", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch({ data: null, errors: [{ message: "Field not found" }] }),
      );

      const client = new CfaClient(config);
      await expect(client.graphql("query {}", {})).rejects.toThrow("Field not found");
    });
  });

  describe("getAnalytics", () => {
    it("returns parsed analytics rows", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch({
          data: {
            viewer: {
              accounts: [
                {
                  rumPageloadEventsAdaptiveGroups: [
                    {
                      dimensions: { requestPath: "/lp/" },
                      count: 150,
                      sum: { visits: 100 },
                    },
                    {
                      dimensions: { requestPath: "/about" },
                      count: 50,
                      sum: { visits: 30 },
                    },
                  ],
                },
              ],
            },
          },
        }),
      );

      const client = new CfaClient(config);
      const rows = await client.getAnalytics(
        {
          siteTag: "test-site",
          dateRange: { from: "2026-03-01", to: "2026-03-22" },
          limit: 10,
        },
        ["requestPath"],
      );

      expect(rows).toHaveLength(2);
      expect(rows[0].dimensions.requestPath).toBe("/lp/");
      expect(rows[0].count).toBe(150);
      expect(rows[0].visits).toBe(100);
    });
  });

  describe("getSummary", () => {
    it("returns structured summary data", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch({
          data: {
            viewer: {
              accounts: [
                {
                  total: [{ count: 1000, sum: { visits: 500 } }],
                  topPages: [
                    { dimensions: { requestPath: "/" }, count: 200, sum: { visits: 150 } },
                  ],
                  topReferrers: [
                    { dimensions: { refererHost: "google.com" }, count: 100, sum: { visits: 80 } },
                  ],
                  topCountries: [
                    { dimensions: { countryName: "Japan" }, count: 800, sum: { visits: 400 } },
                  ],
                },
              ],
            },
          },
        }),
      );

      const client = new CfaClient(config);
      const summary = await client.getSummary({
        siteTag: "test-site",
        dateRange: { from: "2026-03-01", to: "2026-03-22" },
      });

      expect(summary.pageviews).toBe(1000);
      expect(summary.visits).toBe(500);
      expect(summary.topPages).toHaveLength(1);
      expect(summary.topReferrers[0].dimensions.refererHost).toBe("google.com");
    });
  });

  describe("authTest", () => {
    it("returns token info on success", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch({ success: true, result: { id: "token-id", status: "active" } }),
      );

      const client = new CfaClient(config);
      const result = await client.authTest();

      expect(result.id).toBe("token-id");
      expect(result.status).toBe("active");
    });

    it("throws on auth failure", async () => {
      vi.stubGlobal("fetch", mockFetch({}, false, 403));

      const client = new CfaClient(config);
      await expect(client.authTest()).rejects.toThrow("Auth test failed");
    });
  });
});
