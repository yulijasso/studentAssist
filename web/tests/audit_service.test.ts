import { describe, it, expect } from "vitest";
import { computeDiff } from "@/server/services/audit_service";

describe("computeDiff", () => {
  it("includes only changed fields as { from, to }", () => {
    const before = { name: "A", isActive: true, domain: "x.edu" };
    const after = { name: "B", isActive: true, domain: "x.edu" };
    expect(computeDiff(before, after, ["name", "isActive", "domain"])).toEqual({
      name: { from: "A", to: "B" },
    });
  });

  it("returns an empty object when nothing changed", () => {
    const o = { a: 1, b: 2 };
    expect(computeDiff(o, { ...o }, ["a", "b"])).toEqual({});
  });

  it("captures boolean flips (suspend/activate)", () => {
    expect(computeDiff({ isActive: true }, { isActive: false }, ["isActive"])).toEqual({
      isActive: { from: true, to: false },
    });
  });

  it("treats missing values as null (from and to)", () => {
    expect(computeDiff({ x: "v" }, { x: null }, ["x"])).toEqual({ x: { from: "v", to: null } });
    expect(computeDiff({}, { y: 5 }, ["y"])).toEqual({ y: { from: null, to: 5 } });
  });

  it("only considers the provided keys", () => {
    expect(computeDiff({ a: 1, b: 1 }, { a: 2, b: 2 }, ["a"])).toEqual({
      a: { from: 1, to: 2 },
    });
  });

  it("compares arrays by value, not reference", () => {
    expect(computeDiff({ a: [1, 2] }, { a: [1, 2] }, ["a"])).toEqual({});
    expect(computeDiff({ a: [1] }, { a: [1, 2] }, ["a"])).toEqual({
      a: { from: [1], to: [1, 2] },
    });
  });

  it("redacts values for redactKeys", () => {
    expect(
      computeDiff({ llmApiKey: "old-secret" }, { llmApiKey: "new-secret" }, ["llmApiKey"], ["llmApiKey"]),
    ).toEqual({ llmApiKey: { from: "***", to: "***" } });
  });

  it("redacts to null when a secret is cleared", () => {
    expect(computeDiff({ key: "old" }, { key: null }, ["key"], ["key"])).toEqual({
      key: { from: "***", to: null },
    });
  });

  it("handles null/undefined before or after objects", () => {
    expect(computeDiff(null, { a: 1 }, ["a"])).toEqual({ a: { from: null, to: 1 } });
    expect(computeDiff({ a: 1 }, undefined, ["a"])).toEqual({ a: { from: 1, to: null } });
  });
});
