import { NextResponse } from "next/server";
import { isEmailAllowed, parseAllowlist } from "@/lib/auth/allowlist";
import { syncTeacherFromAuthUser } from "@/lib/auth/syncTeacher";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  const allowlist = parseAllowlist(process.env.ALLOWED_TEACHER_EMAILS);
  const email = data.user.email ?? "";

  if (allowlist.length === 0 || !isEmailAllowed(email, allowlist)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_authorized`);
  }

  try {
    await syncTeacherFromAuthUser(data.user);
  } catch {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=teacher_sync`);
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
