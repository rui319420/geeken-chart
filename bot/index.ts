/**
 * 技研チャート Discord Bot
 *
 * 設計方針:
 *   - /link 不要で全メンバーのデータを自動収集（強制収集）
 *   - discordId ベースで記録し、User との紐付けはオプション
 *   - 収集データ:
 *       1. messageCreate  → メッセージ送信（曜日×時間帯）
 *       2. ポーリング(30分毎) → その時間帯のオンライン人数を presenceCount に加算
 *
 * 必要な Privileged Intents (Developer Portal で ON にすること):
 *   - Message Content Intent
 *   - Server Members Intent
 *   - Presence Intent
 */

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  Events,
  Partials,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

// ──────────────────────────────────────
// 環境変数チェック
// ──────────────────────────────────────

const REQUIRED_ENV = ["DISCORD_TOKEN", "DISCORD_GUILD_ID", "DIRECT_URL"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[Bot] 環境変数 ${key} が設定されていません`);
    process.exit(1);
  }
}

const TOKEN = process.env.DISCORD_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";

// ──────────────────────────────────────
// Prisma クライアント
// ──────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ──────────────────────────────────────
// Discord クライアント
// ──────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Privileged: Message Content Intent
    GatewayIntentBits.GuildMembers,   // Privileged: Server Members Intent
    GatewayIntentBits.GuildPresences, // Privileged: Presence Intent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// ──────────────────────────────────────
// スラッシュコマンド定義
// ──────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("ダッシュボードにDiscordデータを表示するためにGitHubアカウントと紐付けます")
    .addStringOption((opt) =>
      opt
        .setName("github")
        .setDescription("あなたの GitHub ユーザー名 (例: rui319420)")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("GitHub アカウントとの紐付けを解除します"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("自分の紐付け状態と記録された活動データを確認します"),
].map((cmd) => cmd.toJSON());

async function registerCommands() {
  if (!CLIENT_ID) {
    console.warn("[Bot] DISCORD_CLIENT_ID 未設定のためコマンド登録をスキップ");
    return;
  }
  try {
    const rest = new REST().setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("[Bot] スラッシュコマンドを登録しました");
  } catch (err) {
    console.error("[Bot] コマンド登録失敗:", err);
  }
}

// ──────────────────────────────────────
// JST ユーティリティ
// ──────────────────────────────────────

/**
 * UTC の Date を JST の { dayOfWeek, hour } に変換する
 * dayOfWeek: 0=月, 1=火, ..., 6=日
 */
function toJstActivity(date: Date): { dayOfWeek: number; hour: number } {
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const jsDay = jstDate.getUTCDay(); // 0=Sun
  const dayOfWeek = (jsDay + 6) % 7; // 0=月, ..., 6=日
  const hour = jstDate.getUTCHours();
  return { dayOfWeek, hour };
}

/**
 * JST の ISO 週キー ("2026-W11" 形式) を返す
 * 週の区切りは月曜始まり
 */
function getWeekKey(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay(); // 0=Sun
  const monday = new Date(jst);
  monday.setUTCDate(jst.getUTCDate() - (day + 6) % 7);
  const year = monday.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7,
  );
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

// ──────────────────────────────────────
// インメモリキャッシュ (DB 負荷軽減)
// ──────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1000; // 10分

const linkedUserCache = new Map<string, string | null>();
const linkedUserCacheTime = new Map<string, number>();

async function getLinkedUserId(discordId: string): Promise<string | null> {
  const now = Date.now();
  if (
    linkedUserCache.has(discordId) &&
    now - (linkedUserCacheTime.get(discordId) ?? 0) < CACHE_TTL_MS
  ) {
    return linkedUserCache.get(discordId) ?? null;
  }
  const user = await prisma.user.findFirst({
    where: { discordId },
    select: { id: true },
  });
  linkedUserCache.set(discordId, user?.id ?? null);
  linkedUserCacheTime.set(discordId, now);
  return user?.id ?? null;
}

// ──────────────────────────────────────
// 活動記録ユーティリティ
// ──────────────────────────────────────

async function recordMessage(discordId: string, timestamp: number): Promise<void> {
  const { dayOfWeek, hour } = toJstActivity(new Date(timestamp));
  const weekKey = getWeekKey(new Date(timestamp));

  // 全員分を RawDiscordActivity へ
  await prisma.rawDiscordActivity.upsert({
    where: { discordId_weekKey_dayOfWeek_hour: { discordId, weekKey, dayOfWeek, hour } },
    update: { messageCount: { increment: 1 } },
    create: { discordId, weekKey, dayOfWeek, hour, messageCount: 1 },
  });

  // /link 済みは DiscordActivity にも二重書き
  const userId = await getLinkedUserId(discordId);
  if (userId) {
    await prisma.discordActivity.upsert({
      where: { userId_dayOfWeek_hour: { userId, dayOfWeek, hour } },
      update: { messageCount: { increment: 1 } },
      create: { userId, dayOfWeek, hour, messageCount: 1 },
    });
  }
}

// ──────────────────────────────────────
// オンライン人数ポーリング（30分ごと）
// ──────────────────────────────────────

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30分
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

async function pollOnlineMembers(): Promise<void> {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    // presenceキャッシュを最新に更新
    await guild.members.fetch();

    const onlineMembers = guild.members.cache.filter(
      (m) =>
        !m.user.bot &&
        (m.presence?.status === "online" ||
          m.presence?.status === "idle" ||
          m.presence?.status === "dnd"),
    );

    const onlineCount = onlineMembers.size;
    if (onlineCount === 0) {
      console.log("[Bot] ポーリング: オンラインメンバーなし");
      return;
    }

    const now = new Date();
    const { dayOfWeek, hour } = toJstActivity(now);
    const weekKey = getWeekKey(now);

    // オンラインだった各メンバーの presenceCount を +1
    await Promise.all(
      onlineMembers.map((member) =>
        prisma.rawDiscordActivity.upsert({
          where: {
            discordId_weekKey_dayOfWeek_hour: {
              discordId: member.id,
              weekKey,
              dayOfWeek,
              hour,
            },
          },
          update: { presenceCount: { increment: 1 } },
          create: { discordId: member.id, weekKey, dayOfWeek, hour, presenceCount: 1 },
        }),
      ),
    );

    console.log(
      `[Bot] ポーリング完了: ${onlineCount}人オンライン` +
        ` (${DAY_LABELS[dayOfWeek]} ${hour}時台, ${weekKey})`,
    );
  } catch (err) {
    console.error("[Bot] ポーリング失敗:", err);
  }
}

// ──────────────────────────────────────
// イベント: Ready
// ──────────────────────────────────────

client.once(Events.ClientReady, async (readyClient) => {
  readyClient.user.setPresence({ status: "invisible" });
  console.log(`[Bot] ログイン完了: ${readyClient.user.tag}`);
  await registerCommands();

  // 起動時に全メンバーをキャッシュ（presence取得のため）
  try {
    const guild = await readyClient.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    console.log(`[Bot] メンバーキャッシュ完了 (${guild.members.cache.size}人)`);
  } catch (err) {
    console.warn("[Bot] メンバーキャッシュ失敗:", err);
  }

  // 起動直後に1回ポーリング → 以降30分ごと
  await pollOnlineMembers();
  setInterval(pollOnlineMembers, POLL_INTERVAL_MS);
});

// ──────────────────────────────────────
// イベント: messageCreate
// ──────────────────────────────────────

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (message.guildId !== GUILD_ID) return;

  try {
    await recordMessage(message.author.id, message.createdTimestamp);
  } catch (err) {
    console.error("[Bot] messageCreate 記録失敗:", err);
  }
});

// ──────────────────────────────────────
// スラッシュコマンドハンドラ
// ──────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "link":
        await handleLink(interaction);
        break;
      case "unlink":
        await handleUnlink(interaction);
        break;
      case "status":
        await handleStatus(interaction);
        break;
    }
  } catch (err) {
    console.error(`[Bot] コマンドエラー (${interaction.commandName}):`, err);
    const msg = "エラーが発生しました。しばらく経ってからもう一度お試しください。";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// /link ─────────────────────────────────

async function handleLink(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const githubName = interaction.options.getString("github", true).trim();
  const discordId = interaction.user.id;

  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(githubName)) {
    await interaction.editReply("❌ GitHub ユーザー名の形式が正しくありません。");
    return;
  }

  const user = await prisma.user.findFirst({
    where: { githubName: { equals: githubName, mode: "insensitive" } },
    select: { id: true, githubName: true, discordId: true },
  });

  if (!user) {
    await interaction.editReply(
      `❌ **${githubName}** は技研チャートに未登録です。\n` +
        `先に <https://geeken-chart.vercel.app> で GitHub ログインしてください。`,
    );
    return;
  }

  if (user.discordId && user.discordId !== discordId) {
    await interaction.editReply(
      "❌ このGitHubアカウントはすでに別のDiscordアカウントと紐付け済みです。",
    );
    return;
  }

  const raw = await prisma.rawDiscordActivity.findMany({ where: { discordId } });
  if (raw.length > 0) {
    await Promise.all(
      raw.map((r: { dayOfWeek: number; hour: number; messageCount: number }) =>
        prisma.discordActivity.upsert({
          where: {
            userId_dayOfWeek_hour: { userId: user.id, dayOfWeek: r.dayOfWeek, hour: r.hour },
          },
          update: { messageCount: { increment: r.messageCount } },
          create: {
            userId: user.id,
            dayOfWeek: r.dayOfWeek,
            hour: r.hour,
            messageCount: r.messageCount,
          },
        }),
      ),
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { discordId } });
  linkedUserCache.set(discordId, user.id);
  linkedUserCacheTime.set(discordId, Date.now());

  await interaction.editReply(
    `✅ **${user.githubName}** と紐付けました！\n` +
      `これまでの活動データ（${raw.length} 件）もダッシュボードに反映されました。`,
  );
}

