import type { Command } from "commander";
import { spawn } from "node:child_process";
import { CfaClient } from "../../lib/client.js";
import { loadConfig } from "../../lib/config.js";
import type { OutputMode } from "../../lib/types.js";

export function buildWranglerWhoamiArgs(): string[] {
  return ["wrangler", "whoami"];
}

function refreshWranglerAuthentication(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", buildWranglerWhoamiArgs(), {
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Wrangler authentication refresh exited with code ${code}`));
    });
  });
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
    .action(async () => {
      try {
        await refreshWranglerAuthentication();
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
    });

  auth
    .command("test")
    .description("Test Cloudflare API authentication")
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .action(async (opts) => {
      try {
        const config = loadConfig(undefined, {
          requireAccountId: false,
          wranglerAuth: opts.wranglerAuth,
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
