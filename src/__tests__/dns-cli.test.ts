import { describe, expect, it } from "vitest";
import { parseTtl } from "../cli/commands/dns.js";

describe("DNS CLI", () => {
  it("accepts valid integer TTL values", () => {
    expect(parseTtl("1")).toBe(1);
    expect(parseTtl("60")).toBe(60);
  });

  it("rejects partial, decimal, zero, and negative TTL values", () => {
    expect(() => parseTtl("60junk")).toThrow("TTL must be a positive integer");
    expect(() => parseTtl("60.5")).toThrow("TTL must be a positive integer");
    expect(() => parseTtl("0")).toThrow("TTL must be a positive integer");
    expect(() => parseTtl("-1")).toThrow("TTL must be a positive integer");
  });
});
