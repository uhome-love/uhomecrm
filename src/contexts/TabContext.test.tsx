import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { TabProvider, useTabContext } from "./TabContext";

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ roles: ["admin"], loading: false }) }));
vi.mock("@/config/pageRegistry", () => ({
  resolveRoute: (path: string) => path === "/ceo" ? {
    key: "ceo", label: "CEO", icon: "LayoutGrid", componentKey: "ceo", closable: false,
  } : path === "/tarefas" ? {
    key: "tarefas", label: "Tarefas", icon: "SquareCheck", componentKey: "tarefas",
  } : null,
}));

function setup() {
  return renderHook(() => ({ tabs: useTabContext(), navigate: useNavigate(), path: useLocation().pathname }), {
    wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={["/ceo"]}><TabProvider>{children}</TabProvider></MemoryRouter>,
  });
}

describe("endereço desconhecido preserva as abas existentes", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  it("não consome uma aba nem altera o destino da aba ativa", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.tabs.activeTabId).toBe("ceo"));
    act(() => result.current.tabs.openTab("/tarefas"));
    await waitFor(() => expect(result.current.path).toBe("/tarefas"));
    const before = result.current.tabs.tabs;
    act(() => result.current.navigate("/endereco-inexistente"));
    await waitFor(() => expect(result.current.path).toBe("/endereco-inexistente"));
    expect(result.current.tabs.tabs).toEqual(before);
    expect(result.current.tabs.tabs).toHaveLength(2);
    expect(result.current.tabs.activeTabId).toBe("tarefas");
    expect(result.current.tabs.tabs.find(t => t.id === "tarefas")?.path).toBe("/tarefas");
  });

  it("reativar a aba preservada retorna ao endereço válido", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.tabs.activeTabId).toBe("ceo"));
    act(() => result.current.navigate("/endereco-inexistente"));
    await waitFor(() => expect(result.current.path).toBe("/endereco-inexistente"));
    act(() => result.current.tabs.activateTab("ceo"));
    await waitFor(() => expect(result.current.path).toBe("/ceo"));
    expect(result.current.tabs.tabs).toHaveLength(1);
  });
});