import type { Command } from "commander";
import { spawn } from "node:child_process";
import { CfaClient } from "../../lib/client.js";
import { loadConfig } from "../../lib/config.js";
import type { OutputMode, PagesDeployment, PagesProject } from "../../lib/types.js";

interface PagesDeployOptions {
  directory: string;
  project: string;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
}

interface PagesProjectCreateOptions {
  project: string;
  productionBranch: string;
  compatibilityDate: string;
}

interface PagesSecretPutOptions {
  project: string;
  key: string;
  environment: "preview" | "production";
}

interface PagesSecretListOptions {
  project: string;
  environment: "preview" | "production";
}

type PagesEnvironment = "preview" | "production";

export function parsePagesEnvironment(value: string): PagesEnvironment {
  if (value !== "preview" && value !== "production") {
    throw new Error("Pages environment must be preview or production");
  }
  return value;
}

/** Parse a user-facing fail mode into the API's `fail_open` boolean. */
export function parseFailOpenState(value: string): boolean {
  if (value === "open") return true;
  if (value === "closed") return false;
  throw new Error("fail mode must be open or closed");
}

/** Describe a `fail_open` value. Missing is "unknown", never "closed". */
export function describeFailOpen(value: boolean | undefined): "open" | "closed" | "unknown" {
  if (value === true) return "open";
  if (value === false) return "closed";
  return "unknown";
}

type FailOpenValues = { production: boolean | undefined; preview: boolean | undefined };

export interface FailOpenClient {
  getPagesFailOpen(project: string): Promise<FailOpenValues>;
  setPagesFailOpen(project: string, failOpen: boolean): Promise<FailOpenValues>;
}

export interface FailOpenResult {
  exitCode: 0 | 1 | 2;
  modes?: { production: string; preview: string };
  error?: string;
}

/**
 * Show, set, or check a Pages project's fail open / closed mode.
 *
 * Exit codes: 0 = ok, 1 = invalid input / API error / the stored value did not
 * match `--set`, 2 = `--expect` did not match in production or preview
 * (a missing value never counts as a match).
 */
export async function runFailOpen(
  client: FailOpenClient,
  options: { project: string; set?: string; expect?: string },
): Promise<FailOpenResult> {
  try {
    const desired = options.set === undefined ? undefined : parseFailOpenState(options.set);
    const expected = options.expect === undefined ? undefined : parseFailOpenState(options.expect);
    const both = (values: FailOpenValues, mode: boolean) =>
      values.production === mode && values.preview === mode;

    if (desired !== undefined) {
      const stored = await client.setPagesFailOpen(options.project, desired);
      if (!both(stored, desired)) {
        return {
          exitCode: 1,
          modes: describeBoth(stored),
          error: `Cloudflare did not store fail mode ${describeFailOpen(desired)} in both environments`,
        };
      }
    }
    const values = await client.getPagesFailOpen(options.project);
    const modes = describeBoth(values);
    if (desired !== undefined && !both(values, desired)) {
      return { exitCode: 1, modes, error: `Re-read did not confirm fail mode ${describeFailOpen(desired)}` };
    }
    if (expected !== undefined && !both(values, expected)) {
      return {
        exitCode: 2,
        modes,
        error: `expected ${describeFailOpen(expected)} in production and preview`,
      };
    }
    return { exitCode: 0, modes };
  } catch (err: any) {
    return { exitCode: 1, error: err.message };
  }
}

function describeBoth(values: FailOpenValues): { production: string; preview: string } {
  return { production: describeFailOpen(values.production), preview: describeFailOpen(values.preview) };
}

export function buildPagesDeployArgs(options: PagesDeployOptions): string[] {
  const args = [
    "wrangler",
    "pages",
    "deploy",
    options.directory,
    "--project-name",
    options.project,
    "--branch",
    options.branch,
  ];
  if (options.commitHash) args.push("--commit-hash", options.commitHash);
  if (options.commitMessage) args.push("--commit-message", options.commitMessage);
  args.push("--commit-dirty=false");
  return args;
}

export function buildPagesProjectCreateArgs(
  options: PagesProjectCreateOptions,
): string[] {
  return [
    "wrangler",
    "pages",
    "project",
    "create",
    options.project,
    "--production-branch",
    options.productionBranch,
    "--compatibility-date",
    options.compatibilityDate,
  ];
}

export function buildPagesSecretPutArgs(
  options: PagesSecretPutOptions,
): string[] {
  return [
    "wrangler",
    "pages",
    "secret",
    "put",
    options.key,
    "--project-name",
    options.project,
    "--env",
    options.environment,
  ];
}

export function buildPagesSecretListArgs(
  options: PagesSecretListOptions,
): string[] {
  return [
    "wrangler",
    "pages",
    "secret",
    "list",
    "--project-name",
    options.project,
    "--env",
    options.environment,
  ];
}

