import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileBuffer } from "@/lib/minio";
import { extractFragments } from "@/lib/openai";
import { FragmentType, SourceType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: {
        id,
        userId: session.user.userId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const fileBuffer = await getFileBuffer(document.filePath);
    let textContent = "";

    if (document.fileName.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(fileBuffer);
      textContent = pdfData.text;
    } else if (
      document.fileName.toLowerCase().endsWith(".txt") ||
      document.fileName.toLowerCase().endsWith(".md")
    ) {
      textContent = fileBuffer.toString("utf-8");
    } else {
      textContent = fileBuffer.toString("utf-8");
    }

    if (!textContent.trim()) {
      return NextResponse.json(
        { error: "ドキュメントからテキストを抽出できませんでした" },
        { status: 400 }
      );
    }

    const truncatedContent = textContent.slice(0, 10000);

    const result = await extractFragments(truncatedContent);

    const validFragmentTypes = Object.values(FragmentType);
    const createdFragments = [];

    for (const fragment of result.fragments || []) {
      const fragmentType = validFragmentTypes.includes(fragment.type as FragmentType)
        ? (fragment.type as FragmentType)
        : FragmentType.FACT;

      const created = await prisma.fragment.create({
        data: {
          userId: session.user.userId,
          type: fragmentType,
          content: fragment.content,
          skills: fragment.skills || [],
          keywords: fragment.keywords || [],
          sourceType: SourceType.DOCUMENT,
          sourceId: document.id,
        },
      });
      createdFragments.push(created);
    }

    const summary =
      createdFragments.length > 0
        ? `${createdFragments.length}件の記憶のかけらを抽出しました`
        : "記憶のかけらが見つかりませんでした";

    await prisma.document.update({
      where: { id: document.id },
      data: { summary },
    });

    return NextResponse.json({
      success: true,
      fragmentsCount: createdFragments.length,
      summary,
    });
  } catch (error) {
    console.error("Document analysis error:", error);
    return NextResponse.json(
      { error: "ドキュメントの解析に失敗しました" },
      { status: 500 }
    );
  }
}
