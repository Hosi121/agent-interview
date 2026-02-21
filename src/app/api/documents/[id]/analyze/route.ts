import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { ConflictError, InternalError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10分

export const POST = withUserAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const lambdaArn = process.env.DOCUMENT_ANALYSIS_LAMBDA_ARN;
    if (!lambdaArn) {
      logger.error(
        "DOCUMENT_ANALYSIS_LAMBDA_ARN is not configured",
        new Error("Missing environment variable"),
      );
      throw new InternalError("ドキュメント解析サービスが設定されていません");
    }

    // トランザクション内でFOR UPDATEロックを取得し、ステータスチェックと更新を原子的に実行
    // これにより、同一ドキュメントへの同時解析リクエストによる二重Lambda起動を防止
    const document = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          fileName: string;
          filePath: string;
          analysisStatus: string;
          analyzedAt: Date | null;
          createdAt: Date;
        }>
      >`SELECT id, "userId", "fileName", "filePath", "analysisStatus", "analyzedAt", "createdAt"
        FROM "Document"
        WHERE id = ${id} AND "userId" = ${session.user.userId}
        FOR UPDATE`;

      const doc = rows[0];
      if (!doc) {
        throw new NotFoundError("ドキュメントが見つかりません");
      }

      if (doc.analysisStatus === "ANALYZING") {
        const startedAt = doc.analyzedAt ?? doc.createdAt;
        if (Date.now() - new Date(startedAt).getTime() < STALE_THRESHOLD_MS) {
          throw new ConflictError("このドキュメントは現在解析中です");
        }
      }

      await tx.document.update({
        where: { id },
        data: {
          analysisStatus: "ANALYZING",
          analysisError: null,
          analyzedAt: new Date(),
        },
      });

      return doc;
    });

    try {
      await lambda.send(
        new InvokeCommand({
          FunctionName: lambdaArn,
          InvocationType: "Event",
          Payload: JSON.stringify({
            documentId: id,
            userId: session.user.userId,
            filePath: document.filePath,
            fileName: document.fileName,
          }),
        }),
      );
    } catch (error) {
      logger.error("Lambda invocation failed", error as Error, {
        documentId: id,
        lambdaArn,
      });
      await prisma.document.update({
        where: { id },
        data: {
          analysisStatus: "FAILED",
          analysisError: "解析ジョブの開始に失敗しました",
        },
      });
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        message: "解析を開始しました",
        analysisStatus: "ANALYZING",
      },
      { status: 202 },
    );
  },
);
