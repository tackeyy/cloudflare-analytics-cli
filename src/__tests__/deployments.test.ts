import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
  buildPagesDeployArgs,
  buildPagesProjectCreateArgs,
  buildPagesSecretListArgs,
  buildPagesSecretPutArgs,
  parsePagesEnvironment,
  registerDeploymentsCommand,
} from "../cli/commands/deployments.js";

describe("buildPagesDeployArgs", () => {
  it("builds a Pages production deploy command without a shell", () => {
    expect(
      buildPagesDeployArgs({
        directory: "dist",
        project: "kajitz-corporate",
        branch: "master",
        commitHash: "abc123",
        commitMessage: "サイト文言にAI活用を追加",
      }),
    ).toEqual([
      "wrangler",
      "pages",
      "deploy",
      "dist",
      "--project-name",
      "kajitz-corporate",
      "--branch",
      "master",
      "--commit-hash",
      "abc123",
      "--commit-message",
      "サイト文言にAI活用を追加",
      "--commit-dirty=false",
    ]);
  });
});

describe("buildPagesProjectCreateArgs", () => {
  it("builds a Pages project create command without a shell", () => {
    expect(
      buildPagesProjectCreateArgs({
        project: "csc-llm-security-preview",
        productionBranch: "main",
        compatibilityDate: "2026-07-16",
      }),
    ).toEqual([
      "wrangler",
      "pages",
      "project",
      "create",
      "csc-llm-security-preview",
      "--production-branch",
      "main",
      "--compatibility-date",
      "2026-07-16",
    ]);
  });
});

describe("buildPagesSecretPutArgs", () => {
  it("builds a preview secret command that reads the value from stdin", () => {
    expect(
      buildPagesSecretPutArgs({
        project: "csc-llm-security-preview",
        key: "BASIC_AUTH_PASSWORD",
        environment: "preview",
      }),
    ).toEqual([
      "wrangler",
      "pages",
      "secret",
      "put",
      "BASIC_AUTH_PASSWORD",
      "--project-name",
      "csc-llm-security-preview",
      "--env",
      "preview",
    ]);
  });
});

describe("buildPagesSecretListArgs", () => {
  it("builds a production secret list command without exposing values", () => {
    expect(
      buildPagesSecretListArgs({
        project: "llm-security-preview",
        environment: "production",
      }),
    ).toEqual([
      "wrangler",
      "pages",
      "secret",
      "list",
      "--project-name",
      "llm-security-preview",
      "--env",
      "production",
    ]);
  });
});

describe("registerDeploymentsCommand", () => {
  it("registers secret-list with project and environment options", () => {
    const program = new Command();
    registerDeploymentsCommand(program, () => "human");

    const deployments = program.commands.find(
      (command) => command.name() === "deployments",
    );
    const secretList = deployments?.commands.find(
      (command) => command.name() === "secret-list",
    );

    expect(secretList).toBeDefined();
    expect(secretList?.options.map((option) => option.long)).toEqual([
      "--project",
      "--environment",
    ]);
  });
});

describe("parsePagesEnvironment", () => {
  it("accepts Pages environments and rejects unknown names", () => {
    expect(parsePagesEnvironment("production")).toBe("production");
    expect(parsePagesEnvironment("preview")).toBe("preview");
    expect(() => parsePagesEnvironment("staging")).toThrow(
      "Pages environment must be preview or production",
    );
  });
});

describe("fail-open helpers", () => {
  it("parses open/closed and rejects anything else", async () => {
    const { parseFailOpenState } = await import("../cli/commands/deployments.js");
    expect(parseFailOpenState("open")).toBe(true);
    expect(parseFailOpenState("closed")).toBe(false);
    for (const bad of ["", "OPEN", "true", "false", "close"]) {
      expect(() => parseFailOpenState(bad)).toThrow("must be open or closed");
    }
  });

  it("describes a fail_open value without treating missing as closed", async () => {
    const { describeFailOpen } = await import("../cli/commands/deployments.js");
    expect(describeFailOpen(false)).toBe("closed");
    expect(describeFailOpen(true)).toBe("open");
    expect(describeFailOpen(undefined)).toBe("unknown");
  });

  it("registers fail-open with project, environment, set, expect and auth options", () => {
    const program = new Command();
    registerDeploymentsCommand(program, () => "human");
    const failOpen = program.commands
      .find((command) => command.name() === "deployments")
      ?.commands.find((command) => command.name() === "fail-open");
    expect(failOpen).toBeDefined();
    expect(failOpen?.options.map((option) => option.long)).toEqual([
      "--project",
      "--environment",
      "--set",
      "--expect",
      "--wrangler-auth",
      "--global-api-key",
      "--email",
    ]);
  });
});
