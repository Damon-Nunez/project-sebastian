/**
 * Opaque error codes for /lessons redirects (mirror login allowlist pattern).
 * Never put free-form attacker-controlled or exception text in the URL.
 */

export const LESSON_ERROR_MESSAGES = {
  missing_file: "Choose a .docx or .pdf framework file to upload.",
  invalid_format: "Unsupported framework file type. Upload a .docx or .pdf.",
  empty_text: "No extractable text found in that file. Try another export.",
  upload_failed: "Upload failed. Please try again.",
  missing_lesson: "That lesson draft could not be found.",
  invalid_save: "Could not save — the form data was invalid.",
  save_failed: "Save failed. Please try again.",
} as const;

export type LessonErrorCode = keyof typeof LESSON_ERROR_MESSAGES;

export function lessonErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return (
    LESSON_ERROR_MESSAGES[code as LessonErrorCode] ??
    "Something went wrong. Please try again."
  );
}

export function isLessonErrorCode(code: string): code is LessonErrorCode {
  return Object.prototype.hasOwnProperty.call(LESSON_ERROR_MESSAGES, code);
}
