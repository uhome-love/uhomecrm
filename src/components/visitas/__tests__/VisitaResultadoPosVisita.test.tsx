import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const updateSpy = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: (u: unknown) => { updateSpy(u); return { eq: () => Promise.resolve({ error: null }) }; } }) },
}));
vi.mock("@/lib/visitaResultadoRouting", () => ({ routeLeadAfterVisita: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import VisitaResultadoDialogMod from "../VisitaResultadoDialog";
import * as Mod from "../VisitaResultadoDialog";
import { registrarResultadoVisita } from "@/lib/registrarResultadoVisita";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Dialog = (VisitaResultadoDialogMod ?? (Mod as any).VisitaResultadoDialog ?? (Mod as any).default) as React.ComponentType<any>;

const botao = () => screen.getByRole("button", { name: /registrar resultado/i });
const preencher = (texto: string, valor: string) =>
  fireEvent.change(screen.getByPlaceholderText(new RegExp(texto, "i")), { target: { value: valor } });

describe("Pós-visita obrigatório", () => {
  beforeEach(() => updateSpy.mockClear());

  it("Quer proposta: só libera com temperatura, próximo passo, data e observação", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<Dialog open onClose={() => {}} onSubmit={onSubmit} nomeCliente="Teste" defaultResultado="gostou_quer_proposta" />);
    preencher("O que rolou", "Cliente gostou muito da planta");
    expect(botao()).toBeDisabled();
    fireEvent.click(screen.getByText("🔥 Quente"));
    preencher("Enviar proposta", "Enviar proposta");
    expect(botao()).toBeDisabled(); // falta data
    const data = container.ownerDocument.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(data, { target: { value: "2099-01-10" } });
    expect(botao()).toBeEnabled();
    fireEvent.click(botao());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][2]).toMatchObject({ temperatura: "quente", proxima_acao: "Enviar proposta", data_proxima_acao: "2099-01-10" });
  });

  it("Vai pensar: objeção é obrigatória", () => {
    const { container } = render(<Dialog open onClose={() => {}} onSubmit={vi.fn()} nomeCliente="Teste" defaultResultado="gostou_vai_pensar" />);
    preencher("O que rolou", "Vai decidir com a esposa");
    fireEvent.click(screen.getByText("🌡️ Morno"));
    preencher("Enviar proposta", "Ligar sexta");
    fireEvent.change(container.ownerDocument.querySelector('input[type="date"]')!, { target: { value: "2099-01-10" } });
    expect(botao()).toBeDisabled();
    expect(screen.getByText(/objeção principal\./i)).toBeTruthy();
  });

  it("No Show: só exige observação", () => {
    render(<Dialog open onClose={() => {}} onSubmit={vi.fn()} nomeCliente="Teste" defaultResultado="nao_compareceu" />);
    preencher("O que rolou", "Cliente não atendeu o telefone");
    expect(botao()).toBeEnabled();
  });

  it("registro grava temperatura, próximo passo e data no cliente e no histórico", async () => {
    const updateStatus = vi.fn();
    await registrarResultadoVisita(
      { id: "v1", pipeline_lead_id: "l1", data_visita: "2020-01-01", hora_visita: "10:00", corretor_id: "c1", nome_cliente: "T" } as never,
      "gostou_vai_pensar", "Vai decidir com a esposa",
      { temperatura: "morno", objecao: "Preço alto", proxima_acao: "Ligar sexta", data_proxima_acao: "2099-01-10" },
      { updateVisita: vi.fn(), updateStatus, userId: "u1" },
    );
    expect(updateStatus.mock.calls[0][2]).toContain("Próximo passo: Ligar sexta (10/01/2099)");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ temperatura: "morno", proxima_acao: "Ligar sexta", data_proxima_acao: "2099-01-10" }));
  });
});
