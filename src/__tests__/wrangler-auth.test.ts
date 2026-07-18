import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadConfig,
  loadWranglerOAuthToken,
} from "../lib/config.js";
import { buildWranglerWhoamiArgs } from "../cli/commands/auth.js";

const originalToken = process.env.CLOUDFLARE_API_TOKEN;
const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

afterEach(() => {
  if (originalToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
  else process.env.CLOUDFLARE_API_TOKEN = originalToken;
  if (originalAccountId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
  else process.env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
});

describe("Wrangler OAuth authentication", () => {
  it("reads oauth_token without exposing other Wrangler config values", () => {
    const directory = mkdtempSync(join(tmpdir(), "cfa-wrangler-auth-"));
    const configPath = join(directory, "default.toml");
    writeFileSync(
      configPath,
      'oauth_token = "oauth-secret"\nrefresh_token = "refresh-secret"\nexpiration_time = "future"\n',
    );

    expect(loadWranglerOAuthToken(configPath)).toBe("oauth-secret");
  });

  it("fails clearly when oauth_token is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "cfa-wrangler-auth-"));
    const configPath = join(directory, "default.toml");
    writeFileSync(configPath, 'refresh_token = "refresh-secret"\n');

    expect(() => loadWranglerOAuthToken(configPath)).toThrow(
      "Wrangler oauth_token not found",
    );
  });

  it("loads Wrangler OAuth without requiring an account ID for zone operations", () => {
    const directory = mkdtempSync(join(tmpdir(), "cfa-wrangler-auth-"));
    const configPath = join(directory, "default.toml");
    writeFileSync(configPath, 'oauth_token = "oauth-secret"\n');
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;

    expect(
      loadConfig(undefined, {
        requireAccountId: false,
        wranglerAuth: true,
        wranglerConfigPath: configPath,
      }),
    ).toEqual(expect.objectContaining({ apiToken: "oauth-secret", accountId: "" }));
  });

  it("builds the non-shell Wrangler refresh command", () => {
    expect(buildWranglerWhoamiArgs()).toEqual(["wrangler", "whoami"]);
  });
});
