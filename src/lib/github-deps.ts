import redis from "./redis";

const GITHUB_API = "https://api.github.com";

const NPM_MAP: Record<string, string> = {
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  "solid-js": "Solid.js",
  astro: "Astro",
  qwik: "Qwik",
  jquery: "jQuery",
  next: "Next.js",
  nuxt: "Nuxt",
  remix: "Remix",
  "@sveltejs/kit": "SvelteKit",
  gatsby: "Gatsby",
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  koa: "Koa",
  "@nestjs/core": "NestJS",
  "socket.io": "Socket.io",
  "socket.io-client": "Socket.io",
  ws: "ws",
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  "drizzle-orm": "Drizzle",
  typeorm: "TypeORM",
  sequelize: "Sequelize",
  mongoose: "Mongoose",
  knex: "Knex",
  "better-sqlite3": "SQLite",
  "@reduxjs/toolkit": "Redux Toolkit",
  redux: "Redux",
  zustand: "Zustand",
  jotai: "Jotai",
  recoil: "Recoil",
  mobx: "MobX",
  xstate: "XState",
  "@tanstack/react-query": "TanStack Query",
  swr: "SWR",
  axios: "Axios",
  "@trpc/server": "tRPC",
  "@trpc/client": "tRPC",
  trpc: "tRPC",
  graphql: "GraphQL",
  "@apollo/client": "Apollo Client",
  "apollo-server": "Apollo Server",
  "@mui/material": "MUI",
  "@chakra-ui/react": "Chakra UI",
  "chakra-ui": "Chakra UI",
  antd: "Ant Design",
  "@mantine/core": "Mantine",
  "react-bootstrap": "React Bootstrap",
  "@radix-ui/react-dialog": "Radix UI",
  "framer-motion": "Framer Motion",
  "lucide-react": "Lucide",
  tailwindcss: "Tailwind CSS",
  "styled-components": "styled-components",
  "@emotion/react": "Emotion",
  sass: "Sass",
  vite: "Vite",
  webpack: "webpack",
  esbuild: "esbuild",
  turbopack: "Turbopack",
  rollup: "Rollup",
  parcel: "Parcel",
  vitest: "Vitest",
  jest: "Jest",
  "@playwright/test": "Playwright",
  cypress: "Cypress",
  "@testing-library/react": "Testing Library",
  zod: "Zod",
  yup: "Yup",
  "io-ts": "io-ts",
  lodash: "Lodash",
  dayjs: "Day.js",
  "date-fns": "date-fns",
  rxjs: "RxJS",
  "react-native": "React Native",
  expo: "Expo",
  electron: "Electron",
  "@tauri-apps/api": "Tauri",
  three: "Three.js",
  d3: "D3.js",
  recharts: "Recharts",
  "chart.js": "Chart.js",
  openai: "OpenAI SDK",
  "@anthropic-ai/sdk": "Anthropic SDK",
  langchain: "LangChain",
  ai: "Vercel AI SDK",
};

const PIP_MAP: Record<string, string> = {
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  starlette: "Starlette",
  tornado: "Tornado",
  aiohttp: "aiohttp",
  sanic: "Sanic",
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
  openai: "OpenAI SDK",
  anthropic: "Anthropic SDK",
  langchain: "LangChain",
  "langchain-core": "LangChain",
  llama_index: "LlamaIndex",
  llama_cpp_python: "llama.cpp",
  requests: "Requests",
  httpx: "HTTPX",
  beautifulsoup4: "BeautifulSoup",
  bs4: "BeautifulSoup",
  scrapy: "Scrapy",
  selenium: "Selenium",
  playwright: "Playwright (py)",
  pydantic: "Pydantic",
  marshmallow: "Marshmallow",
  pytest: "pytest",
  pillow: "Pillow",
  boto3: "boto3",
  paramiko: "Paramiko",
  cryptography: "cryptography",
};

