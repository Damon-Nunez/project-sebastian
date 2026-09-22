import type { UnitRow } from "@/lib/db/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeRequiredName } from "@/lib/roster/validate";

const UNIT_SELECT =
  "id, teacher_id, label, sort_order, created_at, updated_at";

/** Next sort_order = max existing + 1 (or 0 when none). Pure helper for tests. */
export function nextSortOrder(existing: { sort_order: number }[]): number {
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((u) => u.sort_order)) + 1;
}

export async function listUnitsForTeacher(
  teacherId: string,
): Promise<UnitRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("units")
    .select(UNIT_SELECT)
    .eq("teacher_id", teacherId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list units: ${error.message}`);
  }

  return (data ?? []) as UnitRow[];
}

export async function getUnitForTeacher(
  teacherId: string,
  unitId: string,
): Promise<UnitRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("units")
    .select(UNIT_SELECT)
    .eq("teacher_id", teacherId)
    .eq("id", unitId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load unit: ${error.message}`);
  }

  return (data as UnitRow | null) ?? null;
}

export async function createUnit(input: {
  teacherId: string;
  label: string;
  sortOrder?: number | null;
}): Promise<UnitRow> {
  const label = normalizeRequiredName(input.label);
  if (!label) {
    throw new Error("Unit label is required");
  }

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  let sortOrder = input.sortOrder;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const existing = await listUnitsForTeacher(input.teacherId);
    sortOrder = nextSortOrder(existing);
  }

  const { data, error } = await admin
    .from("units")
    .insert({
      teacher_id: input.teacherId,
      label,
      sort_order: sortOrder,
      updated_at: now,
    })
    .select(UNIT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create unit: ${error.message}`);
  }

  return data as UnitRow;
}

export async function updateUnit(input: {
  teacherId: string;
  unitId: string;
  label: string;
  sortOrder: number;
}): Promise<UnitRow> {
  const label = normalizeRequiredName(input.label);
  if (!label) {
    throw new Error("Unit label is required");
  }

  if (!Number.isFinite(input.sortOrder)) {
    throw new Error("Sort order must be a number");
  }

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("units")
    .update({
      label,
      sort_order: Math.trunc(input.sortOrder),
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.unitId)
    .select(UNIT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update unit: ${error.message}`);
  }

  if (!data) {
    throw new Error("Unit not found");
  }

  return data as UnitRow;
}

export async function deleteUnit(input: {
  teacherId: string;
  unitId: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("units")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("id", input.unitId)
    .select("id")
    .maybeSingle();

  if (error) {
    // Essay rubrics reference units with ON DELETE RESTRICT.
    if (error.code === "23503") {
      throw new Error(
        "Cannot delete this unit while essay rubrics are still attached. Remove those rubrics first.",
      );
    }
    throw new Error(`Failed to delete unit: ${error.message}`);
  }

  if (!data) {
    throw new Error("Unit not found");
  }
}
