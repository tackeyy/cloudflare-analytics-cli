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

function runPagesDeploy(options: PagesDeployOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", buildPagesDeployArgs(options), {
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Wrangler Pages deploy exited with code ${code}`));
    });
  });
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
