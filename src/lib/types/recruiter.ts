export type MemberSummary = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: "ACTIVE" | "INVITED" | "DISABLED";
  companyName: string;
  createdAt: string;
  joinedAt: string | null;
};

export type InviteSummary = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptUrl: string;
};

export type MembersResponse = {
  company: { id: string; name: string; slug: string };
  myRole: "OWNER" | "ADMIN" | "MEMBER";
  members: MemberSummary[];
  invites: InviteSummary[];
};
