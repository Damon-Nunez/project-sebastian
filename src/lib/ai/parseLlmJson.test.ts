import { describe, expect, it } from "vitest";
import { extractJsonObject } from "./parseLlmJson";

describe("extractJsonObject", () => {
  it("parses valid JSON", () => {
    expect(extractJsonObject('{"items":[1],"ok":true}')).toEqual({
      items: [1],
      ok: true,
    });
  });

  it("repairs trailing commas", () => {
    expect(
      extractJsonObject('{"items":[{"a":1},],"comment":"x",}'),
    ).toEqual({ items: [{ a: 1 }], comment: "x" });
  });

  it("repairs smart quotes", () => {
    expect(extractJsonObject('{"comment":“hello”}')).toEqual({
      comment: "hello",
    });
  });

  it("repairs unescaped quotes inside strings", () => {
    expect(
      extractJsonObject(
        '{"items":[{"reason":"Wrote "because" then stopped"}],"ok":true}',
      ),
    ).toEqual({
      items: [{ reason: 'Wrote "because" then stopped' }],
      ok: true,
    });
  });

  it("strips markdown fences", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
