"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FrameworkData {
  framework: string;
  ecosystem: string;
  totalRepos: number;
  memberCount: number;
}

// ────────────────────────────────────────────────────
// カテゴリ定義
// ────────────────────────────────────────────────────
type Category = "frontend" | "backend" | "fullstack" | "data/ml" | "infra/tool" | "other";

const CATEGORY_MAP: Record<string, Category> = {
  // フロントエンド
  React: "frontend",
  Vue: "frontend",
  Svelte: "frontend",
  "Solid.js": "frontend",
  Astro: "frontend",
  Qwik: "frontend",
  jQuery: "frontend",
  MUI: "frontend",
  "Chakra UI": "frontend",
  "Ant Design": "frontend",
  Mantine: "frontend",
  "React Bootstrap": "frontend",
  "Radix UI": "frontend",
  "Framer Motion": "frontend",
  "Tailwind CSS": "frontend",
  "styled-components": "frontend",
  Emotion: "frontend",
  Sass: "frontend",
  Lucide: "frontend",
  "Redux Toolkit": "frontend",
  Redux: "frontend",
  Zustand: "frontend",
  Jotai: "frontend",
  Recoil: "frontend",
  MobX: "frontend",
  XState: "frontend",
  "React Native": "frontend",
  Expo: "frontend",
  "Three.js": "frontend",
  "D3.js": "frontend",
  Recharts: "frontend",
  "Chart.js": "frontend",

  // バックエンド
  Express: "backend",
  Fastify: "backend",
  Hono: "backend",
  Koa: "backend",
  NestJS: "backend",
  "Socket.io": "backend",
  ws: "backend",
  FastAPI: "backend",
  Django: "backend",
  Flask: "backend",
  Starlette: "backend",
  Tornado: "backend",
  aiohttp: "backend",
  Sanic: "backend",
  Axum: "backend",
  "Actix Web": "backend",
  Rocket: "backend",
  Warp: "backend",
  Hyper: "backend",
  Poem: "backend",
  Gin: "backend",
  Echo: "backend",
  Fiber: "backend",
  Chi: "backend",
  "Gorilla Mux": "backend",
  Beego: "backend",
  "Apollo Server": "backend",
  gRPC: "backend",
  Tonic: "backend",

  // フルスタック / メタフレームワーク
  "Next.js": "fullstack",
  Nuxt: "fullstack",
  Remix: "fullstack",
  SvelteKit: "fullstack",
  Gatsby: "fullstack",

  // データ / ML
  NumPy: "data/ml",
  pandas: "data/ml",
  Matplotlib: "data/ml",
  Seaborn: "data/ml",
  SciPy: "data/ml",
  "scikit-learn": "data/ml",
  PyTorch: "data/ml",
  TensorFlow: "data/ml",
  Keras: "data/ml",
  Transformers: "data/ml",
  "Sentence Transformers": "data/ml",
  XGBoost: "data/ml",
  LightGBM: "data/ml",
  "OpenAI SDK": "data/ml",
  "Anthropic SDK": "data/ml",
  LangChain: "data/ml",
  LlamaIndex: "data/ml",
  "llama.cpp": "data/ml",
  "Vercel AI SDK": "data/ml",

  // インフラ / ツール
  Prisma: "infra/tool",
  Drizzle: "infra/tool",
  TypeORM: "infra/tool",
  Sequelize: "infra/tool",
  Mongoose: "infra/tool",
  Knex: "infra/tool",
  SQLite: "infra/tool",
  SQLAlchemy: "infra/tool",
  PyMongo: "infra/tool",
  Motor: "infra/tool",
  asyncpg: "infra/tool",
  psycopg2: "infra/tool",
  "Redis (py)": "infra/tool",
  Celery: "infra/tool",
  SQLx: "infra/tool",
  Diesel: "infra/tool",
  SeaORM: "infra/tool",
  GORM: "infra/tool",
  "sqlx (Go)": "infra/tool",
  Ent: "infra/tool",
  "MongoDB Driver": "infra/tool",
  "TanStack Query": "infra/tool",
  SWR: "infra/tool",
  Axios: "infra/tool",
  tRPC: "infra/tool",
  GraphQL: "infra/tool",
  "Apollo Client": "infra/tool",
  Vite: "infra/tool",
  webpack: "infra/tool",
  esbuild: "infra/tool",
  Turbopack: "infra/tool",
  Rollup: "infra/tool",
  Parcel: "infra/tool",
  Zod: "infra/tool",
  Yup: "infra/tool",
  Lodash: "infra/tool",
  "Day.js": "infra/tool",
  "date-fns": "infra/tool",
  RxJS: "infra/tool",
  Serde: "infra/tool",
  serde_json: "infra/tool",
  Reqwest: "infra/tool",
  ureq: "infra/tool",
  Clap: "infra/tool",
  anyhow: "infra/tool",
  thiserror: "infra/tool",
  Tracing: "infra/tool",
  Rayon: "infra/tool",
  "wasm-bindgen": "infra/tool",
  Vitest: "infra/tool",
  Jest: "infra/tool",
  Playwright: "infra/tool",
  "Playwright (py)": "infra/tool",
  Cypress: "infra/tool",
  "Testing Library": "infra/tool",
  pytest: "infra/tool",
  Electron: "infra/tool",
  Tauri: "infra/tool",
  Requests: "infra/tool",
  HTTPX: "infra/tool",
  BeautifulSoup: "infra/tool",
  Scrapy: "infra/tool",
  Pydantic: "infra/tool",
  boto3: "infra/tool",
  Cobra: "infra/tool",
  Viper: "infra/tool",
  Zap: "infra/tool",
  Testify: "infra/tool",
  Tokio: "infra/tool",
  "async-std": "infra/tool",
};

