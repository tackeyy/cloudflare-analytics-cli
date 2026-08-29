import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig } from "../../lib/config.js";
import type { OutputMode, R2Bucket } from "../../lib/types.js";

function printBuckets(buckets: R2Bucket[], mode: OutputMode): void {
  if (mode === "json") {
    console.log(JSON.stringify(buckets, null, 2));
    return;
  }
  if (buckets.length === 0) {
    if (mode !== "plain") {
      console.log("No R2 buckets in this account.");
    }
    return;
  }
  for (const bucket of buckets) {
    console.log([bucket.name, bucket.location ?? "", bucket.creationDate ?? ""].join("\t"));
  }
}

export function registerR2Command(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  const r2 = program.command("r2").description("Inspect Cloudflare R2 storage");

  r2
    .command("buckets")
    .description("List R2 buckets in the account")
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .option("--global-api-key", "Use CLOUDFLARE_API_KEY with X-Auth headers", false)
    .option("--email <email>", "Cloudflare account email for Global API Key auth")
    .action(async (opts) => {
      try {
        const client = new CfaClient(
          loadConfig(undefined, {
            requireAccountId: true,
            wranglerAuth: opts.wranglerAuth,
            globalApiKeyAuth: opts.globalApiKey,
            email: opts.email,
          }),
        );
        printBuckets(await client.listR2Buckets(), getOutputMode());
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
    });
}
