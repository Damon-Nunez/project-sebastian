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
  delete_failed: "Could not delete that draft. Please try again.",
  missing_image: "Choose an image file (PNG, JPEG, WebP, or GIF).",
  invalid_image: "Unsupported image type. Use PNG, JPEG, WebP, or GIF.",
  image_too_large: "Image is too large (max 5MB).",
  invalid_image_section: "Pick a section for the image.",
  image_upload_failed: "Image upload failed. Please try again.",
  image_remove_failed: "Could not remove that image. Please try again.",
  worksheet_upload_failed: "Worksheet upload failed. Please try again.",
  worksheet_remove_failed: "Could not remove that worksheet. Please try again.",
  missing_link: "Paste a video or resource URL.",
  invalid_link: "That doesn’t look like a valid http(s) URL.",
  invalid_link_section: "Pick a section for the link.",
  link_add_failed: "Could not add that link. Please try again.",
  link_remove_failed: "Could not remove that link. Please try again.",
  polish_failed: "AI polish failed. Check your draft and try again.",
  polish_unavailable: "AI polish needs ANTHROPIC_API_KEY configured.",
  finalize_failed: "Could not mark this plan as finished. Please try again.",
  reopen_failed: "Could not move this plan back to drafts. Please try again.",
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
