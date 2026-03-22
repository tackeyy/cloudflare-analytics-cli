import type { CfaConfig } from "./types.js";

/** Load configuration from environment variables. */
export function loadConfig(overrides?: Partial<CfaConfig>): CfaConfig {
  const apiToken = overrides?.apiToken || process.env.CLOUDFLARE_API_TOKEN;
  const accountId = overrides?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const siteTag = overrides?.siteTag || process.env.CFA_SITE_TAG;

  if (!apiToken) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is required. Set it as an environment variable or pass it as an option.",
    );
  }
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is required. Set it as an environment variable or pass it as an option.",
    );
  }

  return { apiToken, accountId, siteTag };
}

/** Get today's date in YYYY-MM-DD format. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
