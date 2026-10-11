import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import {
  displayNameFromAuthUser,
  initialsFromDisplayName,
} from "@/lib/auth/displayName";
import { getCurrentTeacher, TeacherAuthError } from "@/lib/auth/teacher";
import { loadSetupProgress } from "@/lib/setup/loadSetupProgress";
import { isSetupWorkPath } from "@/lib/setup/progress";
import { createSessionClient } from "@/lib/supabase/server";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  let email: string | null = null;
  let displayName: string | null = null;
  let initials = "?";
  let subject = "";
  let gradeLabel = "";
  let setupFinished = true;
  let showSetupBanner = false;

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

  if (email) {
      try {
        const teacher = await getCurrentTeacher();
        const progress = await loadSetupProgress(teacher);
        if (progress.displayName.trim()) {
          displayName = progress.displayName.trim();
          initials = initialsFromDisplayName(displayName, email);
        }
        subject = progress.subject.trim();
        gradeLabel = progress.gradeLabel.trim();
        const pathname = (await headers()).get("x-pathname") ?? "";
        setupFinished = progress.finished;
      showSetupBanner =
        !progress.finished && pathname !== "" && pathname !== "/setup";

      if (pathname) {
        if (progress.finished && pathname === "/setup") redirect("/");
        if (!progress.finished && !isSetupWorkPath(pathname)) {
          redirect("/setup");
        }
      }
    } catch (error) {
      if (!(error instanceof TeacherAuthError)) throw error;
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href={email && !setupFinished ? "/setup" : "/"}
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
                  href="/rubrics"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Rubrics
                </Link>
                {setupFinished ? (
                  <>
                    <Link
                      href="/grading"
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      Grading
                    </Link>
                    <Link
                      href="/lessons"
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      Lessons
                    </Link>
                  </>
                ) : null}
              </nav>
            ) : null}
          </div>
          {email && displayName ? (
            <SignOutButton
              displayName={displayName}
              email={email}
              initials={initials}
              subject={subject}
              gradeLabel={gradeLabel}
            />
          ) : (
            <span className="text-sm text-slate-500">Desktop workspace</span>
          )}
        </div>
      </header>
      {showSetupBanner ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-sm text-amber-950">
            <p>Finish setup to open lessons and grading.</p>
            <Link href="/setup" className="font-medium underline-offset-2 hover:underline">
              Back to setup
            </Link>
          </div>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
