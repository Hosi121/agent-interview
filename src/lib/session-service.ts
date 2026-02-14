import { prisma } from "./prisma";

/**
 * 求職者AIチャットセッションを取得または作成
 */
export async function getOrCreateUserAIChatSession(userId: string) {
  let session = await prisma.session.findFirst({
    where: { userId, sessionType: "USER_AI_CHAT" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) {
    session = await prisma.session.create({
      data: { sessionType: "USER_AI_CHAT", userId },
      include: { messages: true },
    });
  }
  return session;
}

/**
 * 採用担当者とエージェント間のチャットセッションを取得または作成
 */
export async function getOrCreateChatSession(
  recruiterId: string,
  agentId: string,
) {
  // 既存セッションを探す
  let session = await prisma.session.findFirst({
    where: {
      recruiterId,
      agentId,
      sessionType: "RECRUITER_AGENT_CHAT",
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const isNewSession = !session;

  // なければ作成
  if (!session) {
    session = await prisma.session.create({
      data: {
        sessionType: "RECRUITER_AGENT_CHAT",
        recruiterId,
        agentId,
      },
      include: {
        messages: true,
      },
    });
  }

  return { session, isNewSession };
}

/**
 * 採用担当者とエージェント間のチャットセッションを取得（存在しない場合はnull）
 */
export async function getChatSession(recruiterId: string, agentId: string) {
  return prisma.session.findFirst({
    where: {
      recruiterId,
      agentId,
      sessionType: "RECRUITER_AGENT_CHAT",
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/**
 * セッションのメッセージを取得
 */
export async function getSessionMessages(sessionId: string) {
  return prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * セッションにメッセージを追加
 */
export async function addMessage(
  sessionId: string,
  senderType: "RECRUITER" | "AI" | "USER",
  content: string,
  senderId?: string,
) {
  return prisma.message.create({
    data: {
      sessionId,
      senderType,
      senderId,
      content,
    },
  });
}

/**
 * agentIdからセッションを取得（採用担当者用）
 */
export async function getSessionByAgentId(
  recruiterId: string,
  agentId: string,
) {
  return prisma.session.findFirst({
    where: {
      recruiterId,
      agentId,
      sessionType: "RECRUITER_AGENT_CHAT",
    },
  });
}
