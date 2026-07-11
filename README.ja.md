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

APIトークンには **Account Analytics: Read** 権限が必要です。

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

# Cloudflare Pagesのプロジェクトと最近のデプロイを確認
cfa deployments projects
cfa deployments list --project my-project

# 静的ビルドを本番ブランチへデプロイ
cfa deployments deploy --project my-project --directory dist --branch master
```

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
