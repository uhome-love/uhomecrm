import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNegocios, type Negocio } from "@/hooks/useNegocios";
import { toast } from "sonner";

// ─── Grupos / status do PDN ──────────────────────────────────────────────────
export type PdnGrupo = "visita_realizada" | "em_negociacao" | "contrato" | "ganho";

export const PDN_GRUPOS: { key: PdnGrupo; label: string; cor: string }[] = [
  { key: "visita_realizada", label: "Visita Realizada", cor: "#10B981" },
  { key: "em_negociacao", label: "Em Negociação", cor: "#EC4899" },
  { key: "contrato", label: "Contrato", cor: "#06B6D4" },
  { key: "ganho", label: "Ganho", cor: "#22C55E" },
];

// Probabilidade ponderada por fase (para forecast)
const PROB_POR_FASE: Record<string, number> = {
  visita_realizada: 0.2,
  novo_negocio: 0.25,
  proposta: 0.4,
  negociacao: 0.55,
  documentacao: 0.8,
  vendido: 1,
};

function faseToGrupo(fase: string): PdnGrupo {
  if (fase === "vendido") return "ganho";
  if (fase === "documentacao") return "contrato";
  // proposta, negociacao, novo_negocio → Em Negociação
  return "em_negociacao";
}

function faseLabel(fase: string): string {
  switch (fase) {
    case "novo_negocio": return "Em Negociação";
    case "proposta": return "Proposta enviada";
    case "negociacao": return "Negociação";
    case "documentacao": return "Contrato";
    case "vendido": return "Ganho / Assinado";
    case "visita_realizada": return "Visita realizada";
    default: return fase;
  }
}


// Data de referência do negócio para agrupar por mês
function negocioRefDate(n: Negocio & { data_assinatura?: string | null }): string {
  if (n.fase === "vendido" && n.data_assinatura) return n.data_assinatura;
  return (n.fase_changed_at || n.created_at || "").slice(0, 10);
}

function mesOf(dateStr: string): string {
  return (dateStr || "").slice(0, 7); // YYYY-MM
}

export interface PdnRow {
  id: string;                 // negocio.id ou pdn_entry.id (manual)
  negocioId: string | null;   // null = linha manual
  overrideId: string | null;  // pdn_entries.id do overlay (se houver)
  grupo: PdnGrupo;
  nome: string;
  data: string;               // YYYY-MM-DD
  empreendimento: string;
  construtora: string;
  vgv: number;
  fase: string;
  situacaoLabel: string;
  corretor: string;
  equipe: string;
  observacoes: string;
  proximaAcao: string;
  diasParado: number;
  emRisco: boolean;
  isManual: boolean;
}

type PdnEntry = {
  id: string;
  negocio_id: string | null;
  gerente_id: string;
  mes: string;
  nome: string;
  situacao: string;
  empreendimento: string | null;
  construtora: string | null;
  vgv: number | null;
  corretor: string | null;
  equipe: string | null;
  data_visita: string | null;
  observacoes: string | null;
  proxima_acao: string | null;
};

function diffDays(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
}

