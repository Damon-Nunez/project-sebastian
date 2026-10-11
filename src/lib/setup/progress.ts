/**
 * First-login checklist rules (Ticket 12 / SCRUM-135).
 * Finished is an explicit timestamp, not "the data still looks complete".
 */

export type SetupSnapshot = {
  displayName: string | null;
  honorific: string | null;
  subject: string | null;
  gradeLabel: string | null;
  studentCount: number;
  dailyRubricComplete: boolean;
  setupCompletedAt: string | null;
};

export type SetupEvaluation = {
  profileReady: boolean;
  rosterReady: boolean;
  rubricReady: boolean;
  minimumMet: boolean;
  finished: boolean;
};

const SETUP_WORK_PREFIXES = ["/setup", "/periods", "/rubrics", "/units"];

function filled(value: string | null): boolean {
  return (value ?? "").trim().length > 0;
}

export function evaluateSetup(snapshot: SetupSnapshot): SetupEvaluation {
  const profileReady =
    filled(snapshot.displayName) &&
    filled(snapshot.honorific) &&
    filled(snapshot.subject) &&
    filled(snapshot.gradeLabel);
  const rosterReady = snapshot.studentCount > 0;
  const rubricReady = snapshot.dailyRubricComplete;
  return {
    profileReady,
    rosterReady,
    rubricReady,
    minimumMet: profileReady && rosterReady && rubricReady,
    finished: snapshot.setupCompletedAt != null,
  };
}

/** Pages an unfinished teacher may open while the checklist is still open. */
export function isSetupWorkPath(pathname: string): boolean {
  return SETUP_WORK_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
