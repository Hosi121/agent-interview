import { type FragmentType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserValidation } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  deleteFragmentWithRelations,
  qualityToConfidence,
  UUID_REGEX,
} from "@/lib/fragment-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const correctSchema = z.object({
  newFragments: z
    .array(
      z.object({
        type: z.string(),
        content: z.string().min(1),
        skills: z.array(z.string()).default([]),
        keywords: z.array(z.string()).default([]),
        quality: z.string().default("medium"),
      }),
    )
    .min(1),
});

export const POST = withUserValidation<
  z.infer<typeof correctSchema>,
  RouteContext
>(correctSchema, async (body, req, session, context) => {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    throw new ValidationError("無効なフラグメントIDです");
  }

  const fragment = await prisma.fragment.findUnique({
    where: { id },
  });

  if (!fragment) {
    throw new NotFoundError("フラグメントが見つかりません");
  }

  if (fragment.userId !== session.user.userId) {
    throw new ForbiddenError("このフラグメントを修正する権限がありません");
  }

  await prisma.$transaction(async (tx) => {
    await tx.fragment.createMany({
      data: body.newFragments.map((f) => ({
        userId: session.user.userId,
        type: (f.type as FragmentType) || "FACT",
        content: f.content,
        skills: f.skills,
        keywords: f.keywords,
        sourceType: SourceType.CONVERSATION,
        confidence: qualityToConfidence[f.quality] ?? 0.7,
      })),
    });

    await deleteFragmentWithRelations(tx, id);
  });

  return NextResponse.json({ success: true });
});
