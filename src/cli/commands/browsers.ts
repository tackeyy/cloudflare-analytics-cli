import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig, today } from "../../lib/config.js";
import { formatRows } from "../../lib/formatter.js";
import type { OutputMode } from "../../lib/types.js";

export function registerBrowsersCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  program
    .command("browsers")
    .description("Show page views by browser")
    .option("--from <date>", "Start date (YYYY-MM-DD)", today())
    .option("--to <date>", "End date (YYYY-MM-DD)", today())
    .option("--limit <n>", "Number of results", "10")
    .option("--site-tag <tag>", "Site tag")
    .action(async (opts) => {
      try {
        const config = loadConfig({ siteTag: opts.siteTag });
        if (!config.siteTag) {
          console.error("Error: --site-tag or CFA_SITE_TAG is required");
          process.exit(1);
        }
        const client = new CfaClient(config);
        const rows = await client.getAnalytics(
          {
            siteTag: config.siteTag!,
            dateRange: { from: opts.from, to: opts.to },
            limit: parseInt(opts.limit, 10),
          },
          ["userAgentBrowser"],
        );
        console.log(formatRows(rows, "userAgentBrowser", getOutputMode()));
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
