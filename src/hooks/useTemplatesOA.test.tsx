import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTemplatesOA } from "./useBaseLeads";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), order: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ order: mocks.order });
  return renderHook(() => useTemplatesOA(), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("roteiros existentes da Oferta Ativa", () => {
  it("seleciona e ordena pelo título oficial, preservando o ID do roteiro", async () => {
    const row = { id: "roteiro-123", titulo: "Primeiro contato", empreendimento: "Produto A" };
    mocks.order.mockResolvedValue({ data: [row], error: null });
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.from).toHaveBeenCalledWith("oferta_ativa_templates");
    expect(mocks.select).toHaveBeenCalledWith("id,titulo,empreendimento");
    expect(mocks.order).toHaveBeenCalledWith("titulo");
    expect(result.current.data).toEqual([row]);
    expect(result.current.data?.[0]?.id).toBe("roteiro-123");
  });

  it("não converte falha da consulta em lista vazia", async () => {
    mocks.order.mockResolvedValue({ data: null, error: new Error("consulta negada") });
    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});