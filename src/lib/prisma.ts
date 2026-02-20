import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "development") {
    const client = new PrismaClient({
      log: [
        { level: "query", emit: "event" },
        { level: "warn", emit: "stdout" },
        { level: "error", emit: "stdout" },
      ],
    });
    client.$on("query", (e) => {
      if (e.duration > 50) {
        logger.warn("prisma.slow_query", {
          duration_ms: e.duration,
          query: e.query.slice(0, 200),
        });
      }
    });
    return client;
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
