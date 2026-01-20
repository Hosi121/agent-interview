import { PrismaClient, AccountType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await hash("password123", 12);

  // テスト求職者ユーザー
  const user1 = await prisma.account.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      passwordHash: password,
      accountType: AccountType.USER,
      user: {
        create: {
          name: "山田 太郎",
        },
      },
    },
  });

  // テスト採用担当者ユーザー
  const recruiter1 = await prisma.account.upsert({
    where: { email: "recruiter@example.com" },
    update: {},
    create: {
      email: "recruiter@example.com",
      passwordHash: password,
      accountType: AccountType.RECRUITER,
      recruiter: {
        create: {
          companyName: "株式会社テスト",
        },
      },
    },
  });

  console.log("Created test users:");
  console.log("- User: user@example.com / password123");
  console.log("- Recruiter: recruiter@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
