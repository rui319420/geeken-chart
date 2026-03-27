"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// ──────────────────────────────────────
// 環境変数チェック
// ──────────────────────────────────────
const REQUIRED_ENV = ["DISCORD_TOKEN", "DISCORD_GUILD_ID", "DIRECT_URL"];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`[Bot] 環境変数 ${key} が設定されていません`);
        process.exit(1);
    }
}
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
// ──────────────────────────────────────
// Prisma クライアント
// ──────────────────────────────────────
const pool = new pg_1.Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
// ──────────────────────────────────────
// Discord クライアント
// ──────────────────────────────────────
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent, // Privileged: Message Content Intent
        discord_js_1.GatewayIntentBits.GuildMembers, // Privileged: Server Members Intent
        discord_js_1.GatewayIntentBits.GuildPresences, // Privileged: Presence Intent
        discord_js_1.GatewayIntentBits.GuildMessageReactions, // リアクション追跡用
    ],
    partials: [
        discord_js_1.Partials.Message,
        discord_js_1.Partials.Channel,
        discord_js_1.Partials.GuildMember,
        discord_js_1.Partials.Reaction, // キャッシュ外メッセージへのリアクションも補足
    ],
    presence: {
        status: "invisible",
        activities: [],
    },
});
function applyInvisiblePresence() {
    if (!client.user)
        return;
    client.user.setPresence({
        status: "invisible",
        activities: [],
    });
}
// ──────────────────────────────────────
// スラッシュコマンド定義
// ──────────────────────────────────────
const commands = [
    new discord_js_1.SlashCommandBuilder()
        .setName("link")
        .setDescription("ダッシュボードにDiscordデータを表示するためにGitHubアカウントと紐付けます")
        .addStringOption((opt) => opt
        .setName("github")
        .setDescription("あなたの GitHub ユーザー名 (例: rui319420)")
        .setRequired(true)),
    new discord_js_1.SlashCommandBuilder()
        .setName("unlink")
        .setDescription("GitHub アカウントとの紐付けを解除します"),
    new discord_js_1.SlashCommandBuilder()
        .setName("status")
        .setDescription("自分の紐付け状態と記録された活動データを確認します"),
].map((cmd) => cmd.toJSON());
async function registerCommands() {
    if (!CLIENT_ID) {
        console.warn("[Bot] DISCORD_CLIENT_ID 未設定のためコマンド登録をスキップ");
        return;
    }
    try {
        const rest = new discord_js_1.REST().setToken(TOKEN);
        await rest.put(discord_js_1.Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("[Bot] スラッシュコマンドを登録しました");
    }
    catch (err) {
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
function toJstActivity(date) {
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
function getWeekKey(date) {
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const day = jst.getUTCDay(); // 0=Sun
    const monday = new Date(jst);
    monday.setUTCDate(jst.getUTCDate() - ((day + 6) % 7));
    const year = monday.getUTCFullYear();
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const weekNo = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
    return `${year}-W${String(weekNo).padStart(2, "0")}`;
}
// ──────────────────────────────────────
// インメモリキャッシュ (DB 負荷軽減)
// ──────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分
const linkedUserCache = new Map();
const linkedUserCacheTime = new Map();
async function getLinkedUserId(discordId) {
    const now = Date.now();
    if (linkedUserCache.has(discordId) &&
        now - (linkedUserCacheTime.get(discordId) ?? 0) < CACHE_TTL_MS) {
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
async function recordMessage(discordId, timestamp, channelId, channelName) {
    const { dayOfWeek, hour } = toJstActivity(new Date(timestamp));
    const weekKey = getWeekKey(new Date(timestamp));
    await prisma.rawDiscordActivity.upsert({
        where: {
            discordId_weekKey_dayOfWeek_hour_channelId: { discordId, weekKey, dayOfWeek, hour, channelId },
        },
        update: { messageCount: { increment: 1 } },
        create: { discordId, channelId, channelName, weekKey, dayOfWeek, hour, messageCount: 1 },
    });
    const userId = await getLinkedUserId(discordId);
    if (userId) {
        await prisma.discordActivity.upsert({
            where: { userId_dayOfWeek_hour: { userId, dayOfWeek, hour } },
            update: { messageCount: { increment: 1 } },
            create: { userId, dayOfWeek, hour, messageCount: 1 },
        });
    }
}
async function recordReaction(discordId, timestamp, channelId, channelName) {
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
async function pollOnlineMembers() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const onlineMembers = guild.members.cache.filter((m) => !m.user.bot &&
            (m.presence?.status === "online" ||
                m.presence?.status === "idle" ||
                m.presence?.status === "dnd"));
        const onlineCount = onlineMembers.size;
        if (onlineCount === 0) {
            console.log("[Bot] ポーリング: オンラインメンバーなし");
            return;
        }
        const now = new Date();
        const { dayOfWeek, hour } = toJstActivity(now);
        const weekKey = getWeekKey(now);
        await Promise.all(onlineMembers.map((member) => prisma.rawDiscordActivity.upsert({
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
        })));
        console.log(`[Bot] ポーリング完了: ${onlineCount}人オンライン` +
            ` (${DAY_LABELS[dayOfWeek]} ${hour}時台, ${weekKey})`);
    }
    catch (err) {
        console.error("[Bot] ポーリング失敗:", err);
    }
}
// ──────────────────────────────────────
// イベント: Ready
// ──────────────────────────────────────
client.once(discord_js_1.Events.ClientReady, async (readyClient) => {
    applyInvisiblePresence();
    console.log(`[Bot] ログイン完了: ${readyClient.user.tag}`);
    await registerCommands();
    try {
        const guild = await readyClient.guilds.fetch(GUILD_ID);
        await guild.members.fetch();
        console.log(`[Bot] メンバーキャッシュ完了 (${guild.members.cache.size}人)`);
    }
    catch (err) {
        console.warn("[Bot] メンバーキャッシュ失敗:", err);
    }
    await pollOnlineMembers();
    setInterval(pollOnlineMembers, POLL_INTERVAL_MS);
});
// 再接続時に presence が戻るケースに備えて、都度 invisible を再適用する
client.on(discord_js_1.Events.ShardReady, () => {
    applyInvisiblePresence();
});
client.on(discord_js_1.Events.ShardResume, () => {
    applyInvisiblePresence();
});
// ──────────────────────────────────────
// イベント: messageCreate
// ──────────────────────────────────────
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    if (message.author.bot)
        return;
    if (message.guildId !== GUILD_ID)
        return;
    try {
        const channelName = "name" in message.channel ? (message.channel.name ?? "unknown") : "unknown";
        const channelId = message.channelId ?? "unknown";
        await recordMessage(message.author.id, message.createdTimestamp, channelId, channelName);
    }
    catch (err) {
        console.error("[Bot] messageCreate 記録失敗:", err);
    }
});
// ──────────────────────────────────────
// イベント: messageReactionAdd
// ──────────────────────────────────────
client.on(discord_js_1.Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot)
        return;
    // Partial の場合はフェッチして補完
    try {
        if (reaction.partial)
            await reaction.fetch();
        if (reaction.message.partial)
            await reaction.message.fetch();
    }
    catch (err) {
        console.error("[Bot] リアクションフェッチ失敗:", err);
        return;
    }
    if (reaction.message.guildId !== GUILD_ID)
        return;
    try {
        const channelName = reaction.message.channel && "name" in reaction.message.channel
            ? (reaction.message.channel.name ?? "unknown")
            : "unknown";
        const channelId = reaction.message.channelId ?? "unknown";
        await recordReaction(user.id, Date.now(), channelId, channelName);
    }
    catch (err) {
        console.error("[Bot] messageReactionAdd 記録失敗:", err);
    }
});
// ──────────────────────────────────────
// スラッシュコマンドハンドラ
// ──────────────────────────────────────
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
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
    }
    catch (err) {
        console.error(`[Bot] コマンドエラー (${interaction.commandName}):`, err);
        const msg = "エラーが発生しました。しばらく経ってからもう一度お試しください。";
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: msg, ephemeral: true });
        }
        else {
            await interaction.reply({ content: msg, ephemeral: true });
        }
    }
});
// /link ─────────────────────────────────
async function handleLink(interaction) {
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
        await interaction.editReply(`❌ **${githubName}** は技研チャートに未登録です。\n` +
            `先に <https://geeken-chart.vercel.app> で GitHub ログインしてください。`);
        return;
    }
    if (user.discordId && user.discordId !== discordId) {
        await interaction.editReply("❌ このGitHubアカウントはすでに別のDiscordアカウントと紐付け済みです。");
        return;
    }
    const raw = await prisma.rawDiscordActivity.findMany({ where: { discordId } });
    if (raw.length > 0) {
        await Promise.all(raw.map((r) => prisma.discordActivity.upsert({
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
        })));
    }
    await prisma.user.update({ where: { id: user.id }, data: { discordId } });
    linkedUserCache.set(discordId, user.id);
    linkedUserCacheTime.set(discordId, Date.now());
    await interaction.editReply(`✅ **${user.githubName}** と紐付けました！\n` +
        `これまでの活動データ（${raw.length} 件）もダッシュボードに反映されました。`);
}
// /unlink ────────────────────────────────
async function handleUnlink(interaction) {
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
async function handleStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;
    const rawCount = await prisma.rawDiscordActivity.count({ where: { discordId } });
    const user = await prisma.user.findFirst({
        where: { discordId },
        select: { githubName: true, showLanguages: true, showCommits: true, isAnonymous: true },
    });
    if (!user) {
        await interaction.editReply(`📊 活動データ: **${rawCount}** 件記録済み\n` +
            `🔗 GitHub 紐付け: **未設定**\n\n` +
            `\`/link github:<ユーザー名>\` でダッシュボードに表示できます。`);
        return;
    }
    await interaction.editReply(`📊 活動データ: **${rawCount}** 件記録済み\n` +
        `🔗 GitHub: **${user.githubName}** と紐付け済み\n` +
        `・言語公開: ${user.showLanguages ? "ON" : "OFF"}\n` +
        `・コミット公開: ${user.showCommits ? "ON" : "OFF"}\n` +
        `・匿名モード: ${user.isAnonymous ? "ON" : "OFF"}`);
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
