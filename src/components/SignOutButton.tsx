"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SignOutButtonProps = {
  displayName: string;
  email: string;
  initials: string;
};

export function SignOutButton({
  displayName,
  email,
  initials,
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold tracking-wide text-white"
          aria-hidden
          title={email}
        >
          {initials}
        </span>
        <span className="hidden max-w-[12rem] truncate text-sm font-medium text-slate-800 sm:inline">
          {displayName}
        </span>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
