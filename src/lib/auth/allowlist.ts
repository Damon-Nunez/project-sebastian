/**
 * Allowlist entries are either:
 * - a full email: "teacher@school.org"
 * - a domain (with or without leading @): "@school.org" or "school.org"
 */
export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(
  email: string,
  allowlist: string[],
): boolean {
  if (allowlist.length === 0) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return false;
  }

  const domain = normalized.slice(at + 1);

  return allowlist.some((entry) => {
    if (entry.includes("@") && !entry.startsWith("@")) {
      return entry === normalized;
    }

    const allowedDomain = entry.startsWith("@") ? entry.slice(1) : entry;
    return allowedDomain === domain;
  });
}
