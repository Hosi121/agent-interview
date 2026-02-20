import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

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

          if (!account.emailVerified) {
            throw new Error("EMAIL_NOT_VERIFIED");
          }

          return {
            id: account.id,
            email: account.email,
            name: account.user?.name || account.recruiter?.company?.name || "",
            accountType: account.accountType,
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

        if (!account.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // パスキーが登録されていれば2FA検証を要求
        const passkeyCount = await prisma.passkey.count({
          where: { accountId: account.id },
        });

        return {
          id: account.id,
          email: account.email,
          name: account.user?.name || account.recruiter?.company?.name || "",
          accountType: account.accountType,
          passkeyVerificationRequired: passkeyCount > 0,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
        // accountType はJWTから取得（DB不要）
        if (token.accountType) {
          session.user.accountType = token.accountType;
        }
        session.user.passkeyVerificationRequired =
          token.passkeyVerificationRequired ?? false;

        const account = await prisma.account.findUnique({
          where: { email: token.email },
          include: {
            user: true,
            recruiter: {
              include: { company: true },
            },
          },
        });

        if (account) {
          session.user.accountId = account.id;
          if (account.user) {
            session.user.userId = account.user.id;
            session.user.name = account.user.name;
            if (account.user.avatarPath) {
              // アバター変更時にURLが変わるようavatarPathの末尾をキャッシュバスターに使用
              const v = account.user.avatarPath.slice(-8);
              session.user.image = `/api/applicant/avatar?v=${v}`;
            } else {
              session.user.image = null;
            }
          }
          if (account.recruiter) {
            session.user.recruiterId = account.recruiter.id;
            session.user.companyId = account.recruiter.companyId;
            session.user.companyRole = account.recruiter.role;
            session.user.companyName = account.recruiter.company.name;
            session.user.recruiterStatus = account.recruiter.status;
          }
        }
      }
      return session;
    },
    async jwt({ token, user, trigger }): Promise<JWT> {
      if (user && user.email) {
        token.email = user.email;
        token.accountType = user.accountType;
        token.passkeyVerificationRequired =
          user.passkeyVerificationRequired ?? false;
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
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
