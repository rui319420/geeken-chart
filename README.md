# 技研チャート

サークルメンバーのGitHub・Discordのデータを可視化するWebアプリケーションです。

## 技術スタック

| 技術 | 用途 |
|---|---|
| Next.js (App Router) | フロント＋API |
| NextAuth.js | GitHub OAuth認証 |
| Prisma | ORM |
| Supabase (PostgreSQL) | データベース |
| Upstash (Redis) | キャッシュ |
| Discord.js | Discord Bot |
| Vercel | デプロイ |
| Railway | Bot ホスティング |

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/rui319420/geeken-chart.git
cd geeken-chart
```

### 2. パッケージをインストール

```bash
npm install
```

### 3. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` に各サービスのキーを設定してください。
値はリーダーに確認するか、Vercelの管理画面から取得してください。

### 4. DBのマイグレーション

```bash
npx prisma migrate dev
```

### 5. 開発サーバーを起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

## 開発ルール

- `main` への直接pushは禁止（必ずPRを通す）
- ブランチ名：`feature/機能名` or `fix/バグ名`
- コミットメッセージ：`feat:` / `fix:` / `docs:` / `refactor:` などのプレフィックスをつける
- タスク管理はGitHub Issuesで行う（self assigned必須）
- **APIキーは絶対にコミットしない**

## ブランチ運用

```
main        ← 本番環境（直接push禁止）
 └─ develop ← 開発統合ブランチ
      └─ feature/xxx ← 各機能の開発ブランチ
```