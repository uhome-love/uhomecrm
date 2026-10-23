import { describe, expect, it } from "vitest";
import { FILTROS_VENDAS, filtrarVendas, rankingVendas, resumoVendas, type VendaRelatorio } from "./vendasRelatorio";
const venda: VendaRelatorio = { id: "v1", nome_cliente: "Cliente", empreendimento: "Connect JW", empreendimento_canonico_id: "connect", construtora: "Cyrela", unidade: "321", vgv_final: 298000, vgv_estimado: 250000, data_assinatura: "2026-10-22", corretor_id: "p1", gerente_id: null, pipeline_lead_id: null, observacoes: null, intermediacao_id: null, comprovante_ato_path: null, origem: "Manual", campanha: null,
  rateios: [{ negocio_id: "v1", corretor_auth_id: "a1", corretor_nome: "Matheus", equipe: "Bruno", gerente_auth_id: "g1", vgv_rateado: 149000, participacao: 0.5, em_parceria: true }, { negocio_id: "v1", corretor_auth_id: "a2", corretor_nome: "Rafaela", equipe: "Gabrielle", gerente_auth_id: "g2", vgv_rateado: 149000, participacao: 0.5, em_parceria: true }] };
describe("resultados de Vendas", () => {
  it("conta uma venda uma vez e reconcilia as duas metades", () => {
    expect(resumoVendas([venda, venda], FILTROS_VENDAS)).toMatchObject({ vendas: 1, vgv: 298000, semIntermediacao: 1 });
    expect(rankingVendas([venda], FILTROS_VENDAS).reduce((s, r) => s + r.vgv, 0)).toBe(298000);
  });
  it("filtrar corretor ou equipe usa a parte histórica do VGV", () => {
    expect(resumoVendas([venda], { ...FILTROS_VENDAS, corretor: "a1" }).vgv).toBe(149000);
    expect(resumoVendas([venda], { ...FILTROS_VENDAS, equipe: "Gabrielle" }).vgv).toBe(149000);
  });
  it("busca unidade e empreendimento sem criar uma venda extra", () => {
    expect(filtrarVendas([venda], { ...FILTROS_VENDAS, busca: "321" })).toHaveLength(1);
    expect(filtrarVendas([venda], { ...FILTROS_VENDAS, construtora: "Open" })).toHaveLength(0);
  });
  it("venda histórica sem intermediação mantém apenas seu VGV sem comissão presumida", () => {
    expect(resumoVendas([{ ...venda, vgv_final: null }], FILTROS_VENDAS)).toMatchObject({ vgv: 250000, semIntermediacao: 1 });
  });
});