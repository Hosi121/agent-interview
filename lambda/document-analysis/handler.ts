import { analyzeDocument } from "../../src/lib/document-analysis";
import { logger } from "../../src/lib/logger";
import { prisma } from "../../src/lib/prisma";

interface AnalysisEvent {
  documentId: string;
  userId: string;
}

export const handler = async (event: AnalysisEvent) => {
  const { documentId, userId } = event;

  logger.info("Lambda document analysis started", { documentId, userId });

  try {
    const result = await analyzeDocument(documentId, userId);
    logger.info("Lambda document analysis succeeded", {
      documentId,
      userId,
      fragmentsCount: result.fragmentsCount,
    });
    return { statusCode: 200, body: result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error(
      "Lambda document analysis failed",
      error instanceof Error ? error : new Error(message),
      { documentId, userId },
    );

    await prisma.document.update({
      where: { id: documentId },
      data: { analysisStatus: "FAILED", analysisError: message },
    });

    return { statusCode: 500, body: { error: message } };
  } finally {
    await prisma.$disconnect();
  }
};
