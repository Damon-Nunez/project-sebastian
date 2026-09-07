import { describe, expect, it } from "vitest";
import {
  aliasesForRoster,
  assertSanitizedForAi,
  buildNameTokenMap,
  matchStudentFromDocument,
  prepareTextForAi,
  redact,
  rehydrate,
  rehydratePreparedAiText,
  sanitizeForAi,
  SanitizerVerificationError,
  tokenForStudentId,
} from "./index";
import type { RosterStudent } from "./types";

const maria: RosterStudent = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Maria Garcia",
};
const jordan: RosterStudent = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Jordan Lee",
};
const ann: RosterStudent = {
  id: "33333333-3333-3333-3333-333333333333",
  name: "Ann",
};
const anna: RosterStudent = {
  id: "44444444-4444-4444-4444-444444444444",
  name: "Anna Smith",
};

describe("tokenForStudentId", () => {
  it("builds a stable placeholder from the student row id", () => {
    expect(tokenForStudentId(maria.id)).toBe(`[[STU_${maria.id}]]`);
  });
});

describe("buildNameTokenMap", () => {
  it("skips blank names and trims whitespace", () => {
    const map = buildNameTokenMap([
      { id: "a", name: "  Sam  Park  " },
      { id: "b", name: "   " },
      { id: "", name: "Nope" },
    ]);
    expect(map.entries).toEqual([
      {
        studentId: "a",
        name: "Sam Park",
        token: "[[STU_a]]",
        aliases: expect.arrayContaining(["Sam Park", "Sam", "Park"]),
      },
    ]);
  });

  it("sorts entries by student id for determinism", () => {
    const map = buildNameTokenMap([jordan, maria]);
    expect(map.entries.map((e) => e.studentId)).toEqual([maria.id, jordan.id]);
  });
});

describe("V1 aliases (identifiers that feed the map)", () => {
  it("adds unique first/last and Last/First order variants", () => {
    const aliases = aliasesForRoster([maria, jordan]);
    expect(aliases.get(maria.id)).toEqual(
      expect.arrayContaining([
        "Maria Garcia",
        "Garcia Maria",
        "Garcia, Maria",
        "Maria",
        "Garcia",
      ]),
    );
    expect(aliases.get(jordan.id)).toEqual(
      expect.arrayContaining([
        "Jordan Lee",
        "Lee Jordan",
        "Lee, Jordan",
        "Jordan",
        "Lee",
      ]),
    );
  });

  it("does not redact a shared first name when two students share it", () => {
    const mariaLopez: RosterStudent = {
      id: "55555555-5555-5555-5555-555555555555",
      name: "Maria Lopez",
    };
    const map = buildNameTokenMap([maria, mariaLopez]);
    const out = redact("Maria turned it in early.", map);
    // Bare "Maria" is ambiguous — leave it. Full names still redact.
    expect(out).toBe("Maria turned it in early.");
    expect(redact("Maria Garcia and Maria Lopez.", map)).toBe(
      `${tokenForStudentId(maria.id)} and ${tokenForStudentId(mariaLopez.id)}.`,
    );
  });

  it("does not invent nicknames not on the roster", () => {
    const map = buildNameTokenMap([maria]);
    expect(redact("MJ submitted the draft.", map)).toBe("MJ submitted the draft.");
  });

  it("redacts a teacher-entered nickname when present on the roster", () => {
    const withNick: RosterStudent = {
      ...maria,
      nickname: "MJ",
    };
    const map = buildNameTokenMap([withNick]);
    expect(redact("MJ submitted the draft.", map)).toBe(
      `${tokenForStudentId(maria.id)} submitted the draft.`,
    );
  });

  it("does not redact a nickname that duplicates another nickname", () => {
    const a: RosterStudent = {
      id: "a",
      name: "Maria Garcia",
      nickname: "MJ",
    };
    const b: RosterStudent = {
      id: "b",
      name: "Jordan Lee",
      nickname: "MJ",
    };
    const map = buildNameTokenMap([a, b]);
    expect(redact("MJ turned it in.", map)).toBe("MJ turned it in.");
  });

  it("does not redact a nickname that collides with another student's first name", () => {
    const jordan: RosterStudent = {
      id: "stu-jordan",
      name: "Jordan Lee",
    };
    const other: RosterStudent = {
      id: "stu-other",
      name: "Sam Rivera",
      nickname: "Jordan",
    };
    const map = buildNameTokenMap([jordan, other]);
    // Unique first "Jordan" still redacts to Jordan Lee; nickname alias skipped.
    expect(redact("Jordan turned it in.", map)).toBe(
      `${tokenForStudentId(jordan.id)} turned it in.`,
    );
  });

  it("redacts multi-part names including middle names", () => {
    const longName: RosterStudent = {
      id: "stu-long",
      name: "Maria Elena Garcia",
    };
    const map = buildNameTokenMap([longName]);
    expect(redact("Work by Maria Elena Garcia.", map)).toBe(
      `Work by ${tokenForStudentId(longName.id)}.`,
    );
    expect(redact("Header: Garcia, Maria Elena", map)).toBe(
      `Header: ${tokenForStudentId(longName.id)}`,
    );
  });

  it("redacts LMS Last, First header forms", () => {
    const map = buildNameTokenMap([maria]);
    expect(redact("Student: Garcia, Maria", map)).toBe(
      `Student: ${tokenForStudentId(maria.id)}`,
    );
    expect(redact("Student: Garcia Maria", map)).toBe(
      `Student: ${tokenForStudentId(maria.id)}`,
    );
  });
});

