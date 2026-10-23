export interface RateioVenda {
  negocio_id: string | null; corretor_auth_id: string | null; corretor_nome: string | null;
  equipe: string | null; gerente_auth_id: string | null; vgv_rateado: number | null;
  participacao: number | null; em_parceria: boolean | null;
}
export interface VendaRelatorio {
  id: string; nome_cliente: string; empreendimento: string | null; empreendimento_canonico_id: string | null;
  construtora: string | null; unidade: string | null; vgv_final: number | null; vgv_estimado: number | null;
  data_assinatura: string | null; corretor_id: string | null; gerente_id: string | null;
  pipeline_lead_id: string | null; observacoes: string | null; intermediacao_id: string | null;
  comprovante_ato_path: string | null; origem: string; campanha: string | null; rateios: RateioVenda[];
}
export interface FiltrosVendas { busca: string; construtora: string; empreendimento: string; corretor: string; equipe: string }
export const FILTROS_VENDAS: FiltrosVendas = { busca: "", construtora: "todos", empreendimento: "todos", corretor: "todos", equipe: "todos" };
export function rateiosSelecionados(v: VendaRelatorio, f: FiltrosVendas): RateioVenda[] {
  return v.rateios.filter(r => (f.corretor === "todos" || r.corretor_auth_id === f.corretor) && (f.equipe === "todos" || (r.equipe || "Sem equipe") === f.equipe));
}
export function valorVenda(v: VendaRelatorio, f: FiltrosVendas): number {
  if (f.corretor === "todos" && f.equipe === "todos") return Number(v.vgv_final ?? v.vgv_estimado ?? 0);
  return rateiosSelecionados(v, f).reduce((s, r) => s + Number(r.vgv_rateado ?? 0), 0);
}
export function filtrarVendas(vendas: VendaRelatorio[], f: FiltrosVendas): VendaRelatorio[] {
  const termo = f.busca.trim().toLocaleLowerCase("pt-BR");
  return vendas.filter(v => (f.construtora === "todos" || (v.construtora || "Não informada") === f.construtora)
    && (f.empreendimento === "todos" || (v.empreendimento_canonico_id || v.empreendimento) === f.empreendimento)
    && ((f.corretor === "todos" && f.equipe === "todos") || rateiosSelecionados(v, f).length > 0)
    && (!termo || [v.nome_cliente, v.unidade, v.empreendimento, v.construtora, ...v.rateios.map(r => r.corretor_nome)].join(" ").toLocaleLowerCase("pt-BR").includes(termo)));
}
export function resumoVendas(vendas: VendaRelatorio[], f: FiltrosVendas) {
  const unicas = [...new Map(vendas.map(v => [v.id, v])).values()];
  const vgv = unicas.reduce((s, v) => s + valorVenda(v, f), 0);
  return { vendas: unicas.length, vgv, ticket: unicas.length ? vgv / unicas.length : 0, semIntermediacao: unicas.filter(v => !v.intermediacao_id).length };
}
export function rankingVendas(vendas: VendaRelatorio[], f: FiltrosVendas, porEquipe = false) {
  const grupos = new Map<string, { id: string; nome: string; vgv: number; negocios: Set<string> }>();
  for (const v of vendas) for (const r of rateiosSelecionados(v, f)) {
    const id = porEquipe ? r.equipe || "Sem equipe" : r.corretor_auth_id || "sem-corretor";
    const grupo = grupos.get(id) ?? { id, nome: porEquipe ? id : r.corretor_nome || "Não identificado", vgv: 0, negocios: new Set<string>() };
    grupo.vgv += Number(r.vgv_rateado ?? 0); grupo.negocios.add(v.id); grupos.set(id, grupo);
  }
  return [...grupos.values()].map(g => ({ id: g.id, nome: g.nome, vgv: g.vgv, vendas: g.negocios.size })).sort((a, b) => b.vgv - a.vgv);
}
export function agruparVendas(vendas: VendaRelatorio[], f: FiltrosVendas, campo: "construtora" | "origem") {
  const grupos = new Map<string, { nome: string; vendas: number; vgv: number }>();
  for (const v of vendas) {
    const nome = campo === "construtora" ? v.construtora || "Não informada" : [v.origem, v.campanha].filter(Boolean).join(" · ");
    const g = grupos.get(nome) ?? { nome, vendas: 0, vgv: 0 };
    g.vendas++; g.vgv += valorVenda(v, f); grupos.set(nome, g);
  }
  return [...grupos.values()].sort((a, b) => b.vgv - a.vgv);
}
export function documentosVenda(v: VendaRelatorio): string[] {
  return [!v.intermediacao_id ? "Intermediação" : "", !v.comprovante_ato_path ? "Comprovante do ato" : "", !v.empreendimento_canonico_id || !v.construtora ? "Cadastro oficial" : "", !v.unidade ? "Unidade" : "", !v.vgv_final ? "VGV final" : ""].filter(Boolean);
}