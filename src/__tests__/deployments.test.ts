import { describe, expect, it } from "vitest";
import { buildPagesDeployArgs } from "../cli/commands/deployments.js";

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
