import { describe, expect, it } from "vitest";
import {
  accessTokenExpiresAtIso,
  isGoogleAccessTokenFresh,
} from "./googleDrive";
import { GOOGLE_DRIVE_FILE_SCOPE } from "./googleDriveScopes";

describe("GOOGLE_DRIVE_FILE_SCOPE", () => {
  it("uses the narrow drive.file scope", () => {
    expect(GOOGLE_DRIVE_FILE_SCOPE).toBe(
      "https://www.googleapis.com/auth/drive.file",
    );
  });
});

describe("isGoogleAccessTokenFresh", () => {
  const now = Date.parse("2026-09-12T18:00:00.000Z");

  it("is false when expiry is missing or invalid", () => {
    expect(isGoogleAccessTokenFresh(null, now)).toBe(false);
    expect(isGoogleAccessTokenFresh(undefined, now)).toBe(false);
    expect(isGoogleAccessTokenFresh("not-a-date", now)).toBe(false);
  });

  it("is false when within the skew window or already expired", () => {
    expect(
      isGoogleAccessTokenFresh("2026-09-12T18:00:30.000Z", now, 60_000),
    ).toBe(false);
    expect(
      isGoogleAccessTokenFresh("2026-09-12T17:59:00.000Z", now, 60_000),
    ).toBe(false);
  });

  it("is true when expiry is comfortably in the future", () => {
    expect(
      isGoogleAccessTokenFresh("2026-09-12T19:00:00.000Z", now, 60_000),
    ).toBe(true);
  });
});

describe("accessTokenExpiresAtIso", () => {
  it("adds expires_in seconds to now", () => {
    const now = new Date("2026-09-12T18:00:00.000Z");
    expect(accessTokenExpiresAtIso(3600, now)).toBe(
      "2026-09-12T19:00:00.000Z",
    );
  });
});
