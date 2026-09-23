# 技研チャート

サークルメンバーのGitHub・Discordのデータを可視化するWebアプリケーションです。

## 技術スタック

| 技術                  | 用途             |
| --------------------- | ---------------- |
| Next.js (App Router)  | フロント＋API    |
| NextAuth.js           | GitHub OAuth認証 |
| Prisma                | ORM              |
| Supabase (PostgreSQL) | データベース     |
| Upstash (Redis)       | キャッシュ       |
| Discord.js            | Discord Bot      |
| Vercel                | デプロイ         |
| Railway               | Bot ホスティング |

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

## Discord連携と管理API（Issue #109）

### 配置手順

1. 対象DBをバックアップし、Web側で `npx prisma migrate deploy` を実行する。
   今回追加するのは `DiscordLinkCode` と `DiscordLinkRateLimit` の2テーブル。
2. WebとBotを同じDBへ向けて更新する。旧Botを停止し、新Botをビルド・再起動する。
   移行中に旧Botのユーザー名だけによる連携を残さないこと。
3. Botの `DISCORD_CLIENT_ID` を設定し、再起動時にサーバーのスラッシュコマンドを再登録する。
4. Webの `ADMIN_USER_IDS` に管理者の `User.id` をカンマ区切りで設定する。
   GitHub名・Discord ID・Organization所属では判定しない。未設定の場合は全員拒否する。
5. 設定画面でコードを発行し、対象Discordサーバーで `/link code:<コード>` を実行する。
   コードは5分間・一回限り。再発行で以前のコードを無効化し、DBにはSHA-256ハッシュのみ保存する。
   発行はユーザー単位、入力はDiscord ID単位で各5分間に5回まで。DB障害時は拒否する。

既存の連携は自動削除しない。旧方式での本人確認は保証できないため、運用者は既存連携を確認し、
必要に応じて本人に `/unlink` → 新方式での再連携を案内する。
解除すると紐付け済みの活動集計も削除するが、生の活動集計は残り、本人確認後に再構築する。
Botは連携情報のインメモリキャッシュを使わず、同じDiscord IDの連携・解除・記録を
DBのトランザクションロックで直列化する。

管理APIは未ログインに401、一般ユーザーに403を返す。再集計は管理者でも
mainブランチまたはVercel production環境では実行できない。
監査ログは実行者ID・操作・HTTPステータス・成否を記録し、連携コードやトークンは記録しない。

### 検証

`npm test` で認可・連携コード・活動数の回帰テストを実行する。
DBテストは外部DBに接続せず、PGliteの一時PostgreSQL上で新規マイグレーションとSQLを検証する。
単一接続で並行リクエストを処理するため、複数PostgreSQL接続間のロック待機自体は
ステージング環境で別途検証すること。

既存マイグレーション履歴には宣言済みの `RawDiscordActivity.channelId` 等との差分があるため、
テストの既存テーブルはPrismaスキーマから作成する。この履歴の修復は本Issueの対象外。
配置先DBが現在のスキーマと一致していることを確認してから上記手順を実施する。
