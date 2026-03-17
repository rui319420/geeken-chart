const GITHUB_API = "https://api.github.com";

// ────────────────────────────────────────────────────
// npm: パッケージ名 → 表示名のマップ
// スコープ付き (@nestjs/core など) も対応
// ────────────────────────────────────────────────────
const NPM_MAP: Record<string, string> = {
  // フロントエンドフレームワーク
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  "solid-js": "Solid.js",
  astro: "Astro",
  qwik: "Qwik",
  jquery: "jQuery",

  // メタフレームワーク
  next: "Next.js",
  nuxt: "Nuxt",
  remix: "Remix",
  "@sveltejs/kit": "SvelteKit",
  gatsby: "Gatsby",

  // バックエンドフレームワーク
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  koa: "Koa",
  "@nestjs/core": "NestJS",
  "socket.io": "Socket.io",
  "socket.io-client": "Socket.io",
  ws: "ws",

  // ORM / DB
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  "drizzle-orm": "Drizzle",
  typeorm: "TypeORM",
  sequelize: "Sequelize",
  mongoose: "Mongoose",
  knex: "Knex",
  "better-sqlite3": "SQLite",

  // 状態管理
  "@reduxjs/toolkit": "Redux Toolkit",
  redux: "Redux",
  zustand: "Zustand",
  jotai: "Jotai",
  recoil: "Recoil",
  mobx: "MobX",
  xstate: "XState",

  // データフェッチ / API
  "@tanstack/react-query": "TanStack Query",
  swr: "SWR",
  axios: "Axios",
  "@trpc/server": "tRPC",
  "@trpc/client": "tRPC",
  trpc: "tRPC",
  graphql: "GraphQL",
  "@apollo/client": "Apollo Client",
  "apollo-server": "Apollo Server",

  // UIライブラリ
  "@mui/material": "MUI",
  "@chakra-ui/react": "Chakra UI",
  "chakra-ui": "Chakra UI",
  antd: "Ant Design",
  "@mantine/core": "Mantine",
  "react-bootstrap": "React Bootstrap",
  "@radix-ui/react-dialog": "Radix UI",
  "framer-motion": "Framer Motion",
  "lucide-react": "Lucide",

  // スタイリング
  tailwindcss: "Tailwind CSS",
  "styled-components": "styled-components",
  "@emotion/react": "Emotion",
  sass: "Sass",

  // ビルドツール
  vite: "Vite",
  webpack: "webpack",
  esbuild: "esbuild",
  turbopack: "Turbopack",
  rollup: "Rollup",
  parcel: "Parcel",

  // テスト
  vitest: "Vitest",
  jest: "Jest",
  "@playwright/test": "Playwright",
  cypress: "Cypress",
  "@testing-library/react": "Testing Library",

  // 型 / バリデーション
  zod: "Zod",
  yup: "Yup",
  "io-ts": "io-ts",

  // ユーティリティ
  lodash: "Lodash",
  dayjs: "Day.js",
  "date-fns": "date-fns",
  rxjs: "RxJS",

  // モバイル / デスクトップ
  "react-native": "React Native",
  expo: "Expo",
  electron: "Electron",
  "@tauri-apps/api": "Tauri",

  // 3D / ビジュアライゼーション
  three: "Three.js",
  d3: "D3.js",
  recharts: "Recharts",
  "chart.js": "Chart.js",

  // AI / LLM
  openai: "OpenAI SDK",
  "@anthropic-ai/sdk": "Anthropic SDK",
  langchain: "LangChain",
  ai: "Vercel AI SDK",
};

