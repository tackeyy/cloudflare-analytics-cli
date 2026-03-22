import type { Dimension, QueryOptions } from "./types.js";

/** Build a GraphQL query for RUM pageload events. */
export function buildAnalyticsQuery(
  accountId: string,
  options: QueryOptions,
  dimensions: Dimension[],
): { query: string; variables: Record<string, unknown> } {
  const orderBy = dimensions.includes("date") ? "date_ASC" : "count_DESC";

  const filterParts: string[] = [
    `siteTag: $siteTag`,
    `date_geq: $dateStart`,
    `date_leq: $dateEnd`,
  ];

  if (options.filter) {
    filterParts.push(`requestPath_like: $pathFilter`);
  }

  const filter = filterParts.join(", ");
  const limit = options.limit ?? 10;

  const query = `
    query GetAnalytics(
      $accountId: String!
      $siteTag: String!
      $dateStart: Date!
      $dateEnd: Date!
      $limit: Int!
      ${options.filter ? "$pathFilter: String!" : ""}
    ) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          rumPageloadEventsAdaptiveGroups(
            filter: { ${filter} }
            limit: $limit
            orderBy: [${orderBy}]
          ) {
            dimensions {
              ${dimensions.join("\n              ")}
            }
            count
            sum {
              visits
            }
          }
        }
      }
    }
  `.trim();

  const variables: Record<string, unknown> = {
    accountId,
    siteTag: options.siteTag,
    dateStart: options.dateRange.from,
    dateEnd: options.dateRange.to,
    limit,
  };

  if (options.filter) {
    variables.pathFilter = options.filter;
  }

  return { query, variables };
}

/** Build a summary query that fetches multiple dimension groups. */
export function buildSummaryQuery(
  accountId: string,
  options: QueryOptions,
): { query: string; variables: Record<string, unknown> } {
  const filterBase = [
    `siteTag: $siteTag`,
    `date_geq: $dateStart`,
    `date_leq: $dateEnd`,
  ].join(", ");

  const query = `
    query GetSummary(
      $accountId: String!
      $siteTag: String!
      $dateStart: Date!
      $dateEnd: Date!
    ) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          total: rumPageloadEventsAdaptiveGroups(
            filter: { ${filterBase} }
            limit: 1
          ) {
            count
            sum { visits }
          }
          topPages: rumPageloadEventsAdaptiveGroups(
            filter: { ${filterBase} }
            limit: 5
            orderBy: [count_DESC]
          ) {
            dimensions { requestPath }
            count
            sum { visits }
          }
          topReferrers: rumPageloadEventsAdaptiveGroups(
            filter: { ${filterBase} }
            limit: 5
            orderBy: [count_DESC]
          ) {
            dimensions { refererHost }
            count
            sum { visits }
          }
          topCountries: rumPageloadEventsAdaptiveGroups(
            filter: { ${filterBase} }
            limit: 5
            orderBy: [count_DESC]
          ) {
            dimensions { countryName }
            count
            sum { visits }
          }
        }
      }
    }
  `.trim();

  const variables = {
    accountId,
    siteTag: options.siteTag,
    dateStart: options.dateRange.from,
    dateEnd: options.dateRange.to,
  };

  return { query, variables };
}