// /unlink ────────────────────────────────

async function handleUnlink(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const user = await prisma.user.findFirst({
    where: { discordId },
    select: { id: true, githubName: true },
  });

  if (!user) {
    await interaction.editReply("紐付けされているアカウントが見つかりませんでした。");
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { discordId: null } });
  linkedUserCache.set(discordId, null);
  linkedUserCacheTime.set(discordId, Date.now());

  await interaction.editReply(`✅ **${user.githubName}** との紐付けを解除しました。`);
}

// /status ────────────────────────────────

async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const rawCount = await prisma.rawDiscordActivity.count({ where: { discordId } });

  const user = await prisma.user.findFirst({
    where: { discordId },
    select: { githubName: true, showLanguages: true, showCommits: true, isAnonymous: true },
  });

  if (!user) {
    await interaction.editReply(
      `📊 活動データ: **${rawCount}** 件記録済み\n` +
        `🔗 GitHub 紐付け: **未設定**\n\n` +
        `\`/link github:<ユーザー名>\` でダッシュボードに表示できます。`,
    );
    return;
  }

  await interaction.editReply(
    `📊 活動データ: **${rawCount}** 件記録済み\n` +
      `🔗 GitHub: **${user.githubName}** と紐付け済み\n` +
      `・言語公開: ${user.showLanguages ? "ON" : "OFF"}\n` +
      `・コミット公開: ${user.showCommits ? "ON" : "OFF"}\n` +
      `・匿名モード: ${user.isAnonymous ? "ON" : "OFF"}`,
  );
}

// ──────────────────────────────────────
// グレースフルシャットダウン
// ──────────────────────────────────────

async function shutdown() {
  console.log("[Bot] シャットダウン中...");
  await prisma.$disconnect();
  await pool.end();
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ──────────────────────────────────────
// 起動
// ──────────────────────────────────────

client.login(TOKEN).catch((err) => {
  console.error("[Bot] ログイン失敗:", err);
  process.exit(1);
});