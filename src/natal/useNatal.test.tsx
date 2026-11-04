import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNatal } from "./useNatal";

vi.mock("./config", () => ({
  EVENTO_EFEITOS: "natal-efeitos",
  efeitosLigados: () => true,
  isNatal: () => true,
}));

afterEach(() => vi.restoreAllMocks());

describe("preferência de movimento da campanha", () => {
  it("mantém a decoração, mas desliga movimento quando o aparelho solicita redução", () => {
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
    const { result } = renderHook(() => useNatal());
    expect(result.current.efeitos).toBe(true);
    expect(result.current.movimento).toBe(false);
  });

  it("responde à mudança do aparelho com a página já aberta e remove o observador ao sair", () => {
    let listener: (() => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_event: string, callback: () => void) => { listener = callback; }),
      removeEventListener: vi.fn(),
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
    const { result, unmount } = renderHook(() => useNatal());
    expect(result.current.movimento).toBe(true);
    act(() => { media.matches = true; listener?.(); });
    expect(result.current.movimento).toBe(false);
    act(() => { media.matches = false; listener?.(); });
    expect(result.current.movimento).toBe(true);
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});