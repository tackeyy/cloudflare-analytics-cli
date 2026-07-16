import { describe, expect, it } from "vitest";
import {
  buildPagesDeployArgs,
  buildPagesProjectCreateArgs,
  buildPagesSecretPutArgs,
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
