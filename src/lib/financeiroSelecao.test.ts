import { describe, expect, it } from "vitest";
import { vendasParaDistrato } from "./financeiroSelecao";
import type { VendaFinanceira } from "./financeiro";

describe("período dos distratos", () => {
  it("mostra cancelamento do período mesmo se a venda foi assinada antes", () => {
    const vendas = [
      { id: "cancelada-agora", status: "distratado", data_assinatura: "2026-09-01", distrato_em: "2026-10-23" },
      { id: "cancelada-depois", status: "distratado", data_assinatura: "2026-10-01", distrato_em: "2026-11-01" },
      { id: "ativa", status: "ativo", data_assinatura: "2026-10-10" },
    ] as VendaFinanceira[];
    expect(vendasParaDistrato(vendas, "2026-10-01", "2026-10-31", "").map(n => n.id)).toEqual(["cancelada-agora", "ativa"]);
  });
});