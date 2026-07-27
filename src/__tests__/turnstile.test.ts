import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { persistTurnstileSecret, printTurnstileWidget } from "../cli/commands/turnstile.js";

describe("Turnstile CLI", () => {
  it("prints only public widget metadata", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    printTurnstileWidget(
      {
        sitekey: "public-site-key",
        secret: "must-not-be-printed",
        name: "CSC AI application assessment",
        domains: ["example.pages.dev"],
        mode: "managed",
      },
      "json",
    );

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("public-site-key");
    expect(output).not.toContain("must-not-be-printed");
    log.mockRestore();
  });

  it("persists the secret in a 0600 file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cfa-turnstile-"));
    const secretFile = join(dir, "secret.txt");

    await persistTurnstileSecret(secretFile, "private-secret");

    expect(await readFile(secretFile, "utf8")).toBe("private-secret");
    expect((await stat(secretFile)).mode & 0o777).toBe(0o600);
  });
});
