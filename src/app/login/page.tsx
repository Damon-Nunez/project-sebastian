import { GoogleSignInButton } from "@/components/GoogleSignInButton";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized:
    "That Google account is not on the teacher allowlist. Sign in with the approved school email.",
  auth_callback: "Google sign-in did not finish. Please try again.",
  missing_code: "Sign-in was cancelled or incomplete. Please try again.",
  teacher_sync: "Signed in, but we could not link your teacher profile. Try again.",
  auth_misconfigured:
    "Sign-in is not configured on this deployment. Check Supabase env vars.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "Sign-in failed. Please try again.")
    : null;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 pt-8">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Project Sebastian
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Teacher sign-in
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with the Google account on the allowlist. Only approved teacher
          emails can access the workspace.
        </p>

        {errorMessage ? (
          <p
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6">
          <GoogleSignInButton nextPath={nextPath} />
        </div>
      </div>
    </section>
  );
}
