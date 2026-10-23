import { describe, expect, it } from "vitest";
import { vendasParaDistrato,parcelasSelecionadas,dadosPorBusca } from "./financeiroSelecao";
import { FINANCEIRO_VAZIO,type VendaFinanceira,type ParcelaFinanceira,type IntermediacaoFinanceira } from "./financeiro";

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

describe("seleção compartilhada de parcelas e exportação",()=>{
 const vendas=[{id:"n",nome_cliente:"Cliente A",empreendimento:"Open",status:"ativo"},{id:"n2",nome_cliente:"Cliente B",status:"distratado"}] as VendaFinanceira[];
 const recebimentos=[{id:"p",negocio_id:"n",intermediacao_id:"i",status:"pendente",vencimento:"2026-10-22"},{id:"antes",negocio_id:"n",intermediacao_id:"i",status:"pendente",vencimento:"2026-09-01"},{id:"cancelada",negocio_id:"n2",intermediacao_id:"i2",status:"cancelado",vencimento:"2026-10-22"},{id:"recebida",negocio_id:"n2",intermediacao_id:"i2",status:"recebido",recebido_em:"2026-10-22"}] as ParcelaFinanceira[];
 const d={...FINANCEIRO_VAZIO,vendas,recebimentos,intermediacoes:[{id:"i",negocio_id:"n"},{id:"i2",negocio_id:"n2"}] as IntermediacaoFinanceira[]};
 it("período, todas e vencidas usam a mesma seleção sem incluir canceladas",()=>{
  expect(parcelasSelecionadas(d,"2026-10-01","2026-10-31","2026-10-23","",false,"periodo").map(r=>r.id)).toEqual(["p"]);
  expect(parcelasSelecionadas(d,"2026-10-01","2026-10-31","2026-10-23","",false,"todos").map(r=>r.id)).toEqual(["antes","p"]);
  expect(parcelasSelecionadas(d,"2026-10-01","2026-10-31","2026-10-20","",false,"vencidas").map(r=>r.id)).toEqual(["antes"]);
  expect(parcelasSelecionadas(d,"2026-10-01","2026-10-31","2026-10-23","Cliente B",true,"periodo").map(r=>r.id)).toEqual(["recebida"]);
 });
 it("busca restringe os dados financeiros do relatório ao cliente selecionado",()=>{
  const filtrados=dadosPorBusca(d,"Cliente A");
  expect(filtrados.vendas.map(n=>n.id)).toEqual(["n"]);
  expect(filtrados.intermediacoes.map(i=>i.id)).toEqual(["i"]);
  expect(filtrados.recebimentos.map(r=>r.id)).toEqual(["p","antes"]);
 });
});