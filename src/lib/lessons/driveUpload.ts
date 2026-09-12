/**
 * Upload finished lesson .docx files to the teacher's Google Drive (SCRUM-87).
 * Ensures a top-level "Sebastian" folder exists (creates on first upload).
 */
import {
  getUsableGoogleDriveAccessToken,
  GoogleDriveAuthError,
} from "@/lib/auth/googleDrive";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const SEBASTIAN_DRIVE_FOLDER_NAME = "Sebastian";
export const GOOGLE_DRIVE_FOLDER_MIME =
  "application/vnd.google-apps.folder";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export class GoogleDriveUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDriveUploadError";
  }
}

/** Build multipart body for Drive uploadType=multipart (testable). */
export function buildDriveMultipartBody(input: {
  metadata: Record<string, unknown>;
  bytes: Buffer;
  mimeType: string;
  boundary: string;
}): Buffer {
  const metaPart =
    `--${input.boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(input.metadata)}\r\n`;
  const fileHeader =
    `--${input.boundary}\r\n` +
    `Content-Type: ${input.mimeType}\r\n\r\n`;
  const closing = `\r\n--${input.boundary}--`;

  return Buffer.concat([
    Buffer.from(metaPart, "utf8"),
    Buffer.from(fileHeader, "utf8"),
    input.bytes,
    Buffer.from(closing, "utf8"),
  ]);
}

async function driveJson<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: { message: text } };
    }
  }

  if (!response.ok) {
    const message =
      typeof json === "object" &&
      json &&
      "error" in json &&
      typeof (json as { error?: { message?: string } }).error?.message ===
        "string"
        ? (json as { error: { message: string } }).error.message
        : `Drive API ${response.status}`;
    throw new GoogleDriveUploadError(message);
  }

  return json as T;
}

async function getCachedSebastianFolderId(
  teacherId: string,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("teachers")
    .select("google_drive_folder_id")
    .eq("id", teacherId)
    .maybeSingle();

  if (error) {
    throw new GoogleDriveUploadError(
      `Failed to load Drive folder id: ${error.message}`,
    );
  }
  return data?.google_drive_folder_id?.trim() || null;
}

async function cacheSebastianFolderId(
  teacherId: string,
  folderId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("teachers")
    .update({
      google_drive_folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teacherId);

  if (error) {
    throw new GoogleDriveUploadError(
      `Failed to save Drive folder id: ${error.message}`,
    );
  }
}

async function folderExists(
  accessToken: string,
  folderId: string,
): Promise<boolean> {
  try {
    const meta = await driveJson<{ id: string; trashed?: boolean }>(
      accessToken,
      `${DRIVE_FILES_URL}/${encodeURIComponent(folderId)}?fields=id,trashed`,
    );
    return Boolean(meta.id) && meta.trashed !== true;
  } catch {
    return false;
  }
}

async function createSebastianFolder(accessToken: string): Promise<string> {
  const created = await driveJson<{ id: string }>(accessToken, DRIVE_FILES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: SEBASTIAN_DRIVE_FOLDER_NAME,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME,
    }),
  });

  if (!created.id) {
    throw new GoogleDriveUploadError("Drive did not return a folder id");
  }
  return created.id;
}

/**
 * Return the teacher's Sebastian folder id, creating + caching it if needed.
 */
export async function ensureSebastianDriveFolder(
  teacherId: string,
  accessToken: string,
): Promise<string> {
  const cached = await getCachedSebastianFolderId(teacherId);
  if (cached && (await folderExists(accessToken, cached))) {
    return cached;
  }

  const folderId = await createSebastianFolder(accessToken);
  await cacheSebastianFolderId(teacherId, folderId);
  return folderId;
}

export async function uploadDocxToDriveFolder(input: {
  accessToken: string;
  folderId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<string> {
  const boundary = `sebastian_${Date.now().toString(16)}`;
  const body = buildDriveMultipartBody({
    metadata: {
      name: input.filename,
      parents: [input.folderId],
    },
    bytes: input.bytes,
    mimeType: input.mimeType,
    boundary,
  });

  const created = await driveJson<{ id: string }>(
    input.accessToken,
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!created.id) {
    throw new GoogleDriveUploadError("Drive did not return a file id");
  }
  return created.id;
}

export type UploadLessonPlanToDriveResult = {
  driveFileId: string;
  folderId: string;
};

/**
 * Build is caller's job — this only places bytes in the Sebastian folder.
 */
export async function uploadLessonPlanDocxToDrive(input: {
  teacherId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<UploadLessonPlanToDriveResult> {
  let accessToken: string;
  try {
    accessToken = await getUsableGoogleDriveAccessToken(input.teacherId);
  } catch (error) {
    if (error instanceof GoogleDriveAuthError) {
      throw new GoogleDriveUploadError(error.message);
    }
    throw error;
  }

  const folderId = await ensureSebastianDriveFolder(
    input.teacherId,
    accessToken,
  );
  const driveFileId = await uploadDocxToDriveFolder({
    accessToken,
    folderId,
    filename: input.filename,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });

  return { driveFileId, folderId };
}
