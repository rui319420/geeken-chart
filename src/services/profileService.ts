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

    if (data.links) {
      const incomingLinkIds = data.links
        .map((link) => link.id)
        .filter((id): id is string => id !== undefined);

      await tx.userLink.deleteMany({
        where: {
          userId: userId,
          id: {
            notIn: incomingLinkIds.length > 0 ? incomingLinkIds : ["dummy-id-to-prevent-empty-in"],
          },
        },
      });

      for (const link of data.links) {
        if (link.id) {
          await tx.userLink.update({
            where: { id: link.id },
            data: { platform: link.platform, url: link.url },
          });
        } else {
          await tx.userLink.create({
            data: {
              userId: userId,
              platform: link.platform,
              url: link.url,
            },
          });
        }
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