function runWrangler(args: string[], operation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, {
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${operation} exited with code ${code}`));
    });
  });
}

function runPagesDeploy(options: PagesDeployOptions): Promise<void> {
  return runWrangler(buildPagesDeployArgs(options), "Wrangler Pages deploy");
}

function printProjects(projects: PagesProject[], mode: OutputMode): void {
  if (mode === "json") {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }
  for (const project of projects) {
    console.log(
      `${project.name}\t${project.productionBranch}\t${project.subdomain}\t${project.domains.join(",")}`,
    );
  }
}

function printDeployments(deployments: PagesDeployment[], mode: OutputMode): void {
  if (mode === "json") {
    console.log(JSON.stringify(deployments, null, 2));
    return;
  }
  for (const deployment of deployments) {
    console.log(
      [
        deployment.createdOn,
        deployment.environment,
        deployment.status,
        deployment.branch ?? "-",
        deployment.commitHash ?? "-",
        deployment.url,
      ].join("\t"),
    );
  }
}

export function registerDeploymentsCommand(
  program: Command,
  getOutputMode: () => OutputMode,
): void {
  const deployments = program
    .command("deployments")
    .description("Inspect Cloudflare Pages projects and deployments");

  deployments
    .command("create")
    .description("Create a Cloudflare Pages project")
    .requiredOption("--project <name>", "Pages project name")
    .option("--production-branch <name>", "Production branch", "main")
    .option(
      "--compatibility-date <date>",
      "Workers compatibility date",
      new Date().toISOString().slice(0, 10),
    )
    .action(async (opts) => {
      try {
        await runWrangler(
          buildPagesProjectCreateArgs({
            project: opts.project,
            productionBranch: opts.productionBranch,
            compatibilityDate: opts.compatibilityDate,
          }),
          "Wrangler Pages project create",
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  deployments
    .command("secret-put")
    .description("Create or update a Pages secret from stdin")
    .requiredOption("--project <name>", "Pages project name")
    .requiredOption("--key <name>", "Secret variable name")
    .option("--environment <name>", "Pages environment", "preview")
    .action(async (opts) => {
      try {
        await runWrangler(
          buildPagesSecretPutArgs({
            project: opts.project,
            key: opts.key,
            environment: parsePagesEnvironment(opts.environment),
          }),
          "Wrangler Pages secret put",
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  deployments
    .command("secret-list")
    .description("List Pages secret variable names without values")
    .requiredOption("--project <name>", "Pages project name")
    .option("--environment <name>", "Pages environment", "preview")
    .action(async (opts) => {
      try {
        await runWrangler(
          buildPagesSecretListArgs({
            project: opts.project,
            environment: parsePagesEnvironment(opts.environment),
          }),
          "Wrangler Pages secret list",
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  deployments
    .command("fail-open")
    .description("Show or set a Pages project's Functions fail open / closed mode (production and preview)")
    .requiredOption("--project <name>", "Pages project name")
    .option("--set <mode>", "Set the mode for production and preview together: open or closed")
    .option("--expect <mode>", "Exit with code 2 unless both environments are open or closed as given")
    .option("--wrangler-auth", "Use the local Wrangler OAuth token", false)
    .option("--global-api-key", "Use CLOUDFLARE_API_KEY with X-Auth headers", false)
    .option("--email <email>", "Cloudflare account email for Global API Key auth")
    .action(async (opts) => {
      let client: FailOpenClient;
      try {
        client = new CfaClient(
          loadConfig(undefined, {
            requireAccountId: true,
            wranglerAuth: opts.wranglerAuth,
            globalApiKeyAuth: opts.globalApiKey,
            email: opts.email,
          }),
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
        return;
      }
      const result = await runFailOpen(client, {
        project: opts.project,
        set: opts.set,
        expect: opts.expect,
      });
      if (result.modes) {
        if (getOutputMode() === "json") {
          console.log(JSON.stringify({ project: opts.project, ...result.modes }, null, 2));
        } else {
          console.log(`${opts.project}\tproduction=${result.modes.production}\tpreview=${result.modes.preview}`);
        }
      }
      if (result.error) console.error(`Error: ${result.error}`);
      process.exitCode = result.exitCode;
    });

  deployments
    .command("projects")
    .description("List Pages projects")
    .action(async () => {
      try {
        const client = new CfaClient(loadConfig());
        printProjects(await client.listPagesProjects(), getOutputMode());
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  deployments
    .command("list")
    .description("List recent deployments for a Pages project")
    .requiredOption("--project <name>", "Pages project name")
    .action(async (opts) => {
      try {
        const client = new CfaClient(loadConfig());
        printDeployments(
          await client.listPagesDeployments(opts.project),
          getOutputMode(),
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  deployments
    .command("deploy")
    .description("Deploy a static directory to a Pages project")
    .requiredOption("--project <name>", "Pages project name")
    .requiredOption("--directory <path>", "Static asset directory")
    .option("--branch <name>", "Deployment branch", "master")
    .option("--commit-hash <sha>", "Commit SHA to attach")
    .option("--commit-message <message>", "Commit message to attach")
    .action(async (opts) => {
      try {
        await runPagesDeploy({
          directory: opts.directory,
          project: opts.project,
          branch: opts.branch,
          commitHash: opts.commitHash,
          commitMessage: opts.commitMessage,
        });
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
