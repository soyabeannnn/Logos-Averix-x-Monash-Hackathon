import { describe, expect, it } from "vitest";
import { neighbors } from "./neighbors";

const ids = ["a", "b", "c"];

describe("neighbors", () => {
  it("returns previous and next around the middle item", () => {
    expect(neighbors(ids, "b")).toEqual({ position: 2, total: 3, prevId: "a", nextId: "c" });
  });

  it("has no previous at the start and no next at the end", () => {
    expect(neighbors(ids, "a")?.prevId).toBeNull();
    expect(neighbors(ids, "c")?.nextId).toBeNull();
  });

  it("returns null when the id is not in the list", () => {
    expect(neighbors(ids, "zzz")).toBeNull();
    expect(neighbors([], "a")).toBeNull();
  });

  it("handles a single-item list", () => {
    expect(neighbors(["only"], "only")).toEqual({ position: 1, total: 1, prevId: null, nextId: null });
  });
});
