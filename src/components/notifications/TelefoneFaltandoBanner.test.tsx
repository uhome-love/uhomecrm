import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import TelefoneFaltandoBanner from "./TelefoneFaltandoBanner";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "own-user" } }) }));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<MemoryRouter><QueryClientProvider client={client}><TelefoneFaltandoBanner /></QueryClientProvider></MemoryRouter>);
  return client;
}

describe("leitura autorizada do telefone do próprio perfil", () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
  afterEach(cleanup);

  it("lê um telefone válido somente pela consulta protegida existente", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ telefone: "(51) 99999-0000" }], error: null });
    const client = mount();
    await waitFor(() => expect(client.getQueryData(["profile-telefone", "own-user"])).toBe("(51) 99999-0000"));
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_profile_full");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("distingue telefone ausente de falha de leitura", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ telefone: null }], error: null });
    const client = mount();
    await waitFor(() => expect(client.getQueryData(["profile-telefone", "own-user"])).toBe(""));
  });

  it("mantém erro como erro, sem transformá-lo em telefone vazio", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("leitura negada") });
    const client = mount();
    await waitFor(() => expect(client.getQueryState(["profile-telefone", "own-user"])?.status).toBe("error"));
    expect(client.getQueryData(["profile-telefone", "own-user"])).toBeUndefined();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("perfil não encontrado continua desconhecido, sem inventar telefone vazio", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const client = mount();
    await waitFor(() => expect(client.getQueryState(["profile-telefone", "own-user"])?.status).toBe("success"));
    expect(client.getQueryData(["profile-telefone", "own-user"])).toBeNull();
  });
});