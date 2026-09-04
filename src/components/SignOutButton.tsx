"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SignOutButtonProps = {
  email: string;
};

export function SignOutButton({ email }: SignOutButtonProps) {
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
      <span className="hidden max-w-[14rem] truncate text-sm text-slate-600 sm:inline">
        {email}
      </span>
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
