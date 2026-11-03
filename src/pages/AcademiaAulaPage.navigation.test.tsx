import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import AcademiaAulaPage from "./AcademiaAulaPage";

afterEach(cleanup);

function setup() {
  return renderHook(() => ({ path: useLocation().pathname, navigate: useNavigate() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/academia/aula/aula-teste"]}><AcademiaAulaPage />{children}</MemoryRouter>
    ),
  });
}

describe("endereço antigo de aula em abas persistentes", () => {
  it("mantém o retorno ao hub quando a aula antiga é o endereço atual", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.path).toBe("/academia"));
  });

  it("não desvia outra página ou endereço inexistente após o retorno", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.path).toBe("/academia"));
    act(() => result.current.navigate("/tarefas"));
    await waitFor(() => expect(result.current.path).toBe("/tarefas"));
    act(() => result.current.navigate("/onda-a-endereco-inexistente"));
    await waitFor(() => expect(result.current.path).toBe("/onda-a-endereco-inexistente"));
  });
});