const CATEGORY_COLORS: Record<Category, string> = {
  frontend: "#3178c6",
  backend: "#e8614a",
  fullstack: "#9b59b6",
  "data/ml": "#f39c12",
  "infra/tool": "#2ecc71",
  other: "#636e7b",
};

const CATEGORY_LABELS: Record<Category, string> = {
  frontend: "フロントエンド",
  backend: "バックエンド",
  fullstack: "フルスタック",
  "data/ml": "データ / ML",
  "infra/tool": "インフラ / ツール",
  other: "その他",
};

function getCategory(framework: string): Category {
  return CATEGORY_MAP[framework] ?? "other";
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export default function FrameworkChart() {
  const [data, setData] = useState<FrameworkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set(ALL_CATEGORIES));

  useEffect(() => {
    fetch("/api/frameworks/all")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const toggleCategory = (cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      // 1つしか残っていない状態でオフにするのを防ぐ
      if (next.has(cat) && next.size === 1) return prev;
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filtered = data.filter((d) => activeCategories.has(getCategory(d.framework))).slice(0, 20);

  const chartHeight = Math.max(filtered.length * 36 + 40, 160);

  return (
    <div className="w-full rounded-xl border border-[#21262d] bg-[#0d1117] p-5">
      <h3 className="mb-1 text-base font-bold text-[#e6edf3]">使用フレームワーク（全体）</h3>
      <p className="mb-4 text-xs text-[#8b949e]">
        各メンバーのリポジトリの依存ファイルから集計（リポジトリ数）
      </p>

      {/* カテゴリフィルター */}
      <div className="mb-5 flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const active = activeCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all duration-150"
              style={{
                borderColor: active ? CATEGORY_COLORS[cat] : "#30363d",
                background: active ? `${CATEGORY_COLORS[cat]}22` : "transparent",
                color: active ? CATEGORY_COLORS[cat] : "#636e7b",
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: active ? CATEGORY_COLORS[cat] : "#636e7b" }}
              />
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-[#636e7b]">
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          集計中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-[#636e7b]">
          {data.length === 0
            ? "データがありません。「今すぐ更新」を実行してください。"
            : "選択中のカテゴリにデータがありません。"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={filtered}
            layout="vertical"
            margin={{ top: 0, right: 48, left: 100, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "#8b949e", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              label={{
                value: "リポジトリ数",
                position: "insideRight",
                offset: -4,
                fill: "#636e7b",
                fontSize: 11,
              }}
            />
            <YAxis
              type="category"
              dataKey="framework"
              tick={{ fill: "#e6edf3", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={96}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as FrameworkData;
                const cat = getCategory(d.framework);
                return (
                  <div className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-xs">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: CATEGORY_COLORS[cat] }}
                      />
                      <span className="font-bold text-[#e6edf3]">{d.framework}</span>
                    </div>
                    <p style={{ color: CATEGORY_COLORS[cat] }}>{CATEGORY_LABELS[cat]}</p>
                    <p className="text-[#3fb950]">{d.totalRepos} リポジトリ</p>
                    <p className="text-[#8b949e]">{d.memberCount} 人が使用</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="totalRepos" radius={[0, 4, 4, 0]}>
              {filtered.map((entry, index) => {
                const cat = getCategory(entry.framework);
                return <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[cat]} opacity={0.85} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
