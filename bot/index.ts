/**
 * 技研チャート Discord Bot
 *
 * 設計方針:
 *   - /link 不要で全メンバーのデータを自動収集（強制収集）
 *   - discordId ベースで記録し、User との紐付けはオプション
 *   - 収集データ:
 *       1. messageCreate  → メッセージ送信（曜日×時間帯）
 *       2. messageReactionAdd → リアクション追加（曜日×時間帯）
 *       3. ポーリング(30分毎) → その時間帯のオンライン人数を presenceCount に加算
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
  MessageReaction,
  User,
  Events,
  Partials,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { consumeLinkCode, unlinkDiscord, recordLinkedMessage, LinkError } from "./discord-link";

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

const parsedPoolMax = Number(process.env.PG_POOL_MAX ?? process.env.PRISMA_POOL_MAX ?? "2");
const poolMax = Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : 2;
const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: poolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ──────────────────────────────────────
// Discord クライアント
// ──────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,       // Privileged: Message Content Intent
    GatewayIntentBits.GuildMembers,         // Privileged: Server Members Intent
    GatewayIntentBits.GuildPresences,       // Privileged: Presence Intent
    GatewayIntentBits.GuildMessageReactions, // リアクション追跡用
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Reaction,   // キャッシュ外メッセージへのリアクションも補足
  ],
  presence: {
    status: "invisible",
    activities: [],
  },
});

function applyInvisiblePresence() {
  if (!client.user) return;
  client.user.setPresence({
    status: "invisible",
    activities: [],
  });
}

// ──────────────────────────────────────
// スラッシュコマンド定義
// ──────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("ダッシュボードにDiscordデータを表示するためにGitHubアカウントと紐付けます")
    .addStringOption((opt) =>
      opt
        .setName("code")
        .setDescription("技研チャートの設定画面で発行した連携コード")
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
  monday.setUTCDate(jst.getUTCDate() - ((day + 6) % 7));
  const year = monday.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7,
  );
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

// ──────────────────────────────────────
// 活動記録（連携処理とDBロックを共有）
// ──────────────────────────────────────

async function recordMessage(
  discordId: string,
  timestamp: number,
  channelId: string,
  channelName: string,
): Promise<void> {
  const { dayOfWeek, hour } = toJstActivity(new Date(timestamp));
  const weekKey = getWeekKey(new Date(timestamp));

  await recordLinkedMessage(pool, { discordId, weekKey, dayOfWeek, hour, channelId, channelName });
}

async function recordReaction(
  discordId: string,
  timestamp: number,
  channelId: string,
  channelName: string,
): Promise<void> {
  const { dayOfWeek, hour } = toJstActivity(new Date(timestamp));
  const weekKey = getWeekKey(new Date(timestamp));

  await prisma.rawDiscordActivity.upsert({
    where: {
      discordId_weekKey_dayOfWeek_hour_channelId: { discordId, weekKey, dayOfWeek, hour, channelId },
    },
    update: { reactionCount: { increment: 1 } },
    create: { discordId, channelId, channelName, weekKey, dayOfWeek, hour, reactionCount: 1 },
  });
}

// ──────────────────────────────────────
// オンライン人数ポーリング（30分ごと）
// ──────────────────────────────────────

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30分
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

async function pollOnlineMembers(): Promise<void> {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);

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

    await Promise.all(
      onlineMembers.map((member) =>
        prisma.rawDiscordActivity.upsert({
          where: {
            discordId_weekKey_dayOfWeek_hour_channelId: {
              discordId: member.id,
              weekKey,
              dayOfWeek,
              hour,
              channelId: "__presence__",
            },
          },
          update: { presenceCount: { increment: 1 } },
          create: {
            discordId: member.id,
            channelId: "__presence__",
            channelName: "Presence Poll",
            weekKey,
            dayOfWeek,
            hour,
            presenceCount: 1,
          },
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
  applyInvisiblePresence();
  console.log(`[Bot] ログイン完了: ${readyClient.user.tag}`);
  await registerCommands();

  try {
    const guild = await readyClient.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    console.log(`[Bot] メンバーキャッシュ完了 (${guild.members.cache.size}人)`);
  } catch (err) {
    console.warn("[Bot] メンバーキャッシュ失敗:", err);
  }

  await pollOnlineMembers();
  setInterval(pollOnlineMembers, POLL_INTERVAL_MS);
});

// 再接続時に presence が戻るケースに備えて、都度 invisible を再適用する
client.on(Events.ShardReady, () => {
  applyInvisiblePresence();
});

client.on(Events.ShardResume, () => {
  applyInvisiblePresence();
});

// ──────────────────────────────────────
// イベント: messageCreate
// ──────────────────────────────────────

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (message.guildId !== GUILD_ID) return;

  try {
    const channelName =
      "name" in message.channel ? (message.channel.name ?? "unknown") : "unknown";
    const channelId = message.channelId ?? "unknown";
    await recordMessage(message.author.id, message.createdTimestamp, channelId, channelName);
  } catch (err) {
    console.error("[Bot] messageCreate 記録失敗:", err);
  }
});

// ──────────────────────────────────────
// イベント: messageReactionAdd
// ──────────────────────────────────────

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  // Partial の場合はフェッチして補完
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch (err) {
    console.error("[Bot] リアクションフェッチ失敗:", err);
    return;
  }

  if (reaction.message.guildId !== GUILD_ID) return;

  try {
    const channelName =
      reaction.message.channel && "name" in reaction.message.channel
        ? (reaction.message.channel.name ?? "unknown")
        : "unknown";
    const channelId = reaction.message.channelId ?? "unknown";
    await recordReaction(user.id, Date.now(), channelId, channelName);
  } catch (err) {
    console.error("[Bot] messageReactionAdd 記録失敗:", err);
  }
});

// ──────────────────────────────────────
// スラッシュコマンドハンドラ
// ──────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.guildId !== GUILD_ID) return;

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
  } catch {
    console.error("[Bot] コマンド処理に失敗しました");
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

  const code = interaction.options.getString("code");
  if (!code) {
    await interaction.editReply("設定画面でコードを発行し、/link code:<コード> を実行してください。");
    return;
  }
  try {
    const linked = await consumeLinkCode(pool, interaction.user.id, code.trim());
    await interaction.editReply(`✅ **${linked.githubName}** と連携しました！`);
  } catch (error) {
    if (!(error instanceof LinkError)) throw error;
    await interaction.editReply(error.message);
  }
}

// /unlink
async function handleUnlink(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const user = await unlinkDiscord(pool, interaction.user.id);
  await interaction.editReply(user
    ? `✅ **${user.githubName}** との連携を解除しました。`
    : "連携されているアカウントが見つかりませんでした。");
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
        `\`/link code:<設定画面で発行したコード>\` でダッシュボードに表示できます。`,
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