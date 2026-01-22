import { prisma } from "@/lib/prisma";

export async function isCompanyAccessDenied(
  recruiterId: string,
  userId: string,
): Promise<boolean> {
  const access = await prisma.companyAccess.findUnique({
    where: {
      userId_recruiterId: {
        userId,
        recruiterId,
      },
    },
    select: { status: true },
  });

  return access?.status === "DENY";
}
