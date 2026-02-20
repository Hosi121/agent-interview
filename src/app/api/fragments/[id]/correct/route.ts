import { FragmentType, SourceType } from "@prisma/client";
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
        type: z.nativeEnum(FragmentType),
        content: z.string().min(1).max(2000),
        skills: z.array(z.string().max(100)).max(20).default([]),
        keywords: z.array(z.string().max(100)).max(20).default([]),
        quality: z.enum(["low", "medium", "high"]).default("medium"),
      }),
    )
    .min(1)
    .max(10),
});

export const POST = withUserValidation<
  z.infer<typeof correctSchema>,
  RouteContext
>(correctSchema, async (body, req, session, context) => {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    throw new ValidationError("無効なフラグメントIDです");
  }

  await prisma.$transaction(async (tx) => {
    const fragment = await tx.fragment.findUnique({
      where: { id },
    });

    if (!fragment) {
      throw new NotFoundError("フラグメントが見つかりません");
    }

    if (fragment.userId !== session.user.userId) {
      throw new ForbiddenError("このフラグメントを修正する権限がありません");
    }

    await tx.fragment.createMany({
      data: body.newFragments.map((f) => ({
        userId: session.user.userId,
        type: f.type,
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
