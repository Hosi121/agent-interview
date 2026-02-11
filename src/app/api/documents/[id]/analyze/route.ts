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

    const document = await prisma.document.findFirst({
      where: {
        id,
        userId: session.user.userId,
      },
    });

    if (!document) {
      throw new NotFoundError("ドキュメントが見つかりません");
    }

    if (document.analysisStatus === "ANALYZING") {
      throw new ConflictError("このドキュメントは現在解析中です");
    }

    await prisma.document.update({
      where: { id },
      data: { analysisStatus: "ANALYZING", analysisError: null },
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
