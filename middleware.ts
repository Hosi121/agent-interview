import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/invite",
  "/check-email",
  "/verify-email",
];

// パスキー2FA検証中でもアクセスを許可するルート
const passkeyVerificationAllowedRoutes = ["/verify-passkey"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開ルート・静的ファイルはスキップ
  if (
    publicRoutes.some(
      (route) =>
        pathname === route ||
        (route !== "/" && pathname.startsWith(`${route}/`)),
    ) ||
    pathname.startsWith("/_next/") ||
    /\.\w+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 認証不要のAPIルート
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/");
  const token = await getToken({ req: request });

  // 未認証 → ログインへ（元URLを保持）/ APIは401
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // パスキー2FA検証が必要な場合
  if (token.passkeyVerificationRequired) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "2FA verification required" },
        { status: 403 },
      );
    }
    const isAllowed = passkeyVerificationAllowedRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/verify-passkey", request.url));
    }
    return NextResponse.next();
  }

  // メール未認証ユーザーの制限
  // /check-email, /verify-email は publicRoutes で処理済みのためここには到達しない
  if (!token.emailVerified) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Email not verified" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/check-email", request.url));
  }

  // 2FA不要で /verify-passkey にアクセスした場合はダッシュボードへ
  if (pathname === "/verify-passkey") {
    const accountType = token.accountType;
    const dashboardUrl =
      accountType === "RECRUITER" ? "/recruiter/dashboard" : "/my/dashboard";
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  const accountType = token.accountType;

  // accountType が未設定（既存セッション）→ そのまま通す
  if (!accountType) {
    return NextResponse.next();
  }

  // リクルーターが求職者ルートにアクセス → リクルーターダッシュボードへ
  if (accountType === "RECRUITER" && pathname.startsWith("/my")) {
    const redirectUrl = new URL("/recruiter/dashboard", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // 求職者がリクルータールートにアクセス → 求職者ダッシュボードへ
  if (accountType === "USER" && pathname.startsWith("/recruiter")) {
    const redirectUrl = new URL("/my/dashboard", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
