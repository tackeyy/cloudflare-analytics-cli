import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
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

  it("registers fail-open with project, set, expect and auth options", () => {
    const program = new Command();
    registerDeploymentsCommand(program, () => "human");
    const failOpen = program.commands
      .find((command) => command.name() === "deployments")
      ?.commands.find((command) => command.name() === "fail-open");
    expect(failOpen).toBeDefined();
    expect(failOpen?.options.map((option) => option.long)).toEqual([
      "--project",
      "--set",
      "--expect",
      "--wrangler-auth",
      "--global-api-key",
      "--email",
    ]);
  });
});

describe("runFailOpen", () => {
  type Values = { production: boolean | undefined; preview: boolean | undefined };
  const fakeClient = (read: Values | Error, stored?: Values | Error) => {
    const calls: string[] = [];
    return {
      calls,
      async getPagesFailOpen() {
        calls.push("get");
        if (read instanceof Error) throw read;
        return read;
      },
      async setPagesFailOpen(_project: string, failOpen: boolean) {
        calls.push(`set:${failOpen}`);
        if (stored instanceof Error) throw stored;
        return stored ?? { production: failOpen, preview: failOpen };
      },
    };
  };

  it("passes --expect closed only when both environments are closed", async () => {
    const { runFailOpen } = await import("../cli/commands/deployments.js");
    const ok = await runFailOpen(fakeClient({ production: false, preview: false }), {
      project: "p",
      expect: "closed",
    });
    expect(ok.exitCode).toBe(0);
    expect(ok.modes).toEqual({ production: "closed", preview: "closed" });

    for (const values of [
      { production: false, preview: true },
      { production: true, preview: false },
      { production: false, preview: undefined },
      { production: undefined, preview: undefined },
      { production: true, preview: true },
    ]) {
      const result = await runFailOpen(fakeClient(values), { project: "p", expect: "closed" });
      expect(result.exitCode, JSON.stringify(values)).toBe(2);
    }
  });

  it("reports without failing when no expectation is given", async () => {
    const { runFailOpen } = await import("../cli/commands/deployments.js");
    const result = await runFailOpen(fakeClient({ production: true, preview: undefined }), { project: "p" });
    expect(result.exitCode).toBe(0);
    expect(result.modes).toEqual({ production: "open", preview: "unknown" });
  });

  it("returns exit code 1 when the API read fails", async () => {
    const { runFailOpen } = await import("../cli/commands/deployments.js");
    const result = await runFailOpen(fakeClient(new Error("HTTP 403")), { project: "p", expect: "closed" });
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("HTTP 403");
  });

  it("sets both environments, then re-reads to confirm the stored mode", async () => {
    const { runFailOpen } = await import("../cli/commands/deployments.js");
    const client = fakeClient({ production: false, preview: false });
    const result = await runFailOpen(client, { project: "p", set: "closed" });
    expect(client.calls).toEqual(["set:false", "get"]);
    expect(result.exitCode).toBe(0);
    expect(result.modes).toEqual({ production: "closed", preview: "closed" });
  });

  it("fails with exit code 1 when the PATCH response or the re-read does not match", async () => {
    const { runFailOpen } = await import("../cli/commands/deployments.js");
    const cases: Array<[Values, Values]> = [
      [{ production: false, preview: false }, { production: false, preview: true }],
      [{ production: false, preview: false }, { production: undefined, preview: false }],
      [{ production: true, preview: false }, { production: false, preview: false }],
    ];
    for (const [read, stored] of cases) {
      const result = await runFailOpen(fakeClient(read, stored), { project: "p", set: "closed" });
      expect(result.exitCode, JSON.stringify({ read, stored })).toBe(1);
    }
  });

  it("rejects invalid modes before calling the API", async () => {
    const { runFailOpen } = await import("../cli/commands/deployments.js");
    const client = fakeClient({ production: false, preview: false });
    for (const options of [{ project: "p", set: "false" }, { project: "p", expect: "true" }]) {
      const result = await runFailOpen(client, options);
      expect(result.exitCode).toBe(1);
    }
    expect(client.calls).toEqual([]);
  });
});

describe("fail-open command action", () => {
  const run = async (
    args: string[],
    values: { production: boolean | undefined; preview: boolean | undefined } | Error,
  ) => {
    const program = new Command();
    program.exitOverride();
    const logs: string[] = [];
    const errors: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line) => void logs.push(String(line)));
    const error = vi.spyOn(console, "error").mockImplementation((line) => void errors.push(String(line)));
    registerDeploymentsCommand(program, () => "human", {
      createFailOpenClient: () => ({
        async getPagesFailOpen() {
          if (values instanceof Error) throw values;
          return values;
        },
        async setPagesFailOpen(_project: string, failOpen: boolean) {
          return { production: failOpen, preview: failOpen };
        },
      }),
    });
    const previous = process.exitCode;
    process.exitCode = undefined;
    try {
      await program.parseAsync(["node", "cfa", "deployments", "fail-open", ...args]);
      return { exitCode: process.exitCode, logs, errors };
    } finally {
      process.exitCode = previous;
      log.mockRestore();
      error.mockRestore();
    }
  };

  it("sets process.exitCode to 2 when --expect does not match", async () => {
    const result = await run(["--project", "p", "--expect", "closed"], { production: false, preview: true });
    expect(result.exitCode).toBe(2);
    expect(result.logs).toEqual(["p\tproduction=closed\tpreview=open"]);
  });

  it("sets process.exitCode to 0 when both environments match", async () => {
    const result = await run(["--project", "p", "--expect", "closed"], { production: false, preview: false });
    expect(result.exitCode).toBe(0);
  });

  it("sets process.exitCode to 1 on API errors", async () => {
    const result = await run(["--project", "p", "--expect", "closed"], new Error("HTTP 403"));
    expect(result.exitCode).toBe(1);
    expect(result.errors.join("\n")).toContain("HTTP 403");
  });
});

