import { describe, expect, it } from "vitest";
import {
  normalizeOptionalText,
  normalizeRequiredName,
} from "./validate";

describe("normalizeRequiredName", () => {
  it("trims and accepts non-empty names", () => {
    expect(normalizeRequiredName("  Maria Garcia  ")).toBe("Maria Garcia");
    expect(normalizeRequiredName("Period 1")).toBe("Period 1");
  });

  it("rejects blank input", () => {
    expect(normalizeRequiredName("")).toBeNull();
    expect(normalizeRequiredName("   ")).toBeNull();
    expect(normalizeRequiredName(null)).toBeNull();
    expect(normalizeRequiredName(undefined)).toBeNull();
  });
});

describe("normalizeOptionalText", () => {
  it("keeps trimmed text", () => {
    expect(normalizeOptionalText("  IEP seating  ")).toBe("IEP seating");
    expect(normalizeOptionalText("2025-26")).toBe("2025-26");
  });

  it("turns blank into null", () => {
    expect(normalizeOptionalText("")).toBeNull();
    expect(normalizeOptionalText("   ")).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
    expect(normalizeOptionalText(undefined)).toBeNull();
  });
});
