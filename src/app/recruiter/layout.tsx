"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigation = [
  { name: "ダッシュボード", href: "/recruiter/dashboard" },
  { name: "求人管理", href: "/recruiter/jobs" },
  { name: "パイプライン", href: "/recruiter/pipeline" },
  { name: "エージェント一覧", href: "/recruiter/agents" },
  { name: "興味リスト", href: "/recruiter/interests" },
  { name: "ウォッチリスト", href: "/recruiter/watches" },
  { name: "プラン・ポイント", href: "/recruiter/billing" },
];

interface Subscription {
  pointBalance: number;
  planName: string;
}

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const response = await fetch("/api/subscription");
      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          setSubscription({
            pointBalance: data.subscription.pointBalance,
            planName: data.subscription.planName,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchSubscription();
    }
  }, [status, fetchSubscription]);

  if (status === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link
                href="/recruiter/dashboard"
                className="text-xl font-bold text-primary"
              >
                Agent Interview
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {subscription && (
                <Badge
                  variant="outline"
                  className="hidden md:flex gap-1.5 py-1"
                >
                  <svg
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-semibold tabular-nums">
                    {subscription.pointBalance}
                  </span>
                  <span className="text-muted-foreground">pt</span>
                </Badge>
              )}
              <span className="text-sm text-muted-foreground hidden md:block">
                {session.user?.companyName}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative size-8 rounded-full"
                    aria-label="アカウントメニュー"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback>
                        {session.user?.companyName?.[0] || "R"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="font-medium">
                    {session.user?.companyName}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-muted-foreground">
                    {session.user?.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
