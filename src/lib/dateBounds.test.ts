import { describe, expect, it } from "vitest";
import { withinDateBounds } from "./dateBounds";

describe("existing visit date bounds", () => {
  it("does not allow the initial date after the final date", () => {
    expect(withinDateBounds("2026-10-31", undefined, "2026-10-31")).toBe(true);
    expect(withinDateBounds("2026-11-01", undefined, "2026-10-31")).toBe(false);
  });
  it("does not allow the final date before the initial date", () => {
    expect(withinDateBounds("2026-10-01", "2026-10-01")).toBe(true);
    expect(withinDateBounds("2026-09-30", "2026-10-01")).toBe(false);
  });
});