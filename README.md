# cloudflare-analytics-cli (cfa)

**English** | [日本語](README.ja.md)

A command-line tool for Cloudflare Web Analytics. Query page views, visitors, referrers, and more from your terminal.

## Features

- **Summary dashboard** — Total PV/visits with top pages, referrers, and countries
- **Dimension queries** — Pages, referrers, countries, devices, browsers
- **Timeseries** — Daily PV/visits over a date range
- **Multi-site support** — Manage multiple sites with `--site-tag`
- **Flexible output** — Human-readable tables, JSON (`--json`), or TSV (`--plain`)
- **Path filtering** — Filter analytics by URL path pattern
- **Pages operations** — Inspect projects/deployments and publish static builds
- **DNS operations** — List records, dry-run changes, and safely upsert exact matches

## Installation

```bash
npm install -g cloudflare-analytics-cli
```

## Setup

Set your Cloudflare credentials as environment variables:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CFA_SITE_TAG="your-default-site-tag"  # optional
```

Your API token needs **Account Analytics: Read** permission. DNS operations additionally require **Zone: Read / DNS: Edit**.

## Usage

```bash
# Summary for today
cfa summary

# Summary for a date range
cfa summary --from 2026-03-01 --to 2026-03-22

# Top pages
cfa pages --from 2026-03-01 --to 2026-03-22 --limit 20

# Top referrers
cfa referrers --from 2026-03-01 --to 2026-03-22

# Country breakdown
cfa countries --from 2026-03-01 --to 2026-03-22

# Device types
cfa devices --from 2026-03-01 --to 2026-03-22

# Browser breakdown
cfa browsers --from 2026-03-01 --to 2026-03-22

# Daily timeseries
cfa timeseries --from 2026-03-01 --to 2026-03-22

# Filter by path
cfa pages --filter "/lp/*" --from 2026-03-01 --to 2026-03-22

# List registered sites
cfa sites

# Test authentication
cfa auth test

# Refresh and use the local Wrangler OAuth session
cfa auth wrangler-refresh
cfa auth test --wrangler-auth

# List Cloudflare Pages projects and recent deployments
cfa deployments projects
cfa deployments list --project my-project

# Deploy a static build to the production branch
cfa deployments deploy --project my-project --directory dist --branch master

# List DNS records
cfa dns list --zone example.com --type TXT
cfa dns list --zone example.com --type TXT --wrangler-auth

# Preview a DNS change, then apply it
cfa --json dns upsert --zone example.com --type TXT --name example.com \
  --content 'v=spf1 include:_spf.google.com ~all' --match-content-prefix 'v=spf1' --ttl 1 --dry-run
cfa --json dns upsert --zone example.com --type TXT --name example.com \
  --content 'v=spf1 include:_spf.google.com ~all' --match-content-prefix 'v=spf1' --ttl 1

# JSON output (for scripting)
cfa --json summary --from 2026-03-01 --to 2026-03-22

# TSV output (for piping)
cfa --plain pages --from 2026-03-01 --to 2026-03-22 | head -5
```

Updating an existing TXT record requires `--match-content-prefix`. This preserves unrelated same-name records such as domain-verification TXT values.

`--wrangler-auth` calls the official `wrangler auth token --json` command internally, supporting both plaintext credentials and the OS keyring without printing the OAuth token. Wrangler refreshes expired tokens automatically. API-token and API-key environment variables are removed from the child process so the stored OAuth session is selected explicitly. DNS and authentication checks do not require `CLOUDFLARE_ACCOUNT_ID`.

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |
| `--plain` | Output in TSV format (for piping) |
| `--site-tag <tag>` | Specify site tag (overrides `CFA_SITE_TAG`) |
| `--from <YYYY-MM-DD>` | Start date (default: today) |
| `--to <YYYY-MM-DD>` | End date (default: today) |
| `--limit <N>` | Number of results (default: 10) |
| `--filter <path>` | Path filter pattern (e.g. `/lp/*`) |

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `CLOUDFLARE_API_TOKEN` | Conditional | Cloudflare API Token; omit when using `--wrangler-auth` |
| `CLOUDFLARE_ACCOUNT_ID` | Conditional | Required for account analytics and Pages operations; not for DNS/auth checks |
| `CFA_SITE_TAG` | No | Default site tag |

## Library Usage

```typescript
import { CfaClient, loadConfig } from "cloudflare-analytics-cli";

const config = loadConfig();
const client = new CfaClient(config);

const summary = await client.getSummary({
  siteTag: "your-site-tag",
  dateRange: { from: "2026-03-01", to: "2026-03-22" },
});

console.log(`Total PV: ${summary.pageviews}`);
```

## Development

```bash
git clone https://github.com/tackeyy/cloudflare-analytics-cli.git
cd cloudflare-analytics-cli
npm install --ignore-scripts
npm run build
npm test
```

## License

MIT