const CARGO_MAP: Record<string, string> = {
  axum: "Axum",
  "actix-web": "Actix Web",
  rocket: "Rocket",
  warp: "Warp",
  hyper: "Hyper",
  poem: "Poem",
  tokio: "Tokio",
  async_std: "async-std",
  smol: "smol",
  sqlx: "SQLx",
  diesel: "Diesel",
  sea_orm: "SeaORM",
  serde: "Serde",
  serde_json: "serde_json",
  reqwest: "Reqwest",
  ureq: "ureq",
  tonic: "Tonic",
  clap: "Clap",
  structopt: "StructOpt",
  anyhow: "anyhow",
  thiserror: "thiserror",
  tracing: "Tracing",
  log: "log",
  env_logger: "env_logger",
  rayon: "Rayon",
  crossbeam: "crossbeam",
  wasm_bindgen: "wasm-bindgen",
  "js-sys": "js-sys",
  "web-sys": "web-sys",
};

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
  "gorm.io/gorm": "GORM",
  "github.com/jmoiern/sqlx": "sqlx (Go)",
  "entgo.io/ent": "Ent",
  "go.mongodb.org/mongo-driver": "MongoDB Driver",
  "google.golang.org/grpc": "gRPC",
  "github.com/spf13/cobra": "Cobra",
  "github.com/urfave/cli": "urfave/cli",
  "github.com/urfave/cli/v2": "urfave/cli",
  "github.com/stretchr/testify": "Testify",
  "github.com/spf13/viper": "Viper",
  "go.uber.org/zap": "Zap",
  "github.com/rs/zerolog": "Zerolog",
};

export interface DepResult {
  framework: string;
  ecosystem: "npm" | "pip" | "cargo" | "go";
}

// ──────────────────────────────────────────────────────────────────
// ファイル取得（Redis キャッシュ付き）
// 404 のファイルも空文字でキャッシュして無駄なリクエストを防ぐ
// ──────────────────────────────────────────────────────────────────

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<string | null> {
  const cacheKey = `depfile:${owner}:${repo}:${path}`;

  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached === "" ? null : cached;
    }
  } catch {
    // Redis エラーはスキップして API にフォールバック
  }

  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      // ファイルなし（404 等）も短めにキャッシュ
      await redis.set(cacheKey, "", { ex: 60 * 60 * 6 }).catch(() => {});
      return null;
    }

    const data = await res.json();
    const content = Buffer.from(data.content, "base64").toString("utf-8");

    // 24時間キャッシュ
    await redis.set(cacheKey, content, { ex: 60 * 60 * 24 }).catch(() => {});
    return content;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// 各ファイルのパーサー
// ──────────────────────────────────────────────────────────────────

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

function parseCargoToml(content: string): DepResult[] {
  const seen = new Set<string>();
  const results: DepResult[] = [];
  const depSection = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/)?.[1] ?? "";

  for (const line of depSection.split("\n")) {
    const name = line.split("=")[0].trim().toLowerCase().replace(/-/g, "_");
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

function parseGoMod(content: string): DepResult[] {
  const seen = new Set<string>();
  const results: DepResult[] = [];

  for (const line of content.split("\n")) {
    const modulePath = line.trim().split(/\s+/)[0];
    const displayName = GO_MAP[modulePath];
    if (displayName && !seen.has(displayName)) {
      seen.add(displayName);
      results.push({ framework: displayName, ecosystem: "go" });
    }
  }
  return results;
}

// ──────────────────────────────────────────────────────────────────
// リポジトリ1つの依存を取得（4ファイルを並列取得）
// ──────────────────────────────────────────────────────────────────

async function fetchRepoDeps(owner: string, repoName: string, token: string): Promise<DepResult[]> {
  const [pkgJson, reqTxt, cargo, goMod] = await Promise.all([
    fetchFileContent(owner, repoName, "package.json", token),
    fetchFileContent(owner, repoName, "requirements.txt", token),
    fetchFileContent(owner, repoName, "Cargo.toml", token),
    fetchFileContent(owner, repoName, "go.mod", token),
  ]);

  const results: DepResult[] = [];
  if (pkgJson) results.push(...parsePackageJson(pkgJson));
  if (reqTxt) results.push(...parseRequirementsTxt(reqTxt));
  if (cargo) results.push(...parseCargoToml(cargo));
  if (goMod) results.push(...parseGoMod(goMod));

  return results;
}

// ──────────────────────────────────────────────────────────────────
// ユーザーの全リポジトリから依存を集計
// cachedRepos を渡すとリポジトリ一覧の再取得をスキップする
// ──────────────────────────────────────────────────────────────────

export async function getUserFrameworkStats(
  githubName: string,
  token: string,
  concurrency = 5,
  cachedRepos?: { name: string }[],
): Promise<{ framework: string; ecosystem: string; repoCount: number }[]> {
  let repos: { name: string }[];

  if (cachedRepos) {
    repos = cachedRepos;
  } else {
    const { fetchUserRepos } = await import("./github");
    repos = await fetchUserRepos(githubName, { token });
  }

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
