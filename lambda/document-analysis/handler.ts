import { processDocument } from "../../src/lib/document-processing";
import { logger } from "../../src/lib/logger";

interface AnalysisEvent {
  documentId: string;
  userId: string;
  filePath: string;
  fileName: string;
}

export const handler = async (event: AnalysisEvent) => {
  const { documentId, userId, filePath, fileName } = event;

  logger.info("Lambda document analysis started", {
    documentId,
    userId,
    filePath,
    fileName,
  });

  const callbackUrl = process.env.CALLBACK_URL;
  const callbackSecret = process.env.CALLBACK_SECRET;

  if (!callbackUrl || !callbackSecret) {
    logger.error(
      "Missing CALLBACK_URL or CALLBACK_SECRET",
      new Error("Missing callback configuration"),
    );
    return {
      statusCode: 500,
      body: { error: "Missing callback configuration" },
    };
  }

  try {
    const result = await processDocument(filePath, fileName);

    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": callbackSecret,
      },
      body: JSON.stringify({
        documentId,
        userId,
        fragments: result.fragments,
        summary: result.summary,
      }),
    });

    if (!response.ok) {
      throw new Error(`Callback failed with status ${response.status}`);
    }

    logger.info("Lambda document analysis succeeded", {
      documentId,
      userId,
      fragmentsCount: result.fragments.length,
    });

    return { statusCode: 200, body: { success: true } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error(
      "Lambda document analysis failed",
      error instanceof Error ? error : new Error(message),
      { documentId, userId },
    );

    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": callbackSecret,
        },
        body: JSON.stringify({
          documentId,
          userId,
          error: message,
        }),
      });
    } catch (callbackError) {
      logger.error(
        "Failed to send error callback",
        callbackError instanceof Error
          ? callbackError
          : new Error("Callback failed"),
        { documentId, userId },
      );
    }

    return { statusCode: 500, body: { error: message } };
  }
};
