import { prisma } from "@/lib/prisma";

export type ProfileUpdateRequest = {
  nickname?: string | null;
  links: { platform: string; url: string }[];
};

export async function updateUserProfile(userId: string, data: ProfileUpdateRequest) {
  return await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { nickname: data.nickname },
    });

    await tx.userLink.deleteMany({ where: { userId } });

    if (data.links.length > 0) {
      await tx.userLink.createMany({
        data: data.links.map((link) => ({
          userId,
          platform: link.platform,
          url: link.url,
        })),
      });
    }

    return await tx.user.findUnique({
      where: { id: userId },
      include: { links: true },
    });
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
