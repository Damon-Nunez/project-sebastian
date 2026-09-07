import type { User } from "@supabase/supabase-js";
import { displayNameFromAuthUser } from "@/lib/auth/displayName";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function isMissingDisplayNameColumn(message: string): boolean {
  return (
    message.includes("display_name") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

/**
 * Upsert the teachers row for the signed-in Google user.
 * Uses the admin client so RLS (when added later) cannot block first login.
 * Refreshes display_name from OAuth metadata when column exists (migration 009).
 */
export async function syncTeacherFromAuthUser(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Signed-in user has no email address");
  }

  const displayName = displayNameFromAuthUser(user);
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  async function updateById(id: string, withDisplayName: boolean) {
    const patch = withDisplayName
      ? { email, display_name: displayName, updated_at: now }
      : { email, updated_at: now };

    const selectCols = withDisplayName
      ? "id, email, auth_user_id, display_name"
      : "id, email, auth_user_id";

    return supabase
      .from("teachers")
      .update(patch)
      .eq("id", id)
      .select(selectCols)
      .single();
  }

  async function linkById(id: string, withDisplayName: boolean) {
    const patch = withDisplayName
      ? {
          email,
          display_name: displayName,
          auth_user_id: user.id,
          updated_at: now,
        }
      : { email, auth_user_id: user.id, updated_at: now };

    const selectCols = withDisplayName
      ? "id, email, auth_user_id, display_name"
      : "id, email, auth_user_id";

    return supabase
      .from("teachers")
      .update(patch)
      .eq("id", id)
      .select(selectCols)
      .single();
  }

  async function insertRow(withDisplayName: boolean) {
    const selectCols = withDisplayName
      ? "id, email, auth_user_id, display_name"
      : "id, email, auth_user_id";

    if (withDisplayName) {
      return supabase
        .from("teachers")
        .insert({
          auth_user_id: user.id,
          email,
          display_name: displayName,
          updated_at: now,
        })
        .select(selectCols)
        .single();
    }

    return supabase
      .from("teachers")
      .insert({
        auth_user_id: user.id,
        email,
        updated_at: now,
      })
      .select(selectCols)
      .single();
  }

  const { data: byAuth, error: byAuthError } = await supabase
    .from("teachers")
    .select("id, email, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuthError) {
    throw new Error(`Failed to look up teacher: ${byAuthError.message}`);
  }

  if (byAuth) {
    let result = await updateById(byAuth.id, true);
    if (result.error && isMissingDisplayNameColumn(result.error.message)) {
      result = await updateById(byAuth.id, false);
    }
    if (result.error) {
      throw new Error(`Failed to update teacher row: ${result.error.message}`);
    }
    return result.data;
  }

  const { data: byEmail, error: byEmailError } = await supabase
    .from("teachers")
    .select("id, email, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (byEmailError) {
    throw new Error(`Failed to look up teacher by email: ${byEmailError.message}`);
  }

  if (byEmail) {
    let result = await linkById(byEmail.id, true);
    if (result.error && isMissingDisplayNameColumn(result.error.message)) {
      result = await linkById(byEmail.id, false);
    }
    if (result.error) {
      throw new Error(`Failed to link teacher auth id: ${result.error.message}`);
    }
    return result.data;
  }

  let inserted = await insertRow(true);
  if (inserted.error && isMissingDisplayNameColumn(inserted.error.message)) {
    inserted = await insertRow(false);
  }
  if (inserted.error) {
    throw new Error(`Failed to create teacher row: ${inserted.error.message}`);
  }

  return inserted.data;
}