describe("redact", () => {
  it("replaces full roster names with tokens (case-insensitive)", () => {
    const map = buildNameTokenMap([maria, jordan]);
    const out = redact(
      "Feedback for maria garcia and JORDAN LEE looks strong.",
      map,
    );
    expect(out).toBe(
      `Feedback for ${tokenForStudentId(maria.id)} and ${tokenForStudentId(jordan.id)} looks strong.`,
    );
    expect(out.toLowerCase()).not.toContain("maria");
    expect(out.toLowerCase()).not.toContain("jordan");
  });

  it("replaces longer names before shorter overlapping ones", () => {
    const map = buildNameTokenMap([ann, anna]);
    const out = redact("Anna Smith sat with Ann.", map);
    expect(out).toBe(
      `${tokenForStudentId(anna.id)} sat with ${tokenForStudentId(ann.id)}.`,
    );
  });

  it("does not redact a name that is only a substring of another word", () => {
    const map = buildNameTokenMap([ann]);
    expect(redact("Anniversary party for Ann.", map)).toBe(
      `Anniversary party for ${tokenForStudentId(ann.id)}.`,
    );
  });

  it("uses the first student id when two roster rows share a display name", () => {
    const twinA: RosterStudent = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Alex Kim",
    };
    const twinB: RosterStudent = {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "Alex Kim",
    };
    const map = buildNameTokenMap([twinB, twinA]);
    const out = redact("Alex Kim turned it in.", map);
    expect(out).toBe(`${tokenForStudentId(twinA.id)} turned it in.`);
  });

  it("redacts a unique first name used alone", () => {
    const map = buildNameTokenMap([maria, jordan]);
    expect(redact("Nice work, Maria.", map)).toBe(
      `Nice work, ${tokenForStudentId(maria.id)}.`,
    );
  });

  it("redacts names separated by NBSP or extra spaces", () => {
    const map = buildNameTokenMap([maria]);
    expect(redact(`Nice work, Maria\u00A0Garcia.`, map)).toBe(
      `Nice work, ${tokenForStudentId(maria.id)}.`,
    );
    expect(redact("Nice work, Maria  Garcia.", map)).toBe(
      `Nice work, ${tokenForStudentId(maria.id)}.`,
    );
  });
});

describe("rehydrate", () => {
  it("round-trips redact → rehydrate for teacher display", () => {
    const map = buildNameTokenMap([maria, jordan]);
    const original =
      "Maria Garcia peer-reviewed Jordan Lee; Maria Garcia revised once.";
    const redacted = redact(original, map);
    expect(rehydrate(redacted, map)).toBe(original);
  });
});

