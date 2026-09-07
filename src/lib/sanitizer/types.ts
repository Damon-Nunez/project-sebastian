/** Roster row input for redaction (matches students.id + students.name). */
export type RosterStudent = {
  id: string;
  name: string;
};

/**
 * One student ↔ placeholder.
 * `name` is what rehydrate puts back; `aliases` are the strings redact searches for.
 */
export type NameTokenEntry = {
  studentId: string;
  name: string;
  token: string;
  /** Name forms to find in text (full name + V1 unique first/last). */
  aliases: string[];
};

/**
 * Map used to redact before an AI call and rehydrate for display.
 * Built once per call from the active roster; do not send off-box.
 */
export type NameTokenMap = {
  entries: NameTokenEntry[];
};

/** Local document → student identity (no AI). */
export type StudentMatchStatus = "matched" | "none" | "ambiguous";

export type StudentMatchResult =
  | { status: "matched"; student: RosterStudent }
  | { status: "none" }
  | { status: "ambiguous"; candidates: RosterStudent[] };
