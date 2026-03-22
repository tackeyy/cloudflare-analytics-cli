# cloudflare-analytics-cli

## 概要
Cloudflare Web Analytics CLI ツール。GraphQL APIでRUMデータを取得し、テーブル/JSON/TSVで出力する。

## テックスタック
- TypeScript (ESM), Node.js 22+
- commander (CLI), vitest (テスト)
- fetch (Node.js標準)
- Cloudflare GraphQL API (`rumPageloadEventsAdaptiveGroups`)

## プロジェクト構造
```
src/
├── cli/
│   ├── index.ts                # CLIエントリポイント
│   └── commands/               # サブコマンド（summary, pages, referrers等）
├── lib/
│   ├── types.ts                # 型定義
│   ├── config.ts               # 環境変数読み込み
│   ├── queries.ts              # GraphQLクエリビルダー
│   ├── client.ts               # APIクライアント (GraphQL + REST)
│   ├── formatter.ts            # 出力フォーマッター (human/json/plain)
│   └── index.ts                # re-export
└── __tests__/                  # テスト
```

## 開発コマンド
```bash
npm run build     # tscでビルド
npm test          # vitest実行
npm run test:watch # vitest watch
```

## 環境変数
- `CLOUDFLARE_API_TOKEN` (必須) — APIトークン
- `CLOUDFLARE_ACCOUNT_ID` (必須) — アカウントID
- `CFA_SITE_TAG` (任意) — デフォルトのサイトタグ

## API
- GraphQL: `POST https://api.cloudflare.com/client/v4/graphql`
- REST: `https://api.cloudflare.com/client/v4/accounts/{id}/rum/site_info/*`
