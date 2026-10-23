import { noPeriodo, type DadosFinanceiro, type VendaFinanceira } from "./financeiro";

export function custosNoPeriodo(d: DadosFinanceiro, inicio: string, fim: string) {
  return {
    custos: d.custos.filter(c => noPeriodo(c.competencia, inicio, fim)),
    midia: d.midia.filter(m => noPeriodo(m.dia, inicio, fim)),
    midia_manual: d.midia_manual.filter(m => noPeriodo(m.competencia, inicio, fim)),
  };
}

export function vendasParaDistrato(vendas: VendaFinanceira[], inicio: string, fim: string, busca: string) {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return vendas.filter(n => noPeriodo(n.status === "distratado" ? n.distrato_em : n.data_assinatura, inicio, fim)
    && [n.nome_cliente, n.empreendimento].join(" ").toLocaleLowerCase("pt-BR").includes(termo));
}