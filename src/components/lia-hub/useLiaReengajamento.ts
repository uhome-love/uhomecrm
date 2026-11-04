import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const BALDES: { valor: string; rotulo: string }[] = [
  { valor: "sem_interesse_momento", rotulo: "Sem interesse no momento" },
  { valor: "sem_motivo", rotulo: "Sem motivo escrito" },
  { valor: "nao_atende", rotulo: "Não atende" },
  { valor: "outro", rotulo: "Outro" },
  { valor: "sem_perfil", rotulo: "Sem perfil" },
  { valor: "desistiu_compra", rotulo: "Desistiu" },
  { valor: "lead_antigo", rotulo: "Lead antigo" },
];
const TEMPLATE_POR_MODO: Record<string, string> = { produto: "lia_reengajar_produto", cardapio: "lia_reengajar_cardapio" };

type ResumoRow = { balde: string; produto_slug: string | null; produto_ativo: boolean; n: number };
export type ReengajamentoRun = {
  id: string; nome: string | null; modo: string; produto_slug: string | null; template_key: string;
  cap_dia: number; lote_total: number; status: string; criado_em: string; iniciado_em: string | null;
};
type FilaCount = { run_id: string; status: string };

export function useLiaReengajamento() {
  const qc = useQueryClient();

  // ----- dados -----
  const { data: resumo, isLoading: loadingResumo, isError: errorResumo, refetch: refetchResumo } = useQuery({
    queryKey: ["lia-reeng-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_reengajamento_resumo").select("balde, produto_slug, produto_ativo, n");
      if (error) throw error;
      return (data ?? []) as ResumoRow[];
    },
  });
  const { data: runs, isLoading: loadingRuns, isError: errorRuns, refetch: refetchRuns } = useQuery({
    queryKey: ["lia-reeng-runs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_reengajamento_runs").select("*").order("criado_em", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as ReengajamentoRun[];
    },
    refetchInterval: 30000,
  });
  const { data: filaCounts, isLoading: loadingCounts, isError: errorCounts, refetch: refetchCounts } = useQuery({
    queryKey: ["lia-reeng-fila-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_reengajamento_fila").select("run_id, status");
      if (error) throw error;
      return (data ?? []) as FilaCount[];
    },
    refetchInterval: 30000,
  });
  const flagQuery = useQuery({
    queryKey: ["lia-reeng-flag"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_flags").select("flag_value").eq("flag_name", "lia_reengajamento_enabled").maybeSingle();
      if (error) throw error;
      return data?.flag_value ?? null;
    },
  });

  // ----- form de novo lote -----
  const [modo, setModo] = useState<"produto" | "cardapio">("produto");
  const [produtoSlug, setProdutoSlug] = useState<string>("casa-tua-porto-alegre");
  const [balde, setBalde] = useState<string>("sem_interesse_momento");
  const [capDia, setCapDia] = useState<number>(25);
  const [lote, setLote] = useState<number>(100);

  const produtosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (resumo ?? []).forEach((r) => r.produto_slug && s.add(r.produto_slug));
    return Array.from(s).sort();
  }, [resumo]);

  // contagem de elegíveis pro filtro atual
  const elegiveis = useMemo(() => {
    return (resumo ?? [])
      .filter((r) => r.balde === balde)
      .filter((r) => (modo === "produto" ? r.produto_slug === produtoSlug : r.produto_slug === null))
      .reduce((s, r) => s + r.n, 0);
  }, [resumo, balde, modo, produtoSlug]);

  const contagemPorBalde = useMemo(() => {
    const m = new Map<string, number>();
    (resumo ?? []).forEach((r) => {
      const cabe = modo === "produto" ? r.produto_slug === produtoSlug : r.produto_slug === null;
      if (cabe) m.set(r.balde, (m.get(r.balde) ?? 0) + r.n);
    });
    return m;
  }, [resumo, modo, produtoSlug]);

  const countsPorRun = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    (filaCounts ?? []).forEach((f) => {
      const r = m.get(f.run_id) ?? {};
      r[f.status] = (r[f.status] ?? 0) + 1;
      m.set(f.run_id, r);
    });
    return m;
  }, [filaCounts]);

  // ----- mutations -----
  const armar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("lia-reengajar-arm", {
        body: { modo, produto_slug: modo === "produto" ? produtoSlug : null, template_key: TEMPLATE_POR_MODO[modo], balde, cap_dia: capDia, lote },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "falha ao armar");
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Lote armado (pausado): ${d.lote_total} leads na fila.`);
      qc.invalidateQueries({ queryKey: ["lia-reeng-runs"] });
      qc.invalidateQueries({ queryKey: ["lia-reeng-fila-counts"] });
    },
    onError: (e: Error) => toast.error(`Não deu pra armar: ${e.message ?? e}`),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "ativo") patch.iniciado_em = new Date().toISOString();
      const { error } = await supabase.from("lia_reengajamento_runs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lia-reeng-runs"] }); },
    onError: (e: Error) => toast.error(`Não deu pra mudar o status: ${e.message ?? e}`),
  });

  const toggleFlag = useMutation({
    mutationFn: async (ligar: boolean) => {
      const { error } = await supabase.from("system_flags")
        .update({ flag_value: ligar, updated_at: new Date().toISOString() })
        .eq("flag_name", "lia_reengajamento_enabled");
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lia-reeng-flag"] }); },
    onError: (e: Error) => toast.error(`Não deu pra mudar o motor: ${e.message ?? e}`),
  });

  return { resumo, loadingResumo, errorResumo, refetchResumo, runs, loadingRuns, errorRuns, refetchRuns, loadingCounts, errorCounts, refetchCounts, flag: flagQuery.data, flagLoading: flagQuery.isLoading, flagError: flagQuery.isError, refetchFlag: flagQuery.refetch,
    modo, setModo, produtoSlug, setProdutoSlug, balde, setBalde, capDia, setCapDia, lote, setLote,
    produtosDisponiveis, elegiveis, contagemPorBalde, countsPorRun, armar, mudarStatus, toggleFlag };
}
