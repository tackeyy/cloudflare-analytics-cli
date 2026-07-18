import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig, loadWranglerOAuthToken } from "../../lib/config.js";
import type { OutputMode } from "../../lib/types.js";

export function buildWranglerAuthTokenArgs(): string[] {
  return ["wrangler", "auth", "token", "--json"];
}

export function registerAuthCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  const auth = program
    .command("auth")
    .description("Authentication commands");

  auth
    .command("wrangler-refresh")
    .description("Refresh the local Wrangler OAuth session")
    .action(() => {
      try {
        loadWranglerOAuthToken();
        console.log("Wrangler OAuth session refreshed.");
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
    });

  auth
    .command("test")
    .description("Test Cloudflare API authentication")
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .option("--global-api-key", "Use CLOUDFLARE_API_KEY with X-Auth headers", false)
    .option("--email <email>", "Cloudflare account email for Global API Key auth")
    .action(async (opts) => {
      try {
        const config = loadConfig(undefined, {
          requireAccountId: false,
          wranglerAuth: opts.wranglerAuth,
          globalApiKeyAuth: opts.globalApiKey,
          email: opts.email,
        });
        const client = new CfaClient(config);
        const result = await client.authTest();
        const mode = getOutputMode();

        if (mode === "json") {
          console.log(JSON.stringify(result, null, 2));
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.status}`);
        } else {
          console.log(`Token ID: ${result.id}`);
          console.log(`Status: ${result.status}`);
          console.log("Authentication successful.");
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
    });
}