// ────────────────────────────────────────────────────
// pip: パッケージ名 → 表示名
// ────────────────────────────────────────────────────
const PIP_MAP: Record<string, string> = {
  // Webフレームワーク
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  starlette: "Starlette",
  tornado: "Tornado",
  aiohttp: "aiohttp",
  sanic: "Sanic",

  // ORM / DB
  sqlalchemy: "SQLAlchemy",
  "django-rest-framework": "DRF",
  djangorestframework: "DRF",
  pymongo: "PyMongo",
  motor: "Motor",
  asyncpg: "asyncpg",
  psycopg2: "psycopg2",
  "psycopg2-binary": "psycopg2",
  redis: "Redis (py)",
  celery: "Celery",

  // データ / ML
  numpy: "NumPy",
  pandas: "pandas",
  matplotlib: "Matplotlib",
  seaborn: "Seaborn",
  scipy: "SciPy",
  "scikit-learn": "scikit-learn",
  sklearn: "scikit-learn",
  pytorch: "PyTorch",
  torch: "PyTorch",
  tensorflow: "TensorFlow",
  keras: "Keras",
  transformers: "Transformers",
  "sentence-transformers": "Sentence Transformers",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",

  // AI / LLM
  openai: "OpenAI SDK",
  anthropic: "Anthropic SDK",
  langchain: "LangChain",
  "langchain-core": "LangChain",
  llama_index: "LlamaIndex",
  llama_cpp_python: "llama.cpp",

  // HTTP / スクレイピング
  requests: "Requests",
  httpx: "HTTPX",
  beautifulsoup4: "BeautifulSoup",
  bs4: "BeautifulSoup",
  scrapy: "Scrapy",
  selenium: "Selenium",
  playwright: "Playwright (py)",

  // バリデーション / シリアライズ
  pydantic: "Pydantic",
  marshmallow: "Marshmallow",

  // テスト
  pytest: "pytest",
  unittest2: "unittest",

  // ユーティリティ
  pillow: "Pillow",
  boto3: "boto3",
  paramiko: "Paramiko",
  cryptography: "cryptography",
};

// ────────────────────────────────────────────────────
// Cargo.toml: クレート名 → 表示名
// ────────────────────────────────────────────────────
const CARGO_MAP: Record<string, string> = {
  // Webフレームワーク
  axum: "Axum",
  "actix-web": "Actix Web",
  rocket: "Rocket",
  warp: "Warp",
  hyper: "Hyper",
  poem: "Poem",

  // 非同期ランタイム
  tokio: "Tokio",
  async_std: "async-std",
  smol: "smol",

  // DB / ORM
  sqlx: "SQLx",
  diesel: "Diesel",
  sea_orm: "SeaORM",

  // シリアライズ
  serde: "Serde",
  serde_json: "serde_json",

  // HTTP クライアント
  reqwest: "Reqwest",
  ureq: "ureq",

  // gRPC
  tonic: "Tonic",

  // CLI
  clap: "Clap",
  structopt: "StructOpt",

  // エラーハンドリング
  anyhow: "anyhow",
  thiserror: "thiserror",

  // ログ / トレース
  tracing: "Tracing",
  log: "log",
  env_logger: "env_logger",

  // 並列 / 非同期ユーティリティ
  rayon: "Rayon",
  crossbeam: "crossbeam",

  // WebAssembly
  wasm_bindgen: "wasm-bindgen",
  "js-sys": "js-sys",
  "web-sys": "web-sys",
};

// ────────────────────────────────────────────────────
// go.mod: モジュール名 → 表示名
// ────────────────────────────────────────────────────
const GO_MAP: Record<string, string> = {
  "github.com/gin-gonic/gin": "Gin",
  "github.com/labstack/echo": "Echo",
  "github.com/labstack/echo/v4": "Echo",
  "github.com/gofiber/fiber": "Fiber",
  "github.com/gofiber/fiber/v2": "Fiber",
  "github.com/go-chi/chi": "Chi",
  "github.com/go-chi/chi/v5": "Chi",
  "github.com/gorilla/mux": "Gorilla Mux",
  "github.com/beego/beego": "Beego",

  // ORM / DB
  "gorm.io/gorm": "GORM",
  "github.com/jmoiern/sqlx": "sqlx (Go)",
  "entgo.io/ent": "Ent",
  "go.mongodb.org/mongo-driver": "MongoDB Driver",

  // gRPC
  "google.golang.org/grpc": "gRPC",

  // CLI
  "github.com/spf13/cobra": "Cobra",
  "github.com/urfave/cli": "urfave/cli",
  "github.com/urfave/cli/v2": "urfave/cli",

  // テスト
  "github.com/stretchr/testify": "Testify",

  // その他
  "github.com/spf13/viper": "Viper",
  "go.uber.org/zap": "Zap",
  "github.com/rs/zerolog": "Zerolog",
};

export interface DepResult {
  framework: string;
  ecosystem: "npm" | "pip" | "cargo" | "go";
}

