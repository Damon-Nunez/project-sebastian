"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SignOutButtonProps = {
  displayName: string;
  email: string;
  initials: string;
  subject: string;
  gradeLabel: string;
};

export function SignOutButton({
  displayName,
  email,
  initials,
  subject,
  gradeLabel,
}: SignOutButtonProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setPending(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="flex items-center gap-3">
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Profile for ${displayName}`}
          onClick={() => setOpen((current) => !current)}
          className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold tracking-wide text-white"
            aria-hidden
          >
            {initials}
          </span>
          <span className="hidden max-w-[12rem] truncate text-sm font-medium text-slate-800 sm:inline">
            {displayName}
          </span>
        </button>
        {open ? (
          <div
            role="dialog"
            aria-label="Your profile"
            className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          >
            <p className="truncate text-sm font-medium text-slate-900">
              {displayName}
            </p>
            <p className="truncate text-xs text-slate-500">{email}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Subject
                </dt>
                <dd className="mt-0.5 text-slate-900">{subject || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Grade
                </dt>
                <dd className="mt-0.5 text-slate-900">
                  {gradeLabel || "Not set"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
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
