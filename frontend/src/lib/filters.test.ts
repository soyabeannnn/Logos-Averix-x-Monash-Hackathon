import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filtersFromParams, filtersToQuery } from "./filters";

describe("filtersToQuery", () => {
  it("omits empty values and returns an empty string when nothing is set", () => {
    expect(filtersToQuery(EMPTY_FILTERS)).toBe("");
    expect(filtersToQuery({ status: "MISMATCH", category: "", q: "" })).toBe("?status=MISMATCH");
  });

  it("encodes special characters", () => {
    expect(filtersToQuery({ q: "a b&c" })).toBe("?q=a+b%26c");
  });
});

describe("filtersFromParams", () => {
  it("reads known keys and defaults the rest to empty strings", () => {
    const params = new URLSearchParams("status=OK&q=hello");
    expect(filtersFromParams(params)).toEqual({ category: "", status: "OK", q: "hello" });
  });

  it("round-trips through the query string", () => {
    const filters = { category: "BL_COMPARISON", status: "NEEDS_REVIEW", q: "x y" };
    expect(filtersFromParams(new URLSearchParams(filtersToQuery(filters)))).toEqual(filters);
  });
});