// ────────────────────────────────────────────────────
// ファイル1つを取得してテキストで返す
// ────────────────────────────────────────────────────
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────
// package.json を解析
// ────────────────────────────────────────────────────
function parsePackageJson(content: string): DepResult[] {
  try {
    const pkg = JSON.parse(content);
    const allDeps: Record<string, string> = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    const seen = new Set<string>();
    const results: DepResult[] = [];

    for (const name of Object.keys(allDeps)) {
      const displayName = NPM_MAP[name];
      if (displayName && !seen.has(displayName)) {
        seen.add(displayName);
        results.push({ framework: displayName, ecosystem: "npm" });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────
// requirements.txt を解析
// ────────────────────────────────────────────────────
function parseRequirementsTxt(content: string): DepResult[] {
  const seen = new Set<string>();
  const results: DepResult[] = [];

  for (const line of content.split("\n")) {
    const name = line
      .split(/[>=<!;\s]/)[0]
      .trim()
      .toLowerCase();
    const displayName = PIP_MAP[name];
    if (displayName && !seen.has(displayName)) {
      seen.add(displayName);
      results.push({ framework: displayName, ecosystem: "pip" });
    }
  }
  return results;
}

// ────────────────────────────────────────────────────
// Cargo.toml を解析
// ────────────────────────────────────────────────────
function parseCargoToml(content: string): DepResult[] {
  const seen = new Set<string>();
  const results: DepResult[] = [];
  const depSection = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/)?.[1] ?? "";

  for (const line of depSection.split("\n")) {
    const name = line.split("=")[0].trim().toLowerCase().replace(/-/g, "_");
    // ハイフンとアンダースコア両方で検索
    const key = Object.keys(CARGO_MAP).find((k) => k === name || k.replace(/-/g, "_") === name);
    if (key) {
      const displayName = CARGO_MAP[key];
      if (!seen.has(displayName)) {
        seen.add(displayName);
        results.push({ framework: displayName, ecosystem: "cargo" });
      }
    }
  }
  return results;
}

// ────────────────────────────────────────────────────
// go.mod を解析
// ────────────────────────────────────────────────────
function parseGoMod(content: string): DepResult[] {
  const seen = new Set<string>();
  const results: DepResult[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // "require module/path vX.X.X" または require ブロック内の行
    const modulePath = trimmed.split(/\s+/)[0];
    const displayName = GO_MAP[modulePath];
    if (displayName && !seen.has(displayName)) {
      seen.add(displayName);
      results.push({ framework: displayName, ecosystem: "go" });
    }
  }
  return results;
}

// ────────────────────────────────────────────────────
// リポジトリ1つの依存を取得
// ────────────────────────────────────────────────────
async function fetchRepoDeps(owner: string, repoName: string, token: string): Promise<DepResult[]> {
  const results: DepResult[] = [];

  const [pkgJson, reqTxt, cargo, goMod] = await Promise.all([
    fetchFileContent(owner, repoName, "package.json", token),
    fetchFileContent(owner, repoName, "requirements.txt", token),
    fetchFileContent(owner, repoName, "Cargo.toml", token),
    fetchFileContent(owner, repoName, "go.mod", token),
  ]);

  if (pkgJson) results.push(...parsePackageJson(pkgJson));
  if (reqTxt) results.push(...parseRequirementsTxt(reqTxt));
  if (cargo) results.push(...parseCargoToml(cargo));
  if (goMod) results.push(...parseGoMod(goMod));

  return results;
}

// ────────────────────────────────────────────────────
// ユーザーの全リポジトリから依存を集計
// repoCount = そのフレームワークを使っているリポジトリ数
// ────────────────────────────────────────────────────
export async function getUserFrameworkStats(
  githubName: string,
  token: string,
  concurrency = 5,
): Promise<{ framework: string; ecosystem: string; repoCount: number }[]> {
  const { fetchUserRepos } = await import("./github");
  const repos = await fetchUserRepos(githubName, { token });

  const counter = new Map<string, { ecosystem: string; count: number }>();

  for (let i = 0; i < repos.length; i += concurrency) {
    const batch = repos.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((r) => fetchRepoDeps(githubName, r.name, token)),
    );
    for (const deps of batchResults) {
      for (const { framework, ecosystem } of deps) {
        const existing = counter.get(framework);
        if (existing) {
          existing.count += 1;
        } else {
          counter.set(framework, { ecosystem, count: 1 });
        }
      }
    }
  }

  return Array.from(counter.entries())
    .map(([framework, { ecosystem, count }]) => ({
      framework,
      ecosystem,
      repoCount: count,
    }))
    .sort((a, b) => b.repoCount - a.repoCount);
}
