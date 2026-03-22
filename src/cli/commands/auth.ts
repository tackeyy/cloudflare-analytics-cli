import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig } from "../../lib/config.js";
import type { OutputMode } from "../../lib/types.js";

export function registerAuthCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  const auth = program
    .command("auth")
    .description("Authentication commands");

  auth
    .command("test")
    .description("Test Cloudflare API authentication")
    .action(async () => {
      try {
        const config = loadConfig();
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
        process.exit(1);
      }
    });
}
