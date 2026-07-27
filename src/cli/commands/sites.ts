import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig } from "../../lib/config.js";
import { formatSites } from "../../lib/formatter.js";
import type { OutputMode } from "../../lib/types.js";

export function buildSitesConfigOptions(opts: {
  wranglerAuth?: boolean;
  globalApiKey?: boolean;
  email?: string;
}) {
  return {
    wranglerAuth: Boolean(opts.wranglerAuth),
    globalApiKeyAuth: Boolean(opts.globalApiKey),
    email: opts.email,
  };
}

export function registerSitesCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  const sites = program
    .command("sites")
    .description("Manage Web Analytics sites")
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .option("--global-api-key", "Use CLOUDFLARE_API_KEY with X-Auth headers", false)
    .option("--email <email>", "Cloudflare account email for Global API Key auth");

  // Default action: list sites
  sites.action(async () => {
    try {
      const config = loadConfig(undefined, buildSitesConfigOptions(sites.opts()));
      const client = new CfaClient(config);
      const siteList = await client.listSites();
      console.log(formatSites(siteList, getOutputMode()));
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

  sites
    .command("create")
    .description("Create a new Web Analytics site")
    .requiredOption("--host <hostname>", "Site hostname")
    .option("--auto-install", "Enable auto-install JS snippet")
    .action(async (opts) => {
      try {
        const config = loadConfig(undefined, buildSitesConfigOptions(sites.opts()));
        const client = new CfaClient(config);
        const site = await client.createSite(opts.host, opts.autoInstall);
        const mode = getOutputMode();

        if (mode === "json") {
          console.log(JSON.stringify(site, null, 2));
        } else if (mode === "plain") {
          console.log(`${site.siteTag}\t${site.host}`);
        } else {
          console.log(`Site created: ${site.host} (tag: ${site.siteTag})`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  sites
    .command("delete")
    .description("Delete a Web Analytics site")
    .requiredOption("--site-tag <tag>", "Site tag to delete")
    .action(async (opts) => {
      try {
        const config = loadConfig(undefined, buildSitesConfigOptions(sites.opts()));
        const client = new CfaClient(config);
        await client.deleteSite(opts.siteTag);
        const mode = getOutputMode();

        if (mode === "json") {
          console.log(JSON.stringify({ siteTag: opts.siteTag, deleted: true }, null, 2));
        } else if (mode === "plain") {
          console.log(`${opts.siteTag}\tdeleted`);
        } else {
          console.log(`Site deleted: ${opts.siteTag}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
