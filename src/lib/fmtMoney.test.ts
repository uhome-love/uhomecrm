import { describe, it, expect } from "vitest";
import { fmtMoney } from "./fmtMoney";

describe("fmtMoney — exact", () => {
  it("formats integer thousands with dot separator", () => {
    expect(fmtMoney(925_740, "exact")).toBe("R$ 925.740");
  });

  it("formats with 2 decimals when requested", () => {
    expect(fmtMoney(925_740, "exact", { decimals: 2 })).toBe("R$ 925.740,00");
  });

  it("formats sub-1k values", () => {
    expect(fmtMoney(850, "exact")).toBe("R$ 850");
  });

  it("preserves negative sign before R$", () => {
    expect(fmtMoney(-500_000, "exact")).toBe("-R$ 500.000");
  });

  it("honors hideSymbol in exact mode", () => {
    expect(fmtMoney(925_740, "exact", { hideSymbol: true })).toBe("925.740");
  });

  it("returns fallback for null/undefined/NaN", () => {
    expect(fmtMoney(null, "exact")).toBe("—");
    expect(fmtMoney(undefined, "exact")).toBe("—");
    expect(fmtMoney(NaN, "exact")).toBe("—");
    expect(fmtMoney(null, "exact", { fallback: "n/a" })).toBe("n/a");
  });
});

describe("fmtMoney — short", () => {
  it("renders zero without k suffix", () => {
    expect(fmtMoney(0, "short")).toBe("R$ 0");
  });

  it("renders sub-1k without k suffix", () => {
    expect(fmtMoney(850, "short")).toBe("R$ 850");
  });

  it("rounds thousands", () => {
    expect(fmtMoney(925_740, "short")).toBe("R$ 926k");
    expect(fmtMoney(925_400, "short")).toBe("R$ 925k");
  });

  it("renders millions with 1 decimal (comma)", () => {
    expect(fmtMoney(1_500_000, "short")).toBe("R$ 1,5M");
    expect(fmtMoney(2_450_000, "short")).toBe("R$ 2,5M");
  });

  it("renders billions with 1 decimal (comma)", () => {
    expect(fmtMoney(1_200_000_000, "short")).toBe("R$ 1,2B");
  });

  it("preserves negative sign before R$", () => {
    expect(fmtMoney(-500_000, "short")).toBe("-R$ 500k");
    expect(fmtMoney(-1_500_000, "short")).toBe("-R$ 1,5M");
  });

  it("honors hideSymbol in short mode", () => {
    expect(fmtMoney(1_500_000, "short", { hideSymbol: true })).toBe("1,5M");
  });
});

describe("fmtMoney — shortWithTooltip", () => {
  it("returns display + exact title", () => {
    expect(fmtMoney(925_740, "shortWithTooltip")).toEqual({
      display: "R$ 926k",
      title: "R$ 925.740",
    });
  });

  it("returns fallback in both fields for null", () => {
    expect(fmtMoney(null, "shortWithTooltip")).toEqual({ display: "—", title: "—" });
  });

  it("handles negatives in both fields", () => {
    expect(fmtMoney(-925_740, "shortWithTooltip")).toEqual({
      display: "-R$ 926k",
      title: "-R$ 925.740",
    });
  });
});
