import type { User } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Upsert the teachers row for the signed-in Google user.
 * Uses the admin client so RLS (when added later) cannot block first login.
 */
export async function syncTeacherFromAuthUser(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Signed-in user has no email address");
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

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
      .update({ email, updated_at: now })
      .eq("id", byAuth.id)
      .select("id, email, auth_user_id")
      .single();

    if (error) {
      throw new Error(`Failed to update teacher row: ${error.message}`);
    }
    return data;
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
    const { data, error } = await supabase
      .from("teachers")
      .update({ auth_user_id: user.id, updated_at: now })
      .eq("id", byEmail.id)
      .select("id, email, auth_user_id")
      .single();

    if (error) {
      throw new Error(`Failed to link teacher auth id: ${error.message}`);
    }
    return data;
  }

  const { data, error } = await supabase
    .from("teachers")
    .insert({
      auth_user_id: user.id,
      email,
      updated_at: now,
    })
    .select("id, email, auth_user_id")
    .single();

  if (error) {
    throw new Error(`Failed to create teacher row: ${error.message}`);
  }

  return data;
}
