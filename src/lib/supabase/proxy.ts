import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed, parseAllowlist } from "@/lib/auth/allowlist";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/health"];

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Redirect while preserving cookies written by the Supabase client (refresh/signOut). */
function redirectWithCookies(url: URL, cookiesToSet: CookieToSet[]) {
  const redirect = NextResponse.redirect(url);
  cookiesToSet.forEach(({ name, value, options }) => {
    redirect.cookies.set(name, value, options);
  });
  return redirect;
}

/**
 * Refresh the auth session cookie and gate non-public routes.
 * Used by src/proxy.ts (Next.js 16 proxy convention).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  let cookiesToSet: CookieToSet[] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authConfigured = Boolean(url && anonKey);

  // Dev-only scaffolding escape hatch. Production fails closed.
  if (!authConfigured) {
    if (
      process.env.NODE_ENV === "production" &&
      !isPublicPath(request.nextUrl.pathname)
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "auth_misconfigured");
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies) {
        cookiesToSet = nextCookies;
        nextCookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        nextCookies.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return redirectWithCookies(redirectUrl, cookiesToSet);
  }

  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return redirectWithCookies(redirectUrl, cookiesToSet);
  }

  // Align with /auth/callback: empty allowlist denies access.
  if (user?.email && !isPublicPath(pathname)) {
    const allowlist = parseAllowlist(process.env.ALLOWED_TEACHER_EMAILS);
    if (allowlist.length === 0 || !isEmailAllowed(user.email, allowlist)) {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "not_authorized");
      return redirectWithCookies(redirectUrl, cookiesToSet);
    }
  }

  return supabaseResponse;
}
