/**
 * Google Drive OAuth token helpers (SCRUM-86 / 2.4).
 * Tokens are stored on teachers via admin client — never exposed in getCurrentTeacher.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireGoogleOAuthEnv } from "@/lib/env";
import { GOOGLE_DRIVE_FILE_SCOPE } from "@/lib/auth/googleDriveScopes";

export { GOOGLE_DRIVE_FILE_SCOPE };
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Refresh a minute early so uploads don't race expiry. */
const EXPIRY_SKEW_MS = 60_000;

export class GoogleDriveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDriveAuthError";
  }
}

export type TeacherGoogleTokens = {
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: string | null;
};

export function isGoogleAccessTokenFresh(
  expiresAtIso: string | null | undefined,
  nowMs: number = Date.now(),
  skewMs: number = EXPIRY_SKEW_MS,
): boolean {
  if (!expiresAtIso) return false;
  const expiresAtMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAtMs)) return false;
  return expiresAtMs - skewMs > nowMs;
}

export function accessTokenExpiresAtIso(
  expiresInSeconds: number,
  now: Date = new Date(),
): string {
  const ms = Math.max(0, expiresInSeconds) * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

type PersistGoogleTokensInput = {
  authUserId: string;
  accessToken: string | null | undefined;
  refreshToken: string | null | undefined;
  /** Google `expires_in` seconds; defaults to 3600 when access token is present. */
  expiresInSeconds?: number | null;
};

/**
 * Save provider tokens from the OAuth callback session onto the teacher row.
 * Preserves an existing refresh token when Google omits a new one.
 */
export async function persistTeacherGoogleTokensFromSession(
  input: PersistGoogleTokensInput,
): Promise<void> {
  const accessToken = input.accessToken?.trim() || null;
  const refreshToken = input.refreshToken?.trim() || null;

  if (!accessToken && !refreshToken) {
    return;
  }

  const admin = createAdminSupabaseClient();
  const { data: teacher, error: lookupError } = await admin
    .from("teachers")
    .select("id, google_refresh_token")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();

  if (lookupError) {
    throw new GoogleDriveAuthError(
      `Failed to look up teacher for Drive tokens: ${lookupError.message}`,
    );
  }
  if (!teacher) {
    throw new GoogleDriveAuthError(
      "Teacher profile not found while saving Drive tokens",
    );
  }

  const nextRefresh = refreshToken ?? teacher.google_refresh_token ?? null;
  const expiresIn =
    typeof input.expiresInSeconds === "number" && input.expiresInSeconds > 0
      ? input.expiresInSeconds
      : 3600;

  const patch: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  if (accessToken) {
    patch.google_access_token = accessToken;
    patch.google_token_expires_at = accessTokenExpiresAtIso(expiresIn);
  }
  if (nextRefresh) {
    patch.google_refresh_token = nextRefresh;
  }

  const { error: updateError } = await admin
    .from("teachers")
    .update(patch)
    .eq("id", teacher.id);

  if (updateError) {
    throw new GoogleDriveAuthError(
      `Failed to save Drive tokens: ${updateError.message}`,
    );
  }
}

async function loadTeacherGoogleTokens(
  teacherId: string,
): Promise<TeacherGoogleTokens | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("teachers")
    .select(
      "google_access_token, google_refresh_token, google_token_expires_at",
    )
    .eq("id", teacherId)
    .maybeSingle();

  if (error) {
    throw new GoogleDriveAuthError(
      `Failed to load Drive tokens: ${error.message}`,
    );
  }
  return data as TeacherGoogleTokens | null;
}

type GoogleTokenRefreshResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
};

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleTokenRefreshResponse> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = requireGoogleOAuthEnv();

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await response.json()) as GoogleTokenRefreshResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new GoogleDriveAuthError(
      json.error_description ||
        json.error ||
        `Google token refresh failed (${response.status})`,
    );
  }

  return json;
}

/**
 * Returns a usable Google access token for Drive API calls.
 * Refreshes and persists when the stored access token is missing/expired.
 */
export async function getUsableGoogleDriveAccessToken(
  teacherId: string,
): Promise<string> {
  const tokens = await loadTeacherGoogleTokens(teacherId);
  if (!tokens) {
    throw new GoogleDriveAuthError("Teacher not found for Drive access");
  }

  if (
    tokens.google_access_token &&
    isGoogleAccessTokenFresh(tokens.google_token_expires_at)
  ) {
    return tokens.google_access_token;
  }

  if (!tokens.google_refresh_token) {
    throw new GoogleDriveAuthError(
      "Google Drive is not connected. Sign out and sign in again, then allow Drive access.",
    );
  }

  const refreshed = await refreshGoogleAccessToken(tokens.google_refresh_token);
  const expiresIn =
    typeof refreshed.expires_in === "number" ? refreshed.expires_in : 3600;
  const expiresAt = accessTokenExpiresAtIso(expiresIn);

  const admin = createAdminSupabaseClient();
  const patch: Record<string, string> = {
    google_access_token: refreshed.access_token,
    google_token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  if (refreshed.refresh_token) {
    patch.google_refresh_token = refreshed.refresh_token;
  }

  const { error } = await admin
    .from("teachers")
    .update(patch)
    .eq("id", teacherId);

  if (error) {
    throw new GoogleDriveAuthError(
      `Failed to update refreshed Drive token: ${error.message}`,
    );
  }

  return refreshed.access_token;
}

/** True when the teacher has a refresh token (Drive consent completed at least once). */
export async function teacherHasGoogleDriveConnection(
  teacherId: string,
): Promise<boolean> {
  const tokens = await loadTeacherGoogleTokens(teacherId);
  return Boolean(tokens?.google_refresh_token || tokens?.google_access_token);
}
