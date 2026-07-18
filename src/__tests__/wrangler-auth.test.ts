import { afterEach, describe, expect, it } from "vitest";
import {
  loadConfig,
  parseWranglerAuthTokenOutput,
  sanitizeWranglerOAuthEnv,
} from "../lib/config.js";
import { buildWranglerAuthTokenArgs } from "../cli/commands/auth.js";

const originalToken = process.env.CLOUDFLARE_API_TOKEN;
const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

afterEach(() => {
  if (originalToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
  else process.env.CLOUDFLARE_API_TOKEN = originalToken;
  if (originalAccountId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
  else process.env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
});

describe("Wrangler OAuth authentication", () => {
  it("parses only an OAuth token from Wrangler JSON output", () => {
    expect(
      parseWranglerAuthTokenOutput('{"type":"oauth","token":"oauth-secret"}'),
    ).toBe("oauth-secret");
    expect(() =>
      parseWranglerAuthTokenOutput('{"type":"api_token","token":"api-secret"}'),
    ).toThrow("Wrangler did not return an OAuth token");
  });

  it("removes higher-priority Cloudflare credentials from the child environment", () => {
    const sanitized = sanitizeWranglerOAuthEnv({
      PATH: "/bin",
      CLOUDFLARE_API_TOKEN: "stale-token",
      CLOUDFLARE_API_KEY: "stale-key",
      CLOUDFLARE_EMAIL: "user@example.com",
      CLOUDFLARE_AUTH_USE_KEYRING: "true",
    });

    expect(sanitized).toEqual({
      PATH: "/bin",
      CLOUDFLARE_AUTH_USE_KEYRING: "true",
    });
  });

  it("loads Wrangler OAuth without requiring an account ID for zone operations", () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;

    expect(
      loadConfig(undefined, {
        requireAccountId: false,
        wranglerAuth: true,
        wranglerTokenLoader: () => "oauth-secret",
      }),
    ).toEqual(
      expect.objectContaining({ apiToken: "oauth-secret", accountId: undefined }),
    );
  });

  it("builds the official non-shell Wrangler token command", () => {
    expect(buildWranglerAuthTokenArgs()).toEqual([
      "wrangler",
      "auth",
      "token",
      "--json",
    ]);
  });
});
