import { prisma } from "@/lib/prisma";

export type ProfileUpdateRequest = {
  nickname?: string | null;
  links: { platform: string; url: string }[];
};

export async function updateUserProfile(userId: string, data: ProfileUpdateRequest) {
  return await prisma.$transaction(async (tx) => {
    // ユーザーの基本情報（ニックネームなど）を更新
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        nickname: data.nickname,
      },
      include: { links: true },
    });

    // 古いリンクをすべて削除
    await tx.userLink.deleteMany({
      where: { userId },
    });

    // 新しいリンクを一括で登録
    if (data.links && data.links.length > 0) {
      await tx.userLink.createMany({
        data: data.links.map((link) => ({
          userId: userId,
          platform: link.platform,
          url: link.url,
        })),
      });
    }

    return updatedUser;
  });
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      links: true,
    },
  });

  if (!user) throw new Error("User not found");

  return user;
}
