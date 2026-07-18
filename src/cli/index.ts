#!/usr/bin/env node
import { Command } from "commander";
import type { OutputMode } from "../lib/types.js";
import { registerSummaryCommand } from "./commands/summary.js";
import { registerPagesCommand } from "./commands/pages.js";
import { registerReferrersCommand } from "./commands/referrers.js";
import { registerCountriesCommand } from "./commands/countries.js";
import { registerDevicesCommand } from "./commands/devices.js";
import { registerBrowsersCommand } from "./commands/browsers.js";
import { registerTimeseriesCommand } from "./commands/timeseries.js";
import { registerSitesCommand } from "./commands/sites.js";
import { registerAuthCommand } from "./commands/auth.js";
import { registerDeploymentsCommand } from "./commands/deployments.js";
import { registerDnsCommand } from "./commands/dns.js";

const program = new Command();

program
  .name("cfa")
  .description("Cloudflare Web Analytics CLI")
  .version("0.1.0")
  .option("--json", "Output in JSON format")
  .option("--plain", "Output in TSV format (for piping)");

function getOutputMode(): OutputMode {
  const opts = program.opts();
  if (opts.json) return "json";
  if (opts.plain) return "plain";
  return "human";
}

// Register all commands
registerSummaryCommand(program, getOutputMode);
registerPagesCommand(program, getOutputMode);
registerReferrersCommand(program, getOutputMode);
registerCountriesCommand(program, getOutputMode);
registerDevicesCommand(program, getOutputMode);
registerBrowsersCommand(program, getOutputMode);
registerTimeseriesCommand(program, getOutputMode);
registerSitesCommand(program, getOutputMode);
registerAuthCommand(program, getOutputMode);
registerDeploymentsCommand(program, getOutputMode);
registerDnsCommand(program, getOutputMode);

program.parse();
