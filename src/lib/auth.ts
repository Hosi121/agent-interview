import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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

        return {
          id: account.id,
          email: account.email,
          name: account.user?.name || account.recruiter?.company?.name || "",
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
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
          session.user.accountType = account.accountType;
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
    async jwt({ token, user }) {
      if (user && user.email) {
        token.email = user.email;
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
