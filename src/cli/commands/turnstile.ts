import { writeFile } from "node:fs/promises";
import type { Command } from "commander";
import { CfaClient } from "../../lib/client.js";
import { loadConfig } from "../../lib/config.js";
import type {
  OutputMode,
  TurnstileWidget,
  TurnstileWidgetMode,
} from "../../lib/types.js";

const MODES = new Set<TurnstileWidgetMode>([
  "managed",
  "non-interactive",
  "invisible",
]);

export async function persistTurnstileSecret(path: string, secret: string): Promise<void> {
  await writeFile(path, secret, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

export function printTurnstileWidget(widget: TurnstileWidget, mode: OutputMode): void {
  const publicWidget = {
    sitekey: widget.sitekey,
    name: widget.name,
    domains: widget.domains,
    mode: widget.mode,
  };
  if (mode === "json") {
    console.log(JSON.stringify(publicWidget, null, 2));
    return;
  }
  console.log(`created: ${publicWidget.name}`);
  console.log(`sitekey: ${publicWidget.sitekey}`);
  console.log(`domains: ${publicWidget.domains.join(", ")}`);
  console.log(`mode: ${publicWidget.mode}`);
}

export function registerTurnstileCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  const turnstile = program
    .command("turnstile")
    .description("Manage Cloudflare Turnstile widgets");

  turnstile
    .command("create")
    .description("Create a Turnstile widget without printing its secret")
    .requiredOption("--name <name>", "Widget name")
    .requiredOption("--domain <domain...>", "Allowed hostname(s)")
    .requiredOption("--secret-file <path>", "New file used to store the secret with mode 0600")
    .option("--mode <mode>", "managed, non-interactive, or invisible", "managed")
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .option("--global-api-key", "Use CLOUDFLARE_API_KEY with X-Auth headers", false)
    .option("--email <email>", "Cloudflare account email for Global API Key auth")
    .action(async (opts) => {
      try {
        if (!MODES.has(opts.mode)) {
          throw new Error("mode must be managed, non-interactive, or invisible");
        }
        const client = new CfaClient(
          loadConfig(undefined, {
            wranglerAuth: opts.wranglerAuth,
            globalApiKeyAuth: opts.globalApiKey,
            email: opts.email,
          }),
        );
        const widget = await client.createTurnstileWidget({
          name: opts.name,
          domains: opts.domain,
          mode: opts.mode,
        });
        await persistTurnstileSecret(opts.secretFile, widget.secret);
        printTurnstileWidget(widget, getOutputMode());
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
    });
}
