import type { NextRequest, NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const POLL_INTERVAL = 2000;
const TIMEOUT = 5 * 60 * 1000;

export const GET = withUserAuth<RouteContext>(
  async (_req: NextRequest, session, context) => {
    const { id } = await context.params;

    const document = await prisma.document.findFirst({
      where: { id, userId: session.user.userId },
    });

    if (!document) {
      throw new NotFoundError("ドキュメントが見つかりません");
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const startTime = Date.now();

        const send = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };

        const poll = async () => {
          if (cancelled) return;

          try {
            if (Date.now() - startTime > TIMEOUT) {
              send("timeout", { message: "タイムアウトしました" });
              controller.close();
              return;
            }

            const doc = await prisma.document.findUnique({
              where: { id },
              select: {
                analysisStatus: true,
                summary: true,
                analysisError: true,
                analyzedAt: true,
              },
            });

            if (!doc) {
              send("error", { message: "ドキュメントが見つかりません" });
              controller.close();
              return;
            }

            if (doc.analysisStatus === "COMPLETED") {
              send("completed", {
                status: "COMPLETED",
                summary: doc.summary,
                analyzedAt: doc.analyzedAt,
              });
              controller.close();
              return;
            }

            if (doc.analysisStatus === "FAILED") {
              send("failed", {
                status: "FAILED",
                error: doc.analysisError,
              });
              controller.close();
              return;
            }

            send("progress", { status: doc.analysisStatus });
            timerId = setTimeout(poll, POLL_INTERVAL);
          } catch {
            send("error", { message: "サーバーエラーが発生しました" });
            controller.close();
          }
        };

        poll();
      },
      cancel() {
        cancelled = true;
        clearTimeout(timerId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    }) as unknown as NextResponse;
  },
);
