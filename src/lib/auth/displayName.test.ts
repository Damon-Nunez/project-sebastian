import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  displayNameFromAuthUser,
  displayNameToKeep,
  initialsFromDisplayName,
} from "./displayName";

function fakeUser(meta: Record<string, unknown>): User {
  return { user_metadata: meta } as User;
}

describe("displayNameFromAuthUser", () => {
  it("prefers full_name then name", () => {
    expect(
      displayNameFromAuthUser(
        fakeUser({ full_name: "Mr Nunez", name: "Other" }),
      ),
    ).toBe("Mr Nunez");
    expect(displayNameFromAuthUser(fakeUser({ name: "Damon" }))).toBe("Damon");
  });

  it("returns null when missing", () => {
    expect(displayNameFromAuthUser(fakeUser({}))).toBeNull();
  });
});

describe("displayNameToKeep", () => {
  it("keeps a confirmed name and fills from Google only when blank", () => {
    expect(displayNameToKeep("Ada George", "Ada G")).toBe("Ada George");
    expect(displayNameToKeep("  ", "Ada George")).toBe("Ada George");
    expect(displayNameToKeep(null, null)).toBeNull();
  });
});

describe("initialsFromDisplayName", () => {
  it("uses first and last word", () => {
    expect(initialsFromDisplayName("Mr Nunez")).toBe("MN");
    expect(initialsFromDisplayName("Maria Elena Garcia")).toBe("MG");
  });

  it("uses two letters for a single word", () => {
    expect(initialsFromDisplayName("Damon")).toBe("DA");
  });

  it("falls back to email local-part", () => {
    expect(initialsFromDisplayName(null, "teacher@school.org")).toBe("TE");
  });
});
