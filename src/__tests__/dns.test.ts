import { beforeEach, describe, expect, it, vi } from "vitest";
import { CfaClient } from "../lib/client.js";
import type { CfaConfig } from "../lib/types.js";

const config: CfaConfig = {
  apiToken: "test-token",
  accountId: "test-account",
};

function response(
  result: unknown,
  resultInfo?: { page: number; per_page: number; total_pages: number },
) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({ success: true, result, result_info: resultInfo }),
    text: () => Promise.resolve(""),
  };
}

describe("DNS records", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the zone and lists matching DNS records", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
      .mockResolvedValueOnce(
        response([
          {
            id: "record-id",
            zone_id: "zone-id",
            zone_name: "wedgeai.co.jp",
            name: "_dmarc.wedgeai.co.jp",
            type: "TXT",
            content: "v=DMARC1; p=none",
            ttl: 1,
            proxied: false,
            comment: "Managed by cfa",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    const records = await client.listDnsRecords("wedgeai.co.jp", {
      type: "TXT",
      name: "_dmarc.wedgeai.co.jp",
    });

    expect(records).toEqual([
      {
        id: "record-id",
        zoneId: "zone-id",
        zoneName: "wedgeai.co.jp",
        name: "_dmarc.wedgeai.co.jp",
        type: "TXT",
        content: "v=DMARC1; p=none",
        ttl: 1,
        proxied: false,
        comment: "Managed by cfa",
      },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.cloudflare.com/client/v4/zones?name=wedgeai.co.jp&status=active",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records?type=TXT&name=_dmarc.wedgeai.co.jp&per_page=100&page=1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reads every page and filters API results by exact type and name", async () => {
    const matching = {
      id: "record-id",
      zone_id: "zone-id",
      zone_name: "wedgeai.co.jp",
      type: "TXT",
      name: "wedgeai.co.jp",
      content: "v=spf1 include:_spf.google.com ~all",
      ttl: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
      .mockResolvedValueOnce(
        response(
          [{ ...matching, id: "wrong-type", type: "CNAME" }],
          { page: 1, per_page: 100, total_pages: 2 },
        ),
      )
      .mockResolvedValueOnce(
        response([matching], { page: 2, per_page: 100, total_pages: 2 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const records = await new CfaClient(config).listDnsRecords("wedgeai.co.jp", {
      type: "TXT",
      name: "wedgeai.co.jp",
    });

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("record-id");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records?type=TXT&name=wedgeai.co.jp&per_page=100&page=2",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("plans a create without writing in dry-run mode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    const result = await client.upsertDnsRecord(
      "wedgeai.co.jp",
      {
        type: "TXT",
        name: "wedgeai.co.jp",
        content: "v=spf1 include:_spf.google.com ~all",
        ttl: 1,
        comment: "Managed by cfa",
      },
      { dryRun: true },
    );

    expect(result).toEqual(
      expect.objectContaining({ action: "create", changed: true, dryRun: true }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("creates a record when no exact type and name match exists", async () => {
    const input = {
      type: "TXT",
      name: "wedgeai.co.jp",
      content: "v=spf1 include:_spf.google.com ~all",
      ttl: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          id: "record-id",
          zone_id: "zone-id",
          zone_name: "wedgeai.co.jp",
          ...input,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new CfaClient(config).upsertDnsRecord("wedgeai.co.jp", input);

    expect(result.action).toBe("create");
    expect(result.changed).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("creates alongside unrelated TXT records when a content prefix is provided", async () => {
    const verificationRecord = {
      id: "verification-id",
      zone_id: "zone-id",
      zone_name: "wedgeai.co.jp",
      type: "TXT",
      name: "wedgeai.co.jp",
      content: "google-site-verification=existing-value",
      ttl: 1,
    };
    const input = {
      type: "TXT",
      name: "wedgeai.co.jp",
      content: "v=spf1 include:_spf.google.com ~all",
      ttl: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
      .mockResolvedValueOnce(response([verificationRecord]))
      .mockResolvedValueOnce(
        response({
          id: "spf-id",
          zone_id: "zone-id",
          zone_name: "wedgeai.co.jp",
          ...input,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new CfaClient(config).upsertDnsRecord(
      "wedgeai.co.jp",
      input,
      { matchContentPrefix: "v=spf1" },
    );

    expect(result.action).toBe("create");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });

  it("updates a differing record and leaves an identical record unchanged", async () => {
    const input = {
      type: "TXT",
      name: "_dmarc.wedgeai.co.jp",
      content: "v=DMARC1; p=none; rua=mailto:t@wedgeai.co.jp; pct=100",
      ttl: 1,
    };
    const existing = {
      id: "record-id",
      zone_id: "zone-id",
      zone_name: "wedgeai.co.jp",
      ...input,
      content: "v=DMARC1; p=none",
    };
    const updated = { ...existing, content: input.content };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
      .mockResolvedValueOnce(response([existing]))
      .mockResolvedValueOnce(response(updated))
      .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
      .mockResolvedValueOnce(response([updated]));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CfaClient(config);
    const updateResult = await client.upsertDnsRecord("wedgeai.co.jp", input, {
      matchContentPrefix: "v=DMARC1",
    });
    const noopResult = await client.upsertDnsRecord("wedgeai.co.jp", input, {
      matchContentPrefix: "v=DMARC1",
    });

    expect(updateResult.action).toBe("update");
    expect(updateResult.previousRecord).toEqual(
      expect.objectContaining({ id: "record-id", content: "v=DMARC1; p=none" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records/record-id",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify(input) }),
    );
    expect(noopResult).toEqual(
      expect.objectContaining({ action: "noop", changed: false, dryRun: false }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("refuses to upsert when duplicate records exist", async () => {
    const duplicate = {
      id: "record-id",
      zone_id: "zone-id",
      zone_name: "wedgeai.co.jp",
      type: "TXT",
      name: "wedgeai.co.jp",
      content: "one",
      ttl: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
        .mockResolvedValueOnce(response([duplicate, { ...duplicate, id: "record-id-2", content: "other" }])),
    );

    await expect(
      new CfaClient(config).upsertDnsRecord(
        "wedgeai.co.jp",
        {
          type: "TXT",
          name: "wedgeai.co.jp",
          content: "new",
        },
        { matchContentPrefix: "o" },
      ),
    ).rejects.toThrow("Multiple TXT records found for wedgeai.co.jp");
  });

  it("refuses to replace an existing TXT record without a content prefix", async () => {
    const verificationRecord = {
      id: "verification-id",
      zone_id: "zone-id",
      zone_name: "wedgeai.co.jp",
      type: "TXT",
      name: "wedgeai.co.jp",
      content: "google-site-verification=existing-value",
      ttl: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response([{ id: "zone-id", name: "wedgeai.co.jp", status: "active" }]))
        .mockResolvedValueOnce(response([verificationRecord])),
    );

    await expect(
      new CfaClient(config).upsertDnsRecord("wedgeai.co.jp", {
        type: "TXT",
        name: "wedgeai.co.jp",
        content: "v=spf1 include:_spf.google.com ~all",
      }),
    ).rejects.toThrow("matchContentPrefix is required");
  });
});
