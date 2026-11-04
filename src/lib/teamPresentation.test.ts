import { describe, expect, it } from "vitest";
import { teamPresentationContext } from "./teamPresentation";

describe("team page presentation context", () => {
  it("keeps a manager who is also a broker in the team context", () => {
    expect(teamPresentationContext(["gestor", "corretor"])).toBe("team");
  });
  it("keeps the CEO in the company context even with manager roles", () => {
    expect(teamPresentationContext(["admin", "gestor", "corretor"])).toBe("company");
  });
  it("keeps a director in the company context even with manager roles", () => {
    expect(teamPresentationContext(["diretor", "gestor"])).toBe("company");
  });
});