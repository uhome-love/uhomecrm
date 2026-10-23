import { noPeriodo, type DadosFinanceiro, type VendaFinanceira } from "./financeiro";

export function parcelasSelecionadas(d: DadosFinanceiro, inicio: string, fim: string, hoje: string, busca: string, recebido: boolean, modo: string) {
  const termo=busca.trim().toLocaleLowerCase("pt-BR");
  return d.recebimentos.filter(r=>{
    const n=d.vendas.find(n=>n.id===r.negocio_id);
    if(r.status!==(recebido?"recebido":"pendente")||(!recebido&&n?.status!=="ativo"))return false;
    if(![n?.nome_cliente,n?.empreendimento].join(" ").toLocaleLowerCase("pt-BR").includes(termo))return false;
    return modo==="todos"|| (modo==="vencidas"?!!r.vencimento&&r.vencimento<hoje:noPeriodo(recebido?r.recebido_em:r.vencimento,inicio,fim));
  }).sort((a,b)=>(a.vencimento??"9999").localeCompare(b.vencimento??"9999"));
}

export function dadosPorBusca(d: DadosFinanceiro, busca: string): DadosFinanceiro {
  const termo=busca.trim().toLocaleLowerCase("pt-BR");
  if(!termo)return d;
  const vendas=d.vendas.filter(n=>{
    const inters=d.intermediacoes.filter(i=>i.negocio_id===n.id);
    const nomes=d.beneficiarios.filter(b=>inters.some(i=>i.id===b.intermediacao_id)).map(b=>b.nome);
    return [n.nome_cliente,n.empreendimento,...inters.map(i=>i.comprador_nome),...nomes].join(" ").toLocaleLowerCase("pt-BR").includes(termo);
  });
  const intermediacoes=d.intermediacoes.filter(i=>vendas.some(n=>n.id===i.negocio_id));
  const recebimentos=d.recebimentos.filter(r=>intermediacoes.some(i=>i.id===r.intermediacao_id));
  return {...d,vendas,intermediacoes,recebimentos,beneficiarios:d.beneficiarios.filter(b=>intermediacoes.some(i=>i.id===b.intermediacao_id)),repasses:d.repasses.filter(p=>recebimentos.some(r=>r.id===p.recebimento_id))};
}

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