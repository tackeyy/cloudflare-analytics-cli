import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig } from "../../lib/config.js";
import type {
  DnsRecord,
  DnsRecordInput,
  DnsUpsertResult,
  OutputMode,
} from "../../lib/types.js";

function printRecords(records: DnsRecord[], mode: OutputMode): void {
  if (mode === "json") {
    console.log(JSON.stringify(records, null, 2));
    return;
  }
  for (const record of records) {
    console.log([record.type, record.name, record.content, record.ttl].join("\t"));
  }
}

function printUpsert(result: DnsUpsertResult, mode: OutputMode): void {
  if (mode === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const dryRun = result.dryRun ? " (dry-run)" : "";
  console.log(`${result.action}${dryRun}: ${result.record.type} ${result.record.name}`);
}

export function parseTtl(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("TTL must be a positive integer; use 1 for automatic");
  }
  const ttl = Number.parseInt(value, 10);
  if (!Number.isInteger(ttl) || ttl < 1) {
    throw new Error("TTL must be a positive integer; use 1 for automatic");
  }
  return ttl;
}

export function registerDnsCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  const dns = program
    .command("dns")
    .description("List and safely upsert Cloudflare DNS records");

  dns
    .command("list")
    .description("List DNS records in an active zone")
    .requiredOption("--zone <name>", "Cloudflare zone name")
    .option("--type <type>", "DNS record type")
    .option("--name <name>", "Exact DNS record name")
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .option("--global-api-key", "Use CLOUDFLARE_API_KEY with X-Auth headers", false)
    .option("--email <email>", "Cloudflare account email for Global API Key auth")
    .action(async (opts) => {
      try {
        const client = new CfaClient(
          loadConfig(undefined, {
            requireAccountId: false,
            wranglerAuth: opts.wranglerAuth,
            globalApiKeyAuth: opts.globalApiKey,
            email: opts.email,
          }),
        );
        const records = await client.listDnsRecords(opts.zone, {
          type: opts.type,
          name: opts.name,
        });
        printRecords(records, getOutputMode());
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
    });

  dns
    .command("upsert")
    .description("Create or replace one exact type/name match")
    .requiredOption("--zone <name>", "Cloudflare zone name")
    .requiredOption("--type <type>", "DNS record type")
    .requiredOption("--name <name>", "Exact DNS record name")
    .requiredOption("--content <value>", "DNS record content")
    .option(
      "--match-content-prefix <prefix>",
      "Only update content beginning with this prefix (required for existing TXT records)",
    )
    .option("--ttl <seconds>", "TTL in seconds; 1 means automatic", "1")
    .option("--comment <text>", "Cloudflare DNS record comment")
    .option("--dry-run", "Show the planned action without writing", false)
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .option("--global-api-key", "Use CLOUDFLARE_API_KEY with X-Auth headers", false)
    .option("--email <email>", "Cloudflare account email for Global API Key auth")
    .action(async (opts) => {
      try {
        const input: DnsRecordInput = {
          type: opts.type,
          name: opts.name,
          content: opts.content,
          ttl: parseTtl(opts.ttl),
          comment: opts.comment,
        };
        const client = new CfaClient(
          loadConfig(undefined, {
            requireAccountId: false,
            wranglerAuth: opts.wranglerAuth,
            globalApiKeyAuth: opts.globalApiKey,
            email: opts.email,
          }),
        );
        const result = await client.upsertDnsRecord(opts.zone, input, {
          dryRun: opts.dryRun,
          matchContentPrefix: opts.matchContentPrefix,
        });
        printUpsert(result, getOutputMode());
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
    });
}
