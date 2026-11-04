import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLiaConhecimento } from "./useLiaConhecimento";
import { useLiaConfiguracoes, type ConfigLia } from "./useLiaConfiguracoes";
import type { FichaLia } from "./liaConhecimento";
import { PROPOSTA_ENVIO } from "@/lia/envioProgramado";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn(), order: vi.fn(), invoke: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, functions: { invoke: mocks.invoke } } }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const ficha: FichaLia = { id: "ficticio", nome: "Fictício", nome_publico: null, slug: "ficticio", ficha: "Original", ativo: false, updated_at: "2026-11-04T20:00:00Z", midias: {} };
const config: ConfigLia = { config: null, versao: ficha.updated_at, motor: true, lotes: [{ status: "pausado", cap_dia: 100, nome: null }], isolado: { envio: false, inicio: "08:00", fim: "23:59" }, historico: [] };
describe("salvamento restrito da Lia", () => {
  it("salva apenas ficha e versão e lê o conteúdo confirmado sem chamar envio", async () => {
    let salva = false;
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ order: mocks.order });
    mocks.order.mockReturnValue({ order: () => Promise.resolve({ data: [{ ...ficha, ficha: salva ? "Revisada" : "Original" }], error: null }) });
    mocks.rpc.mockImplementation(async () => { salva = true; return { data: { ...ficha, ficha: "Revisada" }, error: null }; });
    const { result } = renderHook(() => useLiaConhecimento(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { await result.current.salvar.mutateAsync({ produto: ficha, ficha: "Revisada" }); });
    await waitFor(() => expect(result.current.data?.[0]?.ficha).toBe("Revisada"));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("lia_salvar_ficha", { p_id: "ficticio", p_versao: ficha.updated_at, p_ficha: "Revisada" });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("salva somente parâmetros, lê de volta e preserva motor e lote pausado", async () => {
    let atual = config;
    mocks.rpc.mockImplementation(async (nome: string) => {
      if (nome === "lia_salvar_configuracoes") atual = { ...config, config: PROPOSTA_ENVIO };
      return { data: atual, error: null };
    });
    const { result } = renderHook(() => useLiaConfiguracoes(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { await result.current.salvar.mutateAsync({ config: PROPOSTA_ENVIO, versao: config.versao }); });
    await waitFor(() => expect(result.current.data?.config?.limite_dia).toBe(100));
    expect(result.current.data?.motor).toBe(true);
    expect(result.current.data?.lotes[0]?.status).toBe("pausado");
    expect(mocks.rpc.mock.calls.filter(([nome]) => nome !== "lia_ler_configuracoes")).toEqual([["lia_salvar_configuracoes", { p_config: PROPOSTA_ENVIO, p_versao: config.versao }]]);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("falha no salvamento preserva os valores lidos e não anuncia sucesso", async () => {
    mocks.rpc.mockImplementation(async (nome: string) => nome === "lia_ler_configuracoes" ? { data: config, error: null } : { data: null, error: new Error("Versão mudou") });
    const { result } = renderHook(() => useLiaConfiguracoes(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { await expect(result.current.salvar.mutateAsync({ config: PROPOSTA_ENVIO, versao: config.versao })).rejects.toThrow("Versão mudou"); });
    expect(result.current.data?.config).toBeNull();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});