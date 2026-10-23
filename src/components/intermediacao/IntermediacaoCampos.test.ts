import { describe, expect, it } from "vitest";
import { num } from "./IntermediacaoCampos";

describe("valores da intermediação", () => {
  it("converte valor brasileiro sem perder milhares ou centavos", () => {
    expect(num("1.000,00")).toBe(1000);
    expect(num("298.000,99")).toBe(298000.99);
    expect(num("1000.50")).toBe(1000.5);
  });
});