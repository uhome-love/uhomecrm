// =============================================================================
// perfData — camada de dados da nova Performance (fonte única: rpc_perf_funil).
// Funções puras que transformam FunilLinha[] em funil, aproveitamento e sinais.
// Tudo derivado da MESMA fonte dos KPIs → zero contradição entre seções.
// =============================================================================
import { somarFunil, type FunilLinha, type FunilTotais } from "@/hooks/useFunilPerformance";

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  /** conversão vs. etapa anterior (%), null na primeira */
  conv: number | null;
}

/** Funil consistente com os KPIs: leads → visitas → realizadas → negócios → vendas. */
export function buildFunnel(t: FunilTotais): FunnelStage[] {
  const raw: { key: string; label: string; value: number }[] = [
    { key: "leads", label: "Leads recebidos", value: t.leads_recebidos },
    { key: "visitas", label: "Visitas criadas", value: t.visitas_total },
    { key: "realizadas", label: "Visitas realizadas", value: t.visitas_realizadas },
    { key: "negocios", label: "Negócios abertos", value: t.negocios_abertos },
    { key: "vendas", label: "Vendas", value: t.vendas },
  ];
  return raw.map((s, i) => {
    const prev = i > 0 ? raw[i - 1].value : null;
    return { ...s, conv: prev && prev > 0 ? (s.value / prev) * 100 : null };
  });
}

/** Aproveitamento lead → venda (%), o número "macro" da operação. */
export function aproveitamentoGeral(t: FunilTotais): number {
  return t.leads_recebidos > 0 ? (t.vendas / t.leads_recebidos) * 100 : 0;
}

export interface AproveitamentoLinha {
  id: string;
  nome: string;
  sub?: string;
  leads: number;
  visitas: number;
  vendas: number;
  vgv: number;
  /** lead → visita realizada (%) */
  leadVisita: number;
  /** visita realizada → venda (%) */
  visitaVenda: number;
}

function linhaAprov(id: string, nome: string, sub: string | undefined, t: FunilTotais): AproveitamentoLinha {
  return {
    id,
    nome,
    sub,
    leads: t.leads_recebidos,
    visitas: t.visitas_realizadas,
    vendas: t.vendas,
    vgv: t.vgv_assinado,
    leadVisita: t.leads_recebidos > 0 ? (t.visitas_realizadas / t.leads_recebidos) * 100 : 0,
    visitaVenda: t.visitas_realizadas > 0 ? (t.vendas / t.visitas_realizadas) * 100 : 0,
  };
}

/** Aproveitamento por equipe (agrupa por l.equipe). */
export function aproveitamentoPorEquipe(linhas: FunilLinha[]): AproveitamentoLinha[] {
  const map = new Map<string, FunilLinha[]>();
  linhas.forEach((l) => {
    const k = l.equipe || "Sem equipe";
    map.set(k, [...(map.get(k) || []), l]);
  });
  return Array.from(map.entries())
    .map(([equipe, membros]) => {
      const t = somarFunil(membros);
      return linhaAprov(equipe, equipe, `${t.corretores} corretores`, t);
    })
    .sort((a, b) => b.vgv - a.vgv || b.leads - a.leads);
}

/** Aproveitamento por corretor. */
export function aproveitamentoPorCorretor(linhas: FunilLinha[]): AproveitamentoLinha[] {
  const map = new Map<string, FunilLinha[]>();
  linhas.forEach((l) => {
    map.set(l.corretor_auth_id, [...(map.get(l.corretor_auth_id) || []), l]);
  });
  return Array.from(map.entries())
    .map(([id, rows]) => {
      const t = somarFunil(rows);
      return linhaAprov(id, rows[0].corretor_nome ?? "—", rows[0].equipe ?? undefined, t);
    })
    .sort((a, b) => b.leads - a.leads);
}

export type SinalTom = "bad" | "warn" | "ok";
export interface Sinal {
  tom: SinalTom;
  titulo: string;
  detalhe?: string;
}

/** Sinais de atenção acionáveis, derivados dos corretores ativos. */
export function buildSinais(linhas: FunilLinha[], escopo: "empresa" | "equipe" | "corretor"): Sinal[] {
  const ativos = linhas.filter((l) => l.corretor_ativo);
  const t = somarFunil(linhas);

  if (escopo === "corretor") {
    const l = linhas[0];
    const out: Sinal[] = [];
    if (!l) return out;
    if (l.vendas > 0)
      out.push({ tom: "ok", titulo: `${l.vendas} venda${l.vendas > 1 ? "s" : ""} no período`, detalhe: "bom trabalho — mantenha o ritmo" });
    if (l.visitas_realizadas === 0)
      out.push({ tom: "bad", titulo: "Nenhuma visita realizada", detalhe: "onde você está falhando: marque e realize visitas" });
    else if (l.leads_recebidos > 0 && l.visitas_realizadas / l.leads_recebidos < 0.08)
      out.push({ tom: "warn", titulo: "Poucos leads viram visita", detalhe: "melhore a qualificação e o follow-up" });
    if (l.visitas_no_show > 0)
      out.push({ tom: "warn", titulo: `${l.visitas_no_show} no-show no período`, detalhe: "confirme a visita no dia anterior" });
    if (out.length === 0) out.push({ tom: "ok", titulo: "Sem sinais de alerta", detalhe: "seus números estão saudáveis" });
    return out;
  }

  const semVisita = ativos.filter((l) => l.visitas_realizadas === 0).length;
  const vgvZero = ativos.filter((l) => l.vgv_assinado === 0).length;
  const descarteAlto = ativos.filter((l) => l.leads_recebidos >= 5 && l.descartes / Math.max(l.leads_recebidos, 1) > 0.6).length;
  const noShowPct = t.visitas_total > 0 ? (t.visitas_no_show / t.visitas_total) * 100 : 0;

  const out: Sinal[] = [];
  if (semVisita > 0) out.push({ tom: "warn", titulo: `${semVisita} sem visita realizada`, detalhe: `de ${ativos.length} corretores ativos` });
  if (noShowPct >= 30) out.push({ tom: "warn", titulo: `No-show em ${Math.round(noShowPct)}% das visitas`, detalhe: `${t.visitas_no_show} faltas em ${t.visitas_total} criadas` });
  if (descarteAlto > 0) out.push({ tom: "bad", titulo: `${descarteAlto} com descarte acima de 60%`, detalhe: "leads chegando e sendo perdidos" });
  if (vgvZero > 0) out.push({ tom: escopo === "empresa" ? "warn" : "bad", titulo: `${vgvZero} sem venda assinada`, detalhe: "foco em fechamento" });
  if (out.length === 0) out.push({ tom: "ok", titulo: "Sem sinais de alerta no período", detalhe: "operação saudável" });
  return out;
}
