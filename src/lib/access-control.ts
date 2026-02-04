import { prisma } from "@/lib/prisma";

export async function isCompanyAccessDenied(
  companyId: string,
  userId: string,
): Promise<boolean> {
  const access = await prisma.companyAccess.findUnique({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
    select: { status: true },
  });

  return access?.status === "DENY";
}
