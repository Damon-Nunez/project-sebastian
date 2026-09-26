import { describe, expect, it } from "vitest";
import {
  MAX_REFERENCE_CHARS,
  normalizeReferenceText,
  parseReferenceKind,
  referenceKindLabel,
  validateReferenceText,
} from "./reference";

describe("parseReferenceKind", () => {
  it("accepts the three kinds", () => {
    expect(parseReferenceKind("answer_key")).toBe("answer_key");
    expect(parseReferenceKind("exemplar")).toBe("exemplar");
    expect(parseReferenceKind("none")).toBe("none");
  });

  it("rejects anything else", () => {
    expect(parseReferenceKind("key")).toBeNull();
    expect(parseReferenceKind("")).toBeNull();
    expect(parseReferenceKind(undefined)).toBeNull();
  });
});

describe("referenceKindLabel", () => {
  it("uses teacher-facing wording", () => {
    expect(referenceKindLabel("answer_key")).toBe("Answer key");
    expect(referenceKindLabel("exemplar")).toBe("Example");
    expect(referenceKindLabel("none")).toBe(
      "No answer key — graded on rubric only",
    );
  });
});

describe("normalizeReferenceText", () => {
  it("normalizes newlines and trims", () => {
    expect(normalizeReferenceText("\r\n1. B\r\n\r\n\r\n\r\n2. D  \n")).toBe(
      "1. B\n\n2. D",
    );
  });
});

describe("validateReferenceText", () => {
  it("clears text for none", () => {
    expect(validateReferenceText("none", "leftover key")).toEqual({
      ok: true,
      text: null,
    });
  });

  it("requires text for an answer key or example", () => {
    expect(validateReferenceText("answer_key", "   ")).toEqual({
      ok: false,
      code: "reference_text_required",
    });
    expect(validateReferenceText("exemplar", null)).toEqual({
      ok: false,
      code: "reference_text_required",
    });
  });

  it("returns normalized text when valid", () => {
    expect(validateReferenceText("answer_key", " 1. B\r\n2. D ")).toEqual({
      ok: true,
      text: "1. B\n2. D",
    });
  });

  it("rejects oversized references", () => {
    expect(
      validateReferenceText("exemplar", "x".repeat(MAX_REFERENCE_CHARS + 1)),
    ).toEqual({ ok: false, code: "reference_too_long" });
  });
});
