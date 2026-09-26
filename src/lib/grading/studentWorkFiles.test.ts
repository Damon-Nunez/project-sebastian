import { describe, expect, it } from "vitest";
import {
  buildStudentWorkStoragePath,
  detectHomeworkFormat,
  isImageFormat,
  jpegPathFor,
  needsVisionForText,
  parseTeacherStoragePath,
} from "./studentWorkFiles";

const TEACHER = "11111111-2222-3333-4444-555555555555";
const OTHER_TEACHER = "99999999-2222-3333-4444-555555555555";
const FILE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("detectHomeworkFormat", () => {
  it.each([
    ["Maria M1U1L3.docx", "docx"],
    ["scan.PDF", "pdf"],
    ["IMG_1234.JPG", "jpeg"],
    ["photo.jpeg", "jpeg"],
    ["page.png", "png"],
    ["IMG_5678.HEIC", "heic"],
    ["IMG_5678.heif", "heic"],
  ])("%s → %s", (filename, format) => {
    expect(detectHomeworkFormat(filename)).toBe(format);
  });

  it.each(["notes.txt", "essay.doc", "archive.zip", "noextension", "", null])(
    "rejects %s",
    (filename) => {
      expect(detectHomeworkFormat(filename)).toBeNull();
    },
  );
});

describe("isImageFormat", () => {
  it("treats photos as images and documents as not", () => {
    expect(isImageFormat("jpeg")).toBe(true);
    expect(isImageFormat("png")).toBe(true);
    expect(isImageFormat("heic")).toBe(true);
    expect(isImageFormat("docx")).toBe(false);
    expect(isImageFormat("pdf")).toBe(false);
  });
});

describe("storage paths", () => {
  it("builds teacher-scoped paths with a normalized extension", () => {
    expect(
      buildStudentWorkStoragePath({ teacherId: TEACHER, fileId: FILE, format: "jpeg" }),
    ).toBe(`${TEACHER}/${FILE}.jpg`);
    expect(
      buildStudentWorkStoragePath({ teacherId: TEACHER, fileId: FILE, format: "heic" }),
    ).toBe(`${TEACHER}/${FILE}.heic`);
  });

  it("maps any photo path to its stored JPEG path", () => {
    expect(jpegPathFor(`${TEACHER}/${FILE}.heic`)).toBe(`${TEACHER}/${FILE}.jpg`);
    expect(jpegPathFor(`${TEACHER}/${FILE}.png`)).toBe(`${TEACHER}/${FILE}.jpg`);
    expect(jpegPathFor(`${TEACHER}/${FILE}.jpg`)).toBe(`${TEACHER}/${FILE}.jpg`);
  });

  it("accepts only paths signed for this teacher", () => {
    expect(parseTeacherStoragePath(TEACHER, `${TEACHER}/${FILE}.pdf`)).toBe("pdf");
    expect(parseTeacherStoragePath(TEACHER, `${OTHER_TEACHER}/${FILE}.pdf`)).toBeNull();
    expect(parseTeacherStoragePath(TEACHER, `${TEACHER}/../${FILE}.pdf`)).toBeNull();
    expect(parseTeacherStoragePath(TEACHER, `${TEACHER}/${FILE}.exe`)).toBeNull();
    expect(parseTeacherStoragePath(TEACHER, `${TEACHER}/sub/${FILE}.pdf`)).toBeNull();
    expect(parseTeacherStoragePath(TEACHER, "")).toBeNull();
  });
});

describe("needsVisionForText", () => {
  it("flags empty or whitespace-only text", () => {
    expect(needsVisionForText("")).toBe(true);
    expect(needsVisionForText(null)).toBe(true);
    expect(needsVisionForText("   \n\t  ")).toBe(true);
  });

  it("flags sparse text like a scanner header", () => {
    expect(needsVisionForText("Scanned with CamScanner")).toBe(true);
  });

  it("keeps real typed answers on the text path", () => {
    expect(
      needsVisionForText(
        "1. The narrator feels isolated because her family moved away from Mexico.",
      ),
    ).toBe(false);
  });
});
