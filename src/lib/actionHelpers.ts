/**
 * Shared helpers for Next.js Server Action form handlers.
 */

/** Safely read a string field from FormData. Returns "" when missing. */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
