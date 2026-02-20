import type {
  AccountType,
  CompanyMemberStatus,
  CompanyRole,
} from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    accountType?: AccountType;
    passkeyVerificationRequired?: boolean;
  }

  interface Session {
    user: {
      email?: string | null;
      name?: string | null;
      image?: string | null;
      accountId?: string;
      accountType?: AccountType;
      userId?: string;
      recruiterId?: string;
      companyName?: string;
      companyId?: string;
      companyRole?: CompanyRole;
      recruiterStatus?: CompanyMemberStatus;
      passkeyVerificationRequired?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    email?: string;
    accountType?: AccountType;
    passkeyVerificationRequired?: boolean;
    accountId?: string;
    userId?: string;
    userName?: string;
    avatarPath?: string | null;
    recruiterId?: string;
    companyId?: string;
    companyName?: string;
    companyRole?: CompanyRole;
    recruiterStatus?: CompanyMemberStatus;
  }
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface FragmentData {
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
  confidence?: number;
}

export interface CoverageCategoryDetail {
  category: string;
  label: string;
  current: number;
  required: number;
  fulfilled: boolean;
}

export interface ChatCoverageState {
  percentage: number;
  isReadyToFinish: boolean; // 80%以上
  isComplete: boolean; // 100%
  categories: CoverageCategoryDetail[];
}