describe("sanitizeForAi / prepareTextForAi", () => {
  it("builds the map and redacts in one step", () => {
    const { text, map } = sanitizeForAi("See Maria Garcia.", [maria]);
    expect(text).toBe(`See ${tokenForStudentId(maria.id)}.`);
    expect(map.entries).toHaveLength(1);
    expect(rehydrate(text, map)).toBe("See Maria Garcia.");
  });

  it("mandatory helper returns sanitizedText + map for the AI seam", () => {
    const prepared = prepareTextForAi(
      "Grade Jordan Lee's short response.",
      [jordan],
    );
    expect(prepared.sanitizedText).toBe(
      `Grade ${tokenForStudentId(jordan.id)}'s short response.`,
    );
    expect(rehydratePreparedAiText(prepared.sanitizedText, prepared.map)).toBe(
      "Grade Jordan Lee's short response.",
    );
  });

  it("fail-closed: throws if roster aliases remain after a bad handoff", () => {
    const map = buildNameTokenMap([maria]);
    expect(() =>
      assertSanitizedForAi("Still says Maria Garcia out loud.", map),
    ).toThrow(SanitizerVerificationError);
  });
});

describe("matchStudentFromDocument", () => {
  const roster = [maria, jordan, anna];

  it("matches a unique student from a filename", () => {
    const result = matchStudentFromDocument(roster, {
      filename: "Garcia_Maria_essay.pdf",
    });
    expect(result).toEqual({ status: "matched", student: maria });
  });

  it("matches from header text", () => {
    const result = matchStudentFromDocument(roster, {
      headerText: "Student: Jordan Lee\nPeriod 2",
    });
    expect(result).toEqual({ status: "matched", student: jordan });
  });

  it("returns none when no roster name appears", () => {
    expect(
      matchStudentFromDocument(roster, { filename: "period2_hw.docx" }),
    ).toEqual({ status: "none" });
  });

  it("returns ambiguous when two students hit the haystack", () => {
    const result = matchStudentFromDocument(roster, {
      filename: "Maria_Garcia_and_Jordan_Lee_peer_review.pdf",
    });
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.id).sort()).toEqual(
        [maria.id, jordan.id].sort(),
      );
    }
  });

  it("does not match a nickname that is not on the roster", () => {
    expect(
      matchStudentFromDocument(roster, { filename: "MJ_essay.pdf" }),
    ).toEqual({ status: "none" });
  });

  it("does not substring-match short names inside longer words", () => {
    expect(
      matchStudentFromDocument([ann], { filename: "Anna_Smith_essay.pdf" }),
    ).toEqual({ status: "none" });

    expect(
      matchStudentFromDocument([jordan], {
        filename: "sleeping_homework.pdf",
      }),
    ).toEqual({ status: "none" });
  });
});

describe("realistic fake-name classroom batch", () => {
  const roster: RosterStudent[] = [
    { id: "s01", name: "Aaliyah Thompson" },
    { id: "s02", name: "Noah Kim" },
    { id: "s03", name: "Sofia Reyes" },
    { id: "s04", name: "Liam O'Brien" },
    { id: "s05", name: "Emma Nguyen" },
  ];

  it("sanitizes a grading prompt that names several students", () => {
    const prompt = [
      "Class feedback draft:",
      "Aaliyah Thompson: strong claim.",
      "Noah Kim needs a clearer warrant.",
      "Sofia Reyes — excellent evidence.",
      "Watch Liam O'Brien on mechanics.",
      "Emma Nguyen almost ready to publish.",
    ].join("\n");

    const { sanitizedText, map } = prepareTextForAi(prompt, roster);

    for (const student of roster) {
      expect(sanitizedText).not.toContain(student.name);
      expect(sanitizedText).toContain(tokenForStudentId(student.id));
    }

    expect(rehydratePreparedAiText(sanitizedText, map)).toBe(prompt);
  });

  it("matches Kiddom-style Last_First filenames", () => {
    expect(
      matchStudentFromDocument(roster, {
        filename: "Reyes_Sofia_U1L3.docx",
      }),
    ).toEqual({
      status: "matched",
      student: roster.find((s) => s.id === "s03"),
    });
  });
});
