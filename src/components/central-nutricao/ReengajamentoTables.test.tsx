import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ReengajamentoHistorico from "./ReengajamentoHistorico";
import ReengajamentoUltimos from "./ReengajamentoUltimos";
import type { DispatchRun } from "./types";
import type { UltimoLead } from "./ReengajamentoUltimos";

describe("ReengajamentoHistorico", () => {
  it("mostra estado vazio", () => {
    render(<ReengajamentoHistorico runs={[]} onRefresh={() => {}} />);
    expect(screen.getByText("Nenhum disparo ainda")).toBeInTheDocument();
  });

  it("renderiza uma execução com contadores", () => {
    const runs = [
      {
        id: "r1",
        status: "completed",
        started_at: "2026-07-13T12:00:00Z",
        enviados: 10,
        total_alvo: 12,
        falhas: 1,
        ignorados: 1,
        motivo_parada: null,
        erros: null,
      } as unknown as DispatchRun,
    ];
    render(<ReengajamentoHistorico runs={runs} onRefresh={() => {}} />);
    expect(screen.getByText("10/12")).toBeInTheDocument();
    expect(screen.getByText("✅ Concluído")).toBeInTheDocument();
  });
});

describe("ReengajamentoUltimos", () => {
  it("mostra estado vazio", () => {
    render(<ReengajamentoUltimos ultimos={[]} onRefresh={() => {}} onReativar={() => {}} />);
    expect(screen.getByText("Nenhum envio ainda")).toBeInTheDocument();
  });

  it("mostra botão de reativar para lead elegível", () => {
    const ultimos: UltimoLead[] = [
      {
        id: "l1",
        nome: "Maria",
        telefone: "5511999999999",
        reengajamento_enviado_at: "2026-07-13T12:00:00Z",
        reengajamento_status: "enviado",
        reativado_por_nutricao: false,
        reativado_em: null,
        ultimaResposta: null,
      },
    ];
    render(<ReengajamentoUltimos ultimos={ultimos} onRefresh={() => {}} onReativar={() => {}} />);
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("🔄 Reativar")).toBeInTheDocument();
  });
});
