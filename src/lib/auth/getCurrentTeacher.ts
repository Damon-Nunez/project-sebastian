import type { TeacherRow } from "@/lib/db/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

export class TeacherAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeacherAuthError";
  }
}

const TEACHER_SELECT_WITH_NAME =
  "id, email, display_name, auth_user_id, api_key_encrypted, usage_tokens, created_at, updated_at";

const TEACHER_SELECT_BASE =
  "id, email, auth_user_id, api_key_encrypted, usage_tokens, created_at, updated_at";

function isMissingDisplayNameColumn(message: string): boolean {
  return (
    message.includes("display_name") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

/**
 * Resolve the signed-in Auth user → `teachers` row (domain PK).
 * Session via anon cookie client; row fetch via admin (RLS deny-by-default).
 * Tolerates missing `display_name` until migration 009 is applied.
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
  const primary = await admin
    .from("teachers")
    .select(TEACHER_SELECT_WITH_NAME)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    primary.error &&
    isMissingDisplayNameColumn(primary.error.message)
  ) {
    const fallback = await admin
      .from("teachers")
      .select(TEACHER_SELECT_BASE)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (fallback.error) {
      throw new TeacherAuthError(
        `Failed to load teacher profile: ${fallback.error.message}`,
      );
    }

    if (!fallback.data) {
      throw new TeacherAuthError("Teacher profile not found for this account");
    }

    return { ...(fallback.data as Omit<TeacherRow, "display_name">), display_name: null };
  }

  if (primary.error) {
    throw new TeacherAuthError(
      `Failed to load teacher profile: ${primary.error.message}`,
    );
  }

  if (!primary.data) {
    throw new TeacherAuthError("Teacher profile not found for this account");
  }

  return primary.data as TeacherRow;
}
