import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const updateSpy = vi.fn();
const chain = (data: unknown) => {
  const c: Record<string, unknown> = {};
  for (const k of ["select", "eq", "in", "order", "limit"]) c[k] = () => c;
  c.maybeSingle = () => Promise.resolve({ data, error: null });
  c.update = (u: unknown) => { updateSpy(u); return { eq: () => Promise.resolve({ error: null }) }; };
  return c;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => t === "visitas"
      ? chain({ data_visita: "2026-11-01", resultado_visita: "gostou_vai_pensar", objecao: null, observacoes: "x | Objeção: Preço alto", status: "realizada" })
      : chain({ temperatura: "quente", proxima_acao: "Ligar sexta", data_proxima_acao: "2026-11-06", updated_at: "2026-11-03T15:00:00Z" }),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { TermometroNegocio } from "../TermometroNegocio";

const montar = () => render(
  <QueryClientProvider client={new QueryClient()}><TermometroNegocio leadId="l1" situacao="Proposta enviada" /></QueryClientProvider>,
);

describe("Termômetro do negócio", () => {
  it("mostra situação, próximo passo e última visita com objeção", async () => {
    montar();
    expect(await screen.findByText("Ligar sexta · 06/11/2026")).toBeTruthy();
    expect(screen.getByText("Proposta enviada")).toBeTruthy();
    expect(screen.getByText("Objeção: Preço alto")).toBeTruthy();
  });

  it("próximo passo exige data e grava no cliente", async () => {
    montar();
    fireEvent.click(await screen.findByText("Ligar sexta · 06/11/2026"));
    fireEvent.change(screen.getByLabelText("Quando"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Salvar próximo passo"));
    expect(updateSpy).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Quando"), { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByLabelText("Salvar próximo passo"));
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ proxima_acao: "Ligar sexta", data_proxima_acao: "2026-11-10" })));
  });
});
