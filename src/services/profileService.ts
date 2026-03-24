import { prisma } from "@/lib/prisma";

export type ProfileUpdateRequest = {
  nickname?: string | null;
  links: { id?: string; platform: string; url: string }[];
};

export async function updateUserProfile(userId: string, data: ProfileUpdateRequest) {
  return await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { nickname: data.nickname },
    });

    if (data.links && data.links.length > 0) {
      const existingLinks = data.links.filter((link) => link.id);
      const newLinks = data.links.filter((link) => !link.id);

      const incomingLinkIds = existingLinks.map((l) => l.id as string);

      await tx.userLink.deleteMany({
        where: {
          userId: userId,
          ...(incomingLinkIds.length > 0 ? { id: { notIn: incomingLinkIds } } : {}),
        },
      });

      if (existingLinks.length > 0) {
        await Promise.all(
          existingLinks.map((link) =>
            tx.userLink.updateMany({
              where: {
                id: link.id,
                userId: userId,
              },
              data: { platform: link.platform, url: link.url },
            }),
          ),
        );
      }

      if (newLinks.length > 0) {
        await tx.userLink.createMany({
          data: newLinks.map((link) => ({
            userId: userId,
            platform: link.platform,
            url: link.url,
          })),
        });
      }
    } else {
      await tx.userLink.deleteMany({ where: { userId } });
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
