import type { AnalyticsRow, SummaryData, TimeseriesPoint, SiteInfo, OutputMode } from "./types.js";

/** Format analytics rows for output. */
export function formatRows(
  rows: AnalyticsRow[],
  dimensionKey: string,
  mode: OutputMode,
): string {
  if (mode === "json") {
    return JSON.stringify(rows, null, 2);
  }

  if (mode === "plain") {
    return rows
      .map((r) => `${r.dimensions[dimensionKey]}\t${r.count}\t${r.visits}`)
      .join("\n");
  }

  // human
  if (rows.length === 0) return "No data found.";

  const maxDimLen = Math.max(
    dimensionKey.length,
    ...rows.map((r) => (r.dimensions[dimensionKey] || "(empty)").length),
  );
  const header = `${dimensionKey.padEnd(maxDimLen)}  ${"PV".padStart(8)}  ${"Visits".padStart(8)}`;
  const separator = "-".repeat(header.length);

  const lines = rows.map((r) => {
    const dim = (r.dimensions[dimensionKey] || "(empty)").padEnd(maxDimLen);
    return `${dim}  ${String(r.count).padStart(8)}  ${String(r.visits).padStart(8)}`;
  });

  return [header, separator, ...lines].join("\n");
}

/** Format summary data for output. */
export function formatSummary(
  data: SummaryData,
  dateRange: { from: string; to: string },
  mode: OutputMode,
): string {
  if (mode === "json") {
    return JSON.stringify(data, null, 2);
  }

  if (mode === "plain") {
    return `${data.pageviews}\t${data.visits}`;
  }

  // human
  const lines: string[] = [
    `Analytics Summary (${dateRange.from} ~ ${dateRange.to})`,
    `${"=".repeat(50)}`,
    `Total Pageviews: ${data.pageviews.toLocaleString()}`,
    `Total Visits:    ${data.visits.toLocaleString()}`,
    "",
  ];

  if (data.topPages.length > 0) {
    lines.push("Top Pages:");
    for (const row of data.topPages) {
      lines.push(`  ${(row.dimensions.requestPath || "/").padEnd(40)} ${String(row.count).padStart(8)} PV`);
    }
    lines.push("");
  }

  if (data.topReferrers.length > 0) {
    lines.push("Top Referrers:");
    for (const row of data.topReferrers) {
      lines.push(`  ${(row.dimensions.refererHost || "(direct)").padEnd(40)} ${String(row.count).padStart(8)} PV`);
    }
    lines.push("");
  }

  if (data.topCountries.length > 0) {
    lines.push("Top Countries:");
    for (const row of data.topCountries) {
      lines.push(`  ${(row.dimensions.countryName || "(unknown)").padEnd(40)} ${String(row.count).padStart(8)} PV`);
    }
  }

  return lines.join("\n");
}

/** Format timeseries data for output. */
export function formatTimeseries(
  points: TimeseriesPoint[],
  mode: OutputMode,
): string {
  if (mode === "json") {
    return JSON.stringify(points, null, 2);
  }

  if (mode === "plain") {
    return points
      .map((p) => `${p.date}\t${p.pageviews}\t${p.visits}`)
      .join("\n");
  }

  // human
  if (points.length === 0) return "No data found.";

  const header = `${"Date".padEnd(12)}  ${"PV".padStart(8)}  ${"Visits".padStart(8)}`;
  const separator = "-".repeat(header.length);

  const lines = points.map((p) => {
    return `${p.date.padEnd(12)}  ${String(p.pageviews).padStart(8)}  ${String(p.visits).padStart(8)}`;
  });

  return [header, separator, ...lines].join("\n");
}

/** Format site info for output. */
export function formatSites(
  sites: SiteInfo[],
  mode: OutputMode,
): string {
  if (mode === "json") {
    return JSON.stringify(sites, null, 2);
  }

  if (mode === "plain") {
    return sites
      .map((s) => `${s.siteTag}\t${s.host}\t${s.autoInstall}\t${s.created}`)
      .join("\n");
  }

  // human
  if (sites.length === 0) return "No sites registered.";

  const header = `${"Site Tag".padEnd(36)}  ${"Host".padEnd(30)}  ${"Auto".padEnd(6)}  Created`;
  const separator = "-".repeat(header.length);

  const lines = sites.map((s) => {
    const auto = s.autoInstall ? "Yes" : "No";
    return `${s.siteTag.padEnd(36)}  ${s.host.padEnd(30)}  ${auto.padEnd(6)}  ${s.created.slice(0, 10)}`;
  });

  return [header, separator, ...lines].join("\n");
}
