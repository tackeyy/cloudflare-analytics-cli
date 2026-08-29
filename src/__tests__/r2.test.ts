import { beforeEach, describe, expect, it, vi } from "vitest";
import { CfaClient } from "../lib/client.js";
import type { CfaConfig } from "../lib/types.js";

const config: CfaConfig = {
  apiToken: "test-token",
  accountId: "test-account",
};

function response(result: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({ success: true, result }),
    text: () => Promise.resolve(""),
  };
}

function errorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.reject(new Error("not json")),
    text: () => Promise.resolve(body),
  };
}

describe("R2 buckets", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists buckets for the configured account", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      response({
        buckets: [
          { name: "donna-backup", creation_date: "2026-08-01T00:00:00.000Z", location: "APAC" },
          { name: "assets", creation_date: "2026-01-15T00:00:00.000Z" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    const buckets = await client.listR2Buckets();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/accounts/test-account/r2/buckets");

    expect(buckets).toEqual([
      { name: "donna-backup", creationDate: "2026-08-01T00:00:00.000Z", location: "APAC" },
      { name: "assets", creationDate: "2026-01-15T00:00:00.000Z", location: undefined },
    ]);
  });

  it("returns an empty list when the account has no buckets", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ buckets: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    await expect(client.listR2Buckets()).resolves.toEqual([]);
  });

  it("treats a missing buckets field as an empty list", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    await expect(client.listR2Buckets()).resolves.toEqual([]);
  });

  it("requires an account id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient({ apiToken: "test-token" });
    await expect(client.listR2Buckets()).rejects.toThrow(
      /CLOUDFLARE_ACCOUNT_ID is required/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a permission error instead of reporting zero buckets", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        errorResponse(
          403,
          '{"success":false,"errors":[{"code":10000,"message":"Authentication error"}]}',
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    await expect(client.listR2Buckets()).rejects.toThrow(/HTTP 403/);
  });

  it("does not include the api token in the thrown error message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(403, '{"errors":[{"message":"denied"}]}'));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    await expect(client.listR2Buckets()).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("test-token"),
      }),
    );
  });
});
