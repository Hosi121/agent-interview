import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const applicantRoutes = [
  "/dashboard",
  "/chat",
  "/documents",
  "/agent",
  "/inbox",
  "/settings",
];

const publicRoutes = ["/", "/login", "/register", "/invite"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開ルート・APIルート・静的ファイルはスキップ
  if (
    publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    ) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    /\.\w+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });

  // 未認証 → ログインへ
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const accountType = token.accountType;

  // accountType が未設定（既存セッション）→ そのまま通す
  if (!accountType) {
    return NextResponse.next();
  }

  // リクルーターが求職者ルートにアクセス → リクルーターダッシュボードへ
  if (
    accountType === "RECRUITER" &&
    applicantRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    const redirectUrl = new URL("/recruiter/dashboard", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // 求職者がリクルータールートにアクセス → 求職者ダッシュボードへ
  if (accountType === "USER" && pathname.startsWith("/recruiter")) {
    const redirectUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
