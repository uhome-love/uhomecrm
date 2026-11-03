import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import OfertaAtiva from "./OfertaAtiva";

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ isCorretor: true, isGestor: false, isAdmin: false, isDiretor: false }) }));
vi.mock("@/components/leads-base/CriarCampanhaDialog", () => ({ CriarCampanhaDialog: () => null }));
vi.mock("@/components/leads-base/CampanhasPanel", () => ({ CampanhasPanel: () => null }));
vi.mock("@/components/oferta-ativa/TemplateManager", () => ({ default: () => null }));
vi.mock("@/components/oferta-ativa/PerformanceLivePanel", () => ({ default: () => null }));
vi.mock("@/components/oferta-ativa/RankingOfertaAtiva", () => ({ default: () => null }));
vi.mock("@/components/oferta-ativa/OAObservabilityPanel", () => ({ default: () => null }));
vi.mock("@/components/oferta-ativa/ReservadosPanel", () => ({ default: () => null }));
vi.mock("@/components/oferta-ativa/MeusResultadosPanel", () => ({ default: () => null }));

afterEach(cleanup);

function setup(path: string) {
  return renderHook(() => ({ path: useLocation().pathname, navigate: useNavigate() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[path]}><OfertaAtiva />{children}</MemoryRouter>
    ),
  });
}

describe("redirecionamento de Oferta Ativa com aba persistente", () => {
  it("continua levando o corretor do endereço antigo para sua operação", async () => {
    const { result } = setup("/oferta-ativa");
    await waitFor(() => expect(result.current.path).toBe("/corretor/call"));
  });

  it("uma aba antiga montada não rouba a navegação de Configurações", async () => {
    const { result } = setup("/oferta-ativa");
    await waitFor(() => expect(result.current.path).toBe("/corretor/call"));
    act(() => result.current.navigate("/configuracoes"));
    await waitFor(() => expect(result.current.path).toBe("/configuracoes"));
  });

  it("uma aba antiga montada não substitui o endereço inexistente", async () => {
    const { result } = setup("/oferta-ativa");
    await waitFor(() => expect(result.current.path).toBe("/corretor/call"));
    act(() => result.current.navigate("/onda-a-endereco-inexistente"));
    await waitFor(() => expect(result.current.path).toBe("/onda-a-endereco-inexistente"));
  });
});