/**
 * Teacher authentication and sync helpers.
 * Merged from getCurrentTeacher.ts + syncTeacher.ts.
 */
import type { User } from "@supabase/supabase-js";
import type { TeacherRow } from "@/lib/db/types";
import { displayNameFromAuthUser } from "@/lib/auth/displayName";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

export class TeacherAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeacherAuthError";
  }
}

const TEACHER_SELECT =
  "id, email, display_name, auth_user_id, api_key_encrypted, usage_tokens, created_at, updated_at";

/**
 * Resolve the signed-in Auth user → `teachers` row (domain PK).
 * Session via anon cookie client; row fetch via admin (RLS deny-by-default).
 */
export async function getCurrentTeacher(): Promise<TeacherRow> {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser();

  if (userError || !user) {
    throw new TeacherAuthError("Not signed in");
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new TeacherAuthError(
      `Failed to load teacher profile: ${error.message}`,
    );
  }

  if (!data) {
    throw new TeacherAuthError("Teacher profile not found for this account");
  }

  return data as TeacherRow;
}

/**
 * Upsert the teachers row for the signed-in Google user.
 * Uses the admin client so RLS (when added later) cannot block first login.
 * Refreshes display_name from OAuth metadata (migration 009).
 */
export async function syncTeacherFromAuthUser(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Signed-in user has no email address");
  }

  const displayName = displayNameFromAuthUser(user);
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  // Try matching by auth_user_id first (returning user).
  const { data: byAuth, error: byAuthError } = await supabase
    .from("teachers")
    .select("id, email, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuthError) {
    throw new Error(`Failed to look up teacher: ${byAuthError.message}`);
  }

  if (byAuth) {
    const { data, error } = await supabase
      .from("teachers")
      .update({ email, display_name: displayName, updated_at: now })
      .eq("id", byAuth.id)
      .select("id, email, auth_user_id, display_name")
      .single();
    if (error) throw new Error(`Failed to update teacher row: ${error.message}`);
    return data;
  }

  // Try matching by email (pre-linked row or email change).
  const { data: byEmail, error: byEmailError } = await supabase
    .from("teachers")
    .select("id, email, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (byEmailError) {
    throw new Error(`Failed to look up teacher by email: ${byEmailError.message}`);
  }

  if (byEmail) {
    const { data, error } = await supabase
      .from("teachers")
      .update({ email, display_name: displayName, auth_user_id: user.id, updated_at: now })
      .eq("id", byEmail.id)
      .select("id, email, auth_user_id, display_name")
      .single();
    if (error) throw new Error(`Failed to link teacher auth id: ${error.message}`);
    return data;
  }

  // New teacher — insert.
  const { data, error } = await supabase
    .from("teachers")
    .insert({ auth_user_id: user.id, email, display_name: displayName, updated_at: now })
    .select("id, email, auth_user_id, display_name")
    .single();
  if (error) throw new Error(`Failed to create teacher row: ${error.message}`);
  return data;
}
