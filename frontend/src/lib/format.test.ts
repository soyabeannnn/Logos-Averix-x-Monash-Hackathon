import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import { errorText, formatConfidence, formatValue } from "./format";

describe("formatValue", () => {
  it("adds thousands separators to numbers and leaves text alone", () => {
    expect(formatValue(21577)).toBe("21,577");
    expect(formatValue("PORT KLANG")).toBe("PORT KLANG");
  });
});

describe("formatConfidence", () => {
  it("rounds to a whole percent and handles a missing value", () => {
    expect(formatConfidence(0.954)).toBe("95%");
    expect(formatConfidence(null)).toBe("n/a");
  });
});

describe("errorText", () => {
  it("uses an Error's message and falls back for anything else", () => {
    expect(errorText(new Error("boom"))).toBe("boom");
    expect(errorText("nope")).toBe("Something went wrong.");
  });
});

describe("cn", () => {
  it("joins truthy class names only", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
