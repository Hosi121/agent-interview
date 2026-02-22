import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { logger } from "./logger";
import { prisma } from "./prisma";

/**
 * JWTトークンにアカウント情報を格納する
 * ログイン時とtrigger="update"時に呼ばれる
 */
async function populateTokenFromDb(token: JWT): Promise<void> {
  if (!token.email) return;
  const account = await prisma.account.findUnique({
    where: { email: token.email },
    include: {
      user: true,
      recruiter: { include: { company: true } },
    },
  });
  if (!account) return;
  token.accountId = account.id;
  token.accountType = account.accountType;
  token.emailVerified = !!account.emailVerified;
  // ロール変更時にstaleデータが残らないようリセット
  token.userId = undefined;
  token.userName = undefined;
  token.avatarPath = undefined;
  token.recruiterId = undefined;
  token.companyId = undefined;
  token.companyName = undefined;
  token.companyRole = undefined;
  token.recruiterStatus = undefined;
  if (account.user) {
    token.userId = account.user.id;
    token.userName = account.user.name;
    token.avatarPath = account.user.avatarPath;
  }
  if (account.recruiter) {
    token.recruiterId = account.recruiter.id;
    token.companyId = account.recruiter.companyId;
    token.companyName = account.recruiter.company.name;
    token.companyRole = account.recruiter.role;
    token.recruiterStatus = account.recruiter.status;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        passkeyLogin: { label: "Passkey Login", type: "text" },
      },
      async authorize(credentials) {
        // パスキー認証フロー
        if (credentials?.passkeyLogin) {
          const cookieStore = await cookies();
          const token = cookieStore.get("passkey_token")?.value;
          if (!token) {
            return null;
          }

          // トークンをアトミックに検証・削除（1回限り使用）
          // challengeフィールドにunique indexがあるため、deleteは一意に特定される
          const stored = await prisma.webAuthnChallenge
            .delete({
              where: {
                challenge: token,
                type: "login_token",
                expiresAt: { gt: new Date() },
              },
            })
            .catch(() => null);

          if (!stored || !stored.accountId) {
            return null;
          }

          // DB検証成功後にCookieを削除（DB接続エラー時にリトライ可能にする）
          cookieStore.delete("passkey_token");

          const account = await prisma.account.findUnique({
            where: { id: stored.accountId },
            include: {
              user: true,
              recruiter: { include: { company: true } },
            },
          });

          if (!account) {
            return null;
          }

          return {
            id: account.id,
            email: account.email,
            name: account.user?.name || account.recruiter?.company?.name || "",
            accountType: account.accountType,
            emailVerified: !!account.emailVerified,
          };
        }

        // 従来のパスワード認証フロー
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const account = await prisma.account.findUnique({
          where: { email: credentials.email },
          include: {
            user: true,
            recruiter: {
              include: { company: true },
            },
          },
        });

        if (!account) {
          return null;
        }

        const isValid = await compare(
          credentials.password,
          account.passwordHash,
        );
        if (!isValid) {
          return null;
        }

        // パスキーが登録されていれば2FA検証を要求（メール認証済みの場合のみ）
        let passkeyVerificationRequired = false;
        if (account.emailVerified) {
          const passkeyCount = await prisma.passkey.count({
            where: { accountId: account.id },
          });
          passkeyVerificationRequired = passkeyCount > 0;
        }

        return {
          id: account.id,
          email: account.email,
          name: account.user?.name || account.recruiter?.company?.name || "",
          accountType: account.accountType,
          emailVerified: !!account.emailVerified,
          passkeyVerificationRequired,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // ログイン時: DB全フィールドをトークンに格納
      if (user && user.email) {
        token.email = user.email;
        token.accountType = user.accountType;
        token.emailVerified = !!user.emailVerified;
        token.passkeyVerificationRequired =
          user.passkeyVerificationRequired ?? false;
        await populateTokenFromDb(token);
      }
      // プロフィール変更時: DBから再取得
      if (trigger === "update") {
        await populateTokenFromDb(token);
      }

      // セッション更新トリガー: 2FA検証完了のCookieを確認
      if (trigger === "update" && token.passkeyVerificationRequired) {
        const cookieStore = await cookies();
        const verifiedToken = cookieStore.get("passkey_2fa_verified")?.value;
        if (verifiedToken) {
          // ワンタイムトークンをアトミック削除で検証
          const stored = await prisma.webAuthnChallenge
            .delete({
              where: {
                challenge: verifiedToken,
                type: "2fa_verified",
                expiresAt: { gt: new Date() },
              },
            })
            .catch(() => null);

          // token.sub は CredentialsProvider の authorize() で返した id (= account.id) と一致する
          if (stored && stored.accountId === token.sub) {
            token.passkeyVerificationRequired = false;
          }

          cookieStore.delete("passkey_2fa_verified");
        }
      }

      return token;
    },
    async session({ session, token }) {
      const start = performance.now();
      // JWTからセッションへ直接マッピング（DBクエリなし）
      if (session.user) {
        session.user.accountId = token.accountId;
        session.user.accountType = token.accountType;
        session.user.emailVerified = token.emailVerified ?? false;
        session.user.passkeyVerificationRequired =
          token.passkeyVerificationRequired ?? false;
        if (token.userId) {
          session.user.userId = token.userId;
          session.user.name = token.userName ?? null;
          if (token.avatarPath) {
            // アバター変更時にURLが変わるようavatarPathの末尾をキャッシュバスターに使用
            const v = token.avatarPath.slice(-8);
            session.user.image = `/api/applicant/avatar?v=${v}`;
          } else {
            session.user.image = null;
          }
        }
        if (token.recruiterId) {
          session.user.recruiterId = token.recruiterId;
          session.user.companyId = token.companyId;
          session.user.companyName = token.companyName;
          session.user.companyRole = token.companyRole;
          session.user.recruiterStatus = token.recruiterStatus;
        }
      }
      logger.info("auth.session_callback", {
        duration_ms: Math.round(performance.now() - start),
      });
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
