import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig, today } from "../../lib/config.js";
import { formatSummary } from "../../lib/formatter.js";
import type { OutputMode } from "../../lib/types.js";

export function registerSummaryCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  program
    .command("summary")
    .description("Show analytics summary")
    .option("--from <date>", "Start date (YYYY-MM-DD)", today())
    .option("--to <date>", "End date (YYYY-MM-DD)", today())
    .option("--site-tag <tag>", "Site tag")
    .action(async (opts) => {
      try {
        const config = loadConfig({ siteTag: opts.siteTag });
        if (!config.siteTag) {
          console.error("Error: --site-tag or CFA_SITE_TAG is required");
          process.exit(1);
        }
        const client = new CfaClient(config);
        const data = await client.getSummary({
          siteTag: config.siteTag!,
          dateRange: { from: opts.from, to: opts.to },
        });
        console.log(formatSummary(data, { from: opts.from, to: opts.to }, getOutputMode()));
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
