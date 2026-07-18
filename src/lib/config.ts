import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CfaConfig } from "./types.js";

export interface LoadConfigOptions {
  requireAccountId?: boolean;
  wranglerAuth?: boolean;
  wranglerConfigPath?: string;
}

/** Resolve Wrangler's macOS OAuth configuration path. */
export function defaultWranglerConfigPath(): string {
  return join(homedir(), "Library", "Preferences", ".wrangler", "config", "default.toml");
}

/** Read only the OAuth access token from Wrangler's local configuration. */
export function loadWranglerOAuthToken(
  configPath = defaultWranglerConfigPath(),
): string {
  let contents: string;
  try {
    contents = readFileSync(configPath, "utf8");
  } catch (error: any) {
    throw new Error(`Unable to read Wrangler config: ${error.message}`);
  }
  const match = contents.match(/^\s*oauth_token\s*=\s*"([^"]+)"\s*$/m);
  if (!match?.[1]) {
    throw new Error(`Wrangler oauth_token not found in ${configPath}`);
  }
  return match[1];
}

/** Load configuration from environment variables. */
export function loadConfig(
  overrides?: Partial<CfaConfig>,
  options: LoadConfigOptions = {},
): CfaConfig {
  const apiToken = options.wranglerAuth
    ? loadWranglerOAuthToken(options.wranglerConfigPath)
    : overrides?.apiToken || process.env.CLOUDFLARE_API_TOKEN;
  const accountId = overrides?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const siteTag = overrides?.siteTag || process.env.CFA_SITE_TAG;

  if (!apiToken) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is required. Set it as an environment variable or pass it as an option.",
    );
  }
  if (!accountId && options.requireAccountId !== false) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is required. Set it as an environment variable or pass it as an option.",
    );
  }

  return { apiToken, accountId: accountId ?? "", siteTag };
}

/** Get today's date in YYYY-MM-DD format. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
