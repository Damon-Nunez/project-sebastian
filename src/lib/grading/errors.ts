export type GradingErrorCode =
  | "period_not_found"
  | "session_not_found"
  | "folder_path_required"
  | "rubric_missing"
  | "create_failed"
  | "missing_file"
  | "invalid_format"
  | "empty_text"
  | "file_too_large"
  | "upload_failed"
  | "document_not_found"
  | "student_required"
  | "student_not_found"
  | "assign_failed"
  | "save_failed"
  | "delete_failed"
  | "assignment_not_found"
  | "assignment_path_required"
  | "unit_required"
  | "reference_text_required"
  | "reference_too_long"
  | "reference_file_invalid"
  | "reference_file_empty"
  | "reference_failed";

const MESSAGES: Record<GradingErrorCode, string> = {
  period_not_found: "That period was not found.",
  session_not_found: "That assignment folder was not found.",
  folder_path_required:
    "Set Module, Unit, or Lesson (or a title) so this assignment has a folder path.",
  rubric_missing:
    "No matching rubric yet. Set up Daily work (or an essay rubric) under Rubrics first.",
  create_failed: "Could not create that assignment folder. Try again.",
  missing_file: "Choose a homework file (.docx, .pdf, or photo) to upload.",
  invalid_format:
    "Unsupported file type. Upload a .docx, .pdf, or photo (.jpg, .png, .heic).",
  empty_text: "That Word file has no text in it. Try another export.",
  file_too_large: "That file is too large (max 20MB).",
  upload_failed: "Upload failed. Please try again.",
  document_not_found: "That homework upload could not be found.",
  student_required: "Pick a class and student before confirming.",
  student_not_found: "That student was not found on your roster.",
  assign_failed: "Could not save that student match. Try again.",
  save_failed: "Could not save that homework into a folder. Try again.",
  delete_failed: "Could not delete that assignment. Try again.",
  assignment_not_found: "That assignment was not found.",
  assignment_path_required:
    "Set Module, Unit, or Lesson so every period can share this assignment.",
  unit_required: "Pick the unit for this essay so the right rubric applies.",
  reference_text_required:
    "Upload a file or paste the text — or choose “No answer key” to grade on the rubric only.",
  reference_too_long: "That reference is too long (max 50,000 characters).",
  reference_file_invalid:
    "Upload the answer key or example as a .docx or .pdf, or paste the text.",
  reference_file_empty:
    "No text found in that file. Paste the answer key text instead.",
  reference_failed: "Could not save the answer key. Try again.",
};

export function gradingErrorMessage(
  code: string | undefined,
): string | null {
  if (!code) return null;
  return MESSAGES[code as GradingErrorCode] ?? "Something went wrong.";
}

export function gradingErrorRedirect(
  path: string,
  code: GradingErrorCode,
): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}error=${code}`;
}
