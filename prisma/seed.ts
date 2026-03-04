import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // テストユーザーの作成
  const user = await prisma.user.upsert({
    where: { githubId: "12345678" },
    update: {},
    create: {
      githubId: "12345678",
      githubName: "test-user",
      nickname: "テスト太郎",
      avatarUrl: "https://github.com/identicons/jasonlong.png",
      // 言語データのサンプル
      languages: {
        create: [
          { language: "TypeScript", bytes: 50000 },
          { language: "Rust", bytes: 30000 },
          { language: "Go", bytes: 10000 },
        ],
      },
    },
  });

  console.log({ user });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
