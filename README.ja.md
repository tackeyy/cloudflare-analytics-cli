[English](README.md) | **日本語**

# cloudflare-analytics-cli (cfa)

Cloudflare Web Analytics のCLIツール。ターミナルからページビュー、訪問者数、リファラーなどを確認できます。

## 特徴

- **サマリーダッシュボード** — PV/訪問数の合計 + トップページ・リファラー・国
- **ディメンション別クエリ** — ページ、リファラー、国、デバイス、ブラウザ
- **時系列データ** — 日別のPV/訪問数推移
- **マルチサイト対応** — `--site-tag` で複数サイトを管理
- **柔軟な出力形式** — テーブル表示、JSON（`--json`）、TSV（`--plain`）
- **パスフィルタ** — URLパスパターンでフィルタリング
- **Pages運用** — プロジェクト・デプロイ確認と静的ビルドの公開
- **DNS運用** — レコード一覧、dry-run、完全一致による安全な作成・更新

## インストール

```bash
npm install -g cloudflare-analytics-cli
```

## セットアップ

環境変数にCloudflareの認証情報を設定:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CFA_SITE_TAG="your-default-site-tag"  # 任意
```

APIトークンには用途に応じて **Account Analytics: Read**、DNS操作には **Zone: Read / DNS: Edit** 権限が必要です。

## 使い方

```bash
# 今日のサマリー
cfa summary

# 期間指定のサマリー
cfa summary --from 2026-03-01 --to 2026-03-22

# トップページ
cfa pages --from 2026-03-01 --to 2026-03-22 --limit 20

# リファラー一覧
cfa referrers --from 2026-03-01 --to 2026-03-22

# 国別
cfa countries --from 2026-03-01 --to 2026-03-22

# デバイス別
cfa devices --from 2026-03-01 --to 2026-03-22

# ブラウザ別
cfa browsers --from 2026-03-01 --to 2026-03-22

# 日別時系列
cfa timeseries --from 2026-03-01 --to 2026-03-22

# パスフィルタ
cfa pages --filter "/lp/*" --from 2026-03-01 --to 2026-03-22

# 登録サイト一覧
cfa sites

# 認証テスト
cfa auth test

# Wrangler OAuthセッションを更新し、その認証で確認
cfa auth wrangler-refresh
cfa auth test --wrangler-auth

# 別アカウントのGlobal API Keyを明示して確認
cfa auth test --global-api-key --email owner@example.com

# Cloudflare Pagesのプロジェクトと最近のデプロイを確認
cfa deployments projects
cfa deployments list --project my-project

# 静的ビルドを本番ブランチへデプロイ
cfa deployments deploy --project my-project --directory dist --branch master

# Pages Secretを標準入力から登録し、暗号化済みSecret名を確認
printf '%s' "$SECRET_VALUE" | cfa deployments secret-put \
  --project my-project --key API_TOKEN --environment production
cfa deployments secret-list --project my-project --environment production

# DNSレコードを確認
cfa dns list --zone example.com --type TXT
cfa dns list --zone example.com --type TXT --wrangler-auth
cfa dns list --zone example.com --type TXT --global-api-key --email owner@example.com

# DNSレコードの変更内容を事前確認してから反映
cfa --json dns upsert --zone example.com --type TXT --name example.com \
  --content 'v=spf1 include:_spf.google.com ~all' --match-content-prefix 'v=spf1' --ttl 1 --dry-run
cfa --json dns upsert --zone example.com --type TXT --name example.com \
  --content 'v=spf1 include:_spf.google.com ~all' --match-content-prefix 'v=spf1' --ttl 1
```

既存のTXTレコードを更新する場合は `--match-content-prefix` が必須です。同名のGoogle所有確認レコードなどを保持したまま、指定したプレフィックスのレコードだけを更新します。

`--wrangler-auth` は公式の `wrangler auth token --json` を内部利用し、plaintext設定・OS keyringのどちらからでもOAuthトークンを秘密値を表示せず取得します。期限切れトークンはWranglerが自動更新します。環境変数のAPIトークンやAPIキーは子プロセスから除外し、保存済みOAuthを明示的に選択します。DNS・認証確認だけなら `CLOUDFLARE_ACCOUNT_ID` は不要です。

`--global-api-key --email <address>` は環境変数 `CLOUDFLARE_API_KEY` を `X-Auth-Key` として利用します。Bearer/OAuthとは同時指定できず、秘密値は出力しません。

## コントリビューション

コントリビューションを歓迎します。変更を加える前に、まず Issue を作成して議論してください。

```bash
git clone https://github.com/tackeyy/cloudflare-analytics-cli.git
cd cloudflare-analytics-cli
npm install --ignore-scripts
npm run build
npm test
```

## ライセンス

[MIT](LICENSE)
