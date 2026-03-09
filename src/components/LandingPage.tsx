"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";

interface StatsData {
  members: number;
  commits: number;
  languages: number;
  repositories: number;
}

interface LangData {
  name: string;
  bytes: number;
  percentage: number;
}

interface ContribDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Vue: "#42b883",
};

function getColor(name: string): string {
  if (GITHUB_LANGUAGE_COLORS[name]) return GITHUB_LANGUAGE_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c = Math.floor(Math.abs(((Math.sin(hash) * 10000) % 1) * 16777215)).toString(16);
  return "#" + "000000".substring(0, 6 - c.length) + c;
}

// 実データを使ったミニコントリビューションヒートマップ
function ContribMini({ data }: { data: ContribDay[] }) {
  const COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
  // 直近182日（26週）に絞る
  const recent = data.slice(-182);
  if (recent.length === 0) {
    return (
      <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#484f58", fontSize: 11, fontFamily: "sans-serif" }}>
          データを取得中...
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(26, 1fr)", gap: 3 }}>
      {recent.map((d, i) => (
        <div
          key={i}
          title={`${d.date}: ${d.count}`}
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: COLORS[d.level],
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [langs, setLangs] = useState<LangData[]>([]);
  const [contrib, setContrib] = useState<ContribDay[]>([]);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d: StatsData) => setStats(d))
      .catch(() => {});
    fetch("/api/languages/all")
      .then((r) => r.json())
      .then((d: LangData[]) => setLangs(d.slice(0, 5)))
      .catch(() => {});
    fetch("/api/contributions/all")
      .then((r) => r.json())
      .then((d: ContribDay[]) => setContrib(d))
      .catch(() => {});
  }, []);

  const statItems = [
    { label: "メンバー", value: stats?.members.toString() ?? "–", unit: "人" },
    { label: "総コミット数", value: stats?.commits.toLocaleString() ?? "–", unit: "" },
    { label: "使用言語", value: stats?.languages.toString() ?? "–", unit: "種" },
    { label: "リポジトリ", value: stats?.repositories.toString() ?? "–", unit: "個" },
  ];

  const dots = Array.from({ length: 80 }, (_, i) => ({
    x: (i * 137.508) % 100,
    y: (i * 97.3) % 100,
    r: 0.8 + (i % 4) * 0.5,
    op: 0.04 + (i % 5) * 0.025,
  }));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        fontFamily: "'Courier New', monospace",
        color: "#e6edf3",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 背景ドット */}
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {dots.map((d, i) => (
          <circle key={i} cx={`${d.x}%`} cy={`${d.y}%`} r={d.r} fill="#39d353" opacity={d.op} />
        ))}
      </svg>

      {/* グリッド */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(48,54,61,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(48,54,61,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* トップグロー */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(57,211,83,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ナビ */}
      <nav
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 48px",
          height: 60,
          borderBottom: "1px solid #21262d",
          background: "rgba(13,17,23,0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "linear-gradient(135deg, #39d353, #26a641)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 900,
              color: "#0d1117",
            }}
          >
            技
          </div>
          <span
            style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.02em", color: "#f0f6fc" }}
          >
            技研チャート
          </span>
        </div>
        <button
          onClick={() => signIn("github")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(57,211,83,0.1)",
            border: "1px solid rgba(57,211,83,0.3)",
            borderRadius: 6,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            color: "#39d353",
            cursor: "pointer",
            fontFamily: "sans-serif",
            transition: "all .2s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          ログイン
        </button>
      </nav>

      {/* メイン */}
      <main style={{ position: "relative", zIndex: 5 }}>
        {/* ヒーロー */}
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "72px 24px 0",
            textAlign: "center",
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(20px)",
            transition: "opacity .8s ease, transform .8s ease",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(57,211,83,0.08)",
              border: "1px solid rgba(57,211,83,0.2)",
              borderRadius: 99,
              padding: "4px 14px",
              fontSize: 11,
              color: "#39d353",
              letterSpacing: "0.1em",
              marginBottom: 28,
              fontFamily: "sans-serif",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#39d353",
                display: "inline-block",
                boxShadow: "0 0 6px #39d353",
                animation: "blink 2s infinite",
              }}
            />
            LIVE · 情報技術メディア研究会
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 20,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "#f0f6fc" }}>サークルの</span>
            <span
              style={{
                background: "linear-gradient(90deg, #39d353, #26a641, #3fb950)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              「いま」
            </span>
            <span style={{ color: "#f0f6fc" }}>を</span>
            <br />
            <span style={{ color: "#f0f6fc" }}>数字で共有する</span>
          </h1>

          <p
            style={{
              fontSize: 14,
              color: "#8b949e",
              lineHeight: 1.8,
              maxWidth: 500,
              margin: "0 auto 40px",
              fontFamily: "sans-serif",
            }}
          >
            GitHub・Discord のデータを自動で集計。
            <br />
            使用言語・コミット数・活動時間帯をダッシュボードで可視化します。
          </p>

          <button
            onClick={() => signIn("github")}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "#f0f6fc",
              color: "#0d1117",
              border: "none",
              borderRadius: 8,
              padding: "14px 32px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .2s",
              transform: hovered ? "translateY(-2px)" : "translateY(0)",
              boxShadow: hovered
                ? "0 8px 32px rgba(57,211,83,0.25), 0 0 0 1px rgba(57,211,83,0.3)"
                : "0 2px 8px rgba(0,0,0,0.4)",
              fontFamily: "sans-serif",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            GitHubでログイン
          </button>

          <p style={{ fontSize: 11, color: "#484f58", marginTop: 12, fontFamily: "sans-serif" }}>
            任意参加 · 公開範囲は自分で設定可能 · いつでも登録解除できます
          </p>
        </div>

        {/* スタッツ行 */}
        <div
          style={{
            maxWidth: 700,
            margin: "48px auto 0",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #21262d",
            opacity: loaded ? 1 : 0,
            transition: "opacity 1s ease .3s",
          }}
        >
          {statItems.map((s, i) => (
            <div
              key={i}
              style={{
                background: "#161b22",
                padding: "20px 16px",
                textAlign: "center",
                borderRight: i < 3 ? "1px solid #21262d" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#f0f6fc",
                  letterSpacing: "-0.01em",
                }}
              >
                {s.value}
                <span style={{ fontSize: 12, color: "#39d353", marginLeft: 2 }}>{s.unit}</span>
              </div>
              <div
                style={{ fontSize: 10, color: "#8b949e", marginTop: 4, fontFamily: "sans-serif" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* プレビューカード（実データのみ） */}
        <div
          style={{
            maxWidth: 900,
            margin: "32px auto 0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            padding: "0 24px",
            opacity: loaded ? 1 : 0,
            transition: "opacity 1.2s ease .5s",
          }}
        >
          {/* 言語ランキング */}
          <div
            style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8b949e",
                letterSpacing: "0.08em",
                marginBottom: 16,
                fontFamily: "sans-serif",
              }}
            >
              📊 使用言語ランキング
            </div>
            {langs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 16,
                        height: 12,
                        borderRadius: 3,
                        background: "#21262d",
                        animation: "blink 1.5s infinite",
                      }}
                    />
                    <div
                      style={{
                        width: 80,
                        height: 12,
                        borderRadius: 3,
                        background: "#21262d",
                        animation: "blink 1.5s infinite",
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        background: "#21262d",
                        animation: "blink 1.5s infinite",
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {langs.map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{ fontSize: 11, color: "#8b949e", width: 16, fontFamily: "monospace" }}
                    >
                      {i + 1}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#e6edf3", width: 90, fontFamily: "monospace" }}
                    >
                      {l.name}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "#21262d",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 3,
                          background: getColor(l.name),
                          width: `${l.percentage}%`,
                          transition: "width 1s ease",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#8b949e",
                        width: 36,
                        textAlign: "right",
                        fontFamily: "monospace",
                      }}
                    >
                      {l.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* コントリビューション（実データ） */}
          <div
            style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8b949e",
                letterSpacing: "0.08em",
                marginBottom: 16,
                fontFamily: "sans-serif",
              }}
            >
              🌱 サークル全体のコントリビューション
            </div>
            <ContribMini data={contrib} />
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "40px 0 48px",
            fontSize: 11,
            color: "#484f58",
            fontFamily: "sans-serif",
            opacity: loaded ? 1 : 0,
            transition: "opacity 1.4s ease .7s",
          }}
        >
          公開リポジトリのみ参照 · プライベートリポジトリは任意で連携可能
        </div>
      </main>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