export function usePdn(mes: string) {
  const { user } = useAuth();
  const { negocios, corretorNomes, corretorInfoMap, loading: negLoading } = useNegocios();
  const [overrides, setOverrides] = useState<PdnEntry[]>([]);
  const [manualRows, setManualRows] = useState<PdnEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    setLoadingEntries(true);
    const { data, error } = await supabase
      .from("pdn_entries")
      .select("id, negocio_id, gerente_id, mes, nome, situacao, empreendimento, construtora, vgv, corretor, equipe, data_visita, observacoes, proxima_acao")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Erro ao carregar PDN:", error);
      setLoadingEntries(false);
      return;
    }
    const rows = (data || []) as PdnEntry[];
    setOverrides(rows.filter(r => r.negocio_id));
    setManualRows(rows.filter(r => !r.negocio_id && r.mes === mes));
    setLoadingEntries(false);
  }, [user, mes]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const overrideByNegocio = useMemo(() => {
    const map: Record<string, PdnEntry> = {};
    for (const o of overrides) if (o.negocio_id) map[o.negocio_id] = o;
    return map;
  }, [overrides]);

  const rows = useMemo<PdnRow[]>(() => {
    const out: PdnRow[] = [];

    // Linhas automáticas a partir dos negócios ativos
    for (const n of negocios as (Negocio & { data_assinatura?: string | null })[]) {
      if (n.status !== "ativo") continue; // perdidos ficam fora do PDN
      const refDate = negocioRefDate(n);
      if (mesOf(refDate) !== mes) continue;

      const ov = n.id ? overrideByNegocio[n.id] : undefined;
      const vgv = ov?.vgv ?? n.vgv_final ?? n.vgv_estimado ?? 0;
      const corretor = (n.corretor_id && corretorNomes[n.corretor_id]) || ov?.corretor || "—";
      const equipe = (n.corretor_id && corretorInfoMap[n.corretor_id]?.equipe) || ov?.equipe || "—";
      const proximaAcao = ov?.proxima_acao || "";
      const dias = diffDays(n.fase_changed_at || n.created_at);
      const emRisco = n.fase !== "vendido" && !proximaAcao && dias > 7;

      out.push({
        id: n.id,
        negocioId: n.id,
        overrideId: ov?.id ?? null,
        grupo: faseToGrupo(n.fase),
        nome: n.nome_cliente,
        data: refDate,
        empreendimento: ov?.empreendimento || n.empreendimento || "—",
        construtora: ov?.construtora || "",
        vgv: Number(vgv) || 0,
        fase: n.fase,
        situacaoLabel: faseLabel(n.fase),
        corretor,
        equipe,
        observacoes: ov?.observacoes ?? n.observacoes ?? "",
        proximaAcao,
        diasParado: dias,
        emRisco,
        isManual: false,
      });
    }

    // Linhas manuais (sem negócio vinculado)
    for (const m of manualRows) {
      const grupo = (["visita_realizada", "em_negociacao", "contrato", "ganho"].includes(m.situacao) ? m.situacao : "em_negociacao") as PdnGrupo;
      out.push({
        id: m.id,
        negocioId: null,
        overrideId: m.id,
        grupo,
        nome: m.nome,
        data: m.data_visita || "",
        empreendimento: m.empreendimento || "—",
        construtora: m.construtora || "",
        vgv: Number(m.vgv) || 0,
        fase: m.situacao,
        situacaoLabel: PDN_GRUPOS.find(g => g.key === grupo)?.label.split(" ")[0] || m.situacao,
        corretor: m.corretor || "—",
        equipe: m.equipe || "—",
        observacoes: m.observacoes || "",
        proximaAcao: m.proxima_acao || "",
        diasParado: 0,
        emRisco: false,
        isManual: true,
      });
    }

    return out.sort((a, b) => (b.vgv - a.vgv));
  }, [negocios, corretorNomes, corretorInfoMap, overrideByNegocio, manualRows, mes]);

  // ── Overlay de negócio (construtora, observação, próxima ação) ───────────────
  const saveOverride = useCallback(async (row: PdnRow, patch: Partial<Pick<PdnRow, "construtora" | "observacoes" | "proximaAcao">>) => {
    if (!user || !row.negocioId) return;
    const payload: Record<string, any> = {};
    if (patch.construtora !== undefined) payload.construtora = patch.construtora || null;
    if (patch.observacoes !== undefined) payload.observacoes = patch.observacoes || null;
    if (patch.proximaAcao !== undefined) payload.proxima_acao = patch.proximaAcao || null;

    if (row.overrideId) {
      const { error } = await supabase.from("pdn_entries").update(payload).eq("id", row.overrideId);
      if (error) { toast.error("Erro ao salvar"); return; }
    } else {
      const { error } = await supabase.from("pdn_entries").insert({
        gerente_id: user.id,
        negocio_id: row.negocioId,
        mes,
        nome: row.nome,
        situacao: row.grupo,
        empreendimento: row.empreendimento === "—" ? null : row.empreendimento,
        vgv: row.vgv,
        corretor: row.corretor === "—" ? null : row.corretor,
        equipe: row.equipe === "—" ? null : row.equipe,
        ...payload,
      });
      if (error) { toast.error("Erro ao salvar"); return; }
    }
    await loadEntries();
  }, [user, mes, loadEntries]);

  // ── Linha manual (CRUD completo) ─────────────────────────────────────────────
  const addManualRow = useCallback(async (grupo: PdnGrupo) => {
    if (!user) return;
    const { error } = await supabase.from("pdn_entries").insert({
      gerente_id: user.id,
      mes,
      nome: "Novo negócio",
      situacao: grupo,
    });
    if (error) { toast.error("Erro ao adicionar linha"); return; }
    await loadEntries();
  }, [user, mes, loadEntries]);

  const updateManualRow = useCallback(async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("pdn_entries").update(patch).eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    await loadEntries();
  }, [loadEntries]);

  const deleteRow = useCallback(async (id: string) => {
    const { error } = await supabase.from("pdn_entries").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    await loadEntries();
  }, [loadEntries]);

  // ── Totais / resumo ──────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const byGrupo: Record<PdnGrupo, { count: number; vgv: number }> = {
      visita_realizada: { count: 0, vgv: 0 },
      em_negociacao: { count: 0, vgv: 0 },
      contrato: { count: 0, vgv: 0 },
      ganho: { count: 0, vgv: 0 },
    };
    let forecast = 0;
    let emRisco = 0;
    for (const r of rows) {
      byGrupo[r.grupo].count++;
      byGrupo[r.grupo].vgv += r.vgv;
      forecast += r.vgv * (PROB_POR_FASE[r.fase] ?? 0.3);
      if (r.emRisco) emRisco++;
    }
    const vgvTotal = byGrupo.em_negociacao.vgv + byGrupo.contrato.vgv + byGrupo.ganho.vgv;
    return { byGrupo, vgvTotal, forecast, emRisco, total: rows.length };
  }, [rows]);

  return {
    rows,
    resumo,
    loading: negLoading || loadingEntries,
    saveOverride,
    addManualRow,
    updateManualRow,
    deleteRow,
    reload: loadEntries,
  };
}
