import { afterEach, describe, expect, it, vi } from "vitest";
import { CfaClient } from "../lib/client.js";
import { loadConfig } from "../lib/config.js";

const originalKey = process.env.CLOUDFLARE_API_KEY;
const originalToken = process.env.CLOUDFLARE_API_TOKEN;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.CLOUDFLARE_API_KEY;
  else process.env.CLOUDFLARE_API_KEY = originalKey;
  if (originalToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
  else process.env.CLOUDFLARE_API_TOKEN = originalToken;
});

describe("Global API Key authentication", () => {
  it("loads key and email without selecting a stale bearer token", () => {
    process.env.CLOUDFLARE_API_KEY = "global-secret";
    process.env.CLOUDFLARE_API_TOKEN = "stale-token";

    expect(
      loadConfig(undefined, {
        requireAccountId: false,
        globalApiKeyAuth: true,
        email: "owner@example.com",
      }),
    ).toEqual(
      expect.objectContaining({
        apiToken: undefined,
        apiKey: "global-secret",
        email: "owner@example.com",
      }),
    );
  });

  it("uses X-Auth headers and never sends a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({
        success: true,
        result: [{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }],
      }),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    await new CfaClient({
      apiKey: "global-secret",
      email: "owner@example.com",
    }).findZoneByName("wedgeai.co.jp");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/zones?name=wedgeai.co.jp"),
      expect.objectContaining({
        headers: {
          "X-Auth-Email": "owner@example.com",
          "X-Auth-Key": "global-secret",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("rejects ambiguous OAuth and Global API Key selection", () => {
    expect(() =>
      loadConfig(undefined, {
        wranglerAuth: true,
        globalApiKeyAuth: true,
        requireAccountId: false,
        email: "owner@example.com",
      }),
    ).toThrow("Choose either Wrangler OAuth or Global API Key authentication");
  });

  it("rejects mixed or incomplete credentials in direct client usage", () => {
    expect(
      () =>
        new CfaClient({
          apiToken: "bearer-token",
          apiKey: "global-secret",
          email: "owner@example.com",
        }),
    ).toThrow("Configure exactly one Cloudflare authentication method");
    expect(() => new CfaClient({ apiKey: "global-secret" })).toThrow(
      "Global API Key authentication requires both apiKey and email",
    );
  });

  it("rejects an email option unless Global API Key auth is selected", () => {
    expect(() =>
      loadConfig(undefined, {
        requireAccountId: false,
        email: "owner@example.com",
      }),
    ).toThrow("email can only be used with Global API Key authentication");
  });
});
