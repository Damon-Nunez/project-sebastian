import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import {
  displayNameFromAuthUser,
  initialsFromDisplayName,
} from "@/lib/auth/displayName";
import { createSessionClient } from "@/lib/supabase/server";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  let email: string | null = null;
  let displayName: string | null = null;
  let initials = "?";

  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      email = user.email ?? null;
      displayName = displayNameFromAuthUser(user) ?? email;
      initials = initialsFromDisplayName(displayName, email);
    }
  } catch {
    // Missing public Supabase env — header stays signed-out.
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight hover:text-slate-700"
            >
              Sebastian
            </Link>
            <span className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 sm:inline">
              Teacher Assistant
            </span>
            {email ? (
              <nav className="ml-2 hidden items-center gap-3 sm:flex">
                <Link
                  href="/periods"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Periods
                </Link>
                <Link
                  href="/lessons"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Lessons
                </Link>
              </nav>
            ) : null}
          </div>
          {email && displayName ? (
            <SignOutButton
              displayName={displayName}
              email={email}
              initials={initials}
            />
          ) : (
            <span className="text-sm text-slate-500">Desktop workspace</span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
