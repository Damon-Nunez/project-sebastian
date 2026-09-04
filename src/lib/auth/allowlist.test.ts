import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("splits and normalizes comma-separated entries", () => {
    expect(parseAllowlist(" Mom@School.ORG , @district.org ")).toEqual([
      "mom@school.org",
      "@district.org",
    ]);
  });

  it("returns empty for missing input", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
  });
});

describe("isEmailAllowed", () => {
  it("matches exact emails", () => {
    const list = parseAllowlist("teacher@school.org");
    expect(isEmailAllowed("teacher@school.org", list)).toBe(true);
    expect(isEmailAllowed("other@school.org", list)).toBe(false);
  });

  it("matches domains with or without leading @", () => {
    expect(isEmailAllowed("a@school.org", parseAllowlist("@school.org"))).toBe(
      true,
    );
    expect(isEmailAllowed("a@school.org", parseAllowlist("school.org"))).toBe(
      true,
    );
    expect(isEmailAllowed("a@other.org", parseAllowlist("@school.org"))).toBe(
      false,
    );
  });

  it("supports mixed email + domain allowlist", () => {
    const list = parseAllowlist("boss@gmail.com,@school.org");
    expect(isEmailAllowed("boss@gmail.com", list)).toBe(true);
    expect(isEmailAllowed("aide@school.org", list)).toBe(true);
    expect(isEmailAllowed("random@gmail.com", list)).toBe(false);
  });

  it("rejects empty allowlist and invalid emails", () => {
    expect(isEmailAllowed("teacher@school.org", [])).toBe(false);
    expect(isEmailAllowed("not-an-email", parseAllowlist("@school.org"))).toBe(
      false,
    );
  });
});
