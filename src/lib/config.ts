import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import type { CfaConfig } from "./types.js";

export interface LoadConfigOptions {
  requireAccountId?: boolean;
  wranglerAuth?: boolean;
  wranglerTokenLoader?: () => string;
  globalApiKeyAuth?: boolean;
  email?: string;
}

/** Remove credentials that take precedence over Wrangler's stored OAuth session. */
export function sanitizeWranglerOAuthEnv(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const environment = { ...source };
  delete environment.CLOUDFLARE_API_TOKEN;
  delete environment.CLOUDFLARE_API_KEY;
  delete environment.CLOUDFLARE_EMAIL;
  return environment;
}

/** Parse the official `wrangler auth token --json` response. */
export function parseWranglerAuthTokenOutput(output: string): string {
  let result: { type?: string; token?: string };
  try {
    result = JSON.parse(output) as { type?: string; token?: string };
  } catch {
    throw new Error("Wrangler returned invalid authentication JSON");
  }
  if (result.type !== "oauth" || !result.token) {
    throw new Error("Wrangler did not return an OAuth token");
  }
  return result.token;
}

/** Retrieve and automatically refresh Wrangler's stored OAuth token. */
export function loadWranglerOAuthToken(): string {
  const child = spawnSync(
    "npx",
    ["wrangler", "auth", "token", "--json"],
    {
      cwd: homedir(),
      encoding: "utf8",
      env: sanitizeWranglerOAuthEnv(process.env),
      shell: false,
    },
  );
  if (child.error || child.status !== 0) {
    throw new Error("Unable to retrieve Wrangler OAuth token; run `npx wrangler login`");
  }
  return parseWranglerAuthTokenOutput(child.stdout);
}

/** Load configuration from environment variables. */
export function loadConfig(
  overrides?: Partial<CfaConfig>,
  options: LoadConfigOptions = {},
): CfaConfig {
  if (options.wranglerAuth && options.globalApiKeyAuth) {
    throw new Error(
      "Choose either Wrangler OAuth or Global API Key authentication",
    );
  }

  const apiToken = options.globalApiKeyAuth
    ? undefined
    : options.wranglerAuth
    ? (options.wranglerTokenLoader ?? loadWranglerOAuthToken)()
    : overrides?.apiToken || process.env.CLOUDFLARE_API_TOKEN;
  const apiKey = options.globalApiKeyAuth
    ? overrides?.apiKey || process.env.CLOUDFLARE_API_KEY
    : undefined;
  const email = options.globalApiKeyAuth
    ? options.email || overrides?.email || process.env.CLOUDFLARE_EMAIL
    : undefined;
  const accountId = overrides?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const siteTag = overrides?.siteTag || process.env.CFA_SITE_TAG;

  if (options.globalApiKeyAuth && (!apiKey || !email)) {
    throw new Error(
      "CLOUDFLARE_API_KEY and an email are required for Global API Key authentication",
    );
  }
  if (!options.globalApiKeyAuth && !apiToken) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is required. Set it as an environment variable or pass it as an option.",
    );
  }
  if (!accountId && options.requireAccountId !== false) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is required. Set it as an environment variable or pass it as an option.",
    );
  }

  return { apiToken, apiKey, email, accountId, siteTag };
}

/** Get today's date in YYYY-MM-DD format. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
