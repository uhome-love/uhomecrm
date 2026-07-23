/**
 * useMutiraoSession — hook central do "Mutirão Inteligente" (Oferta Ativa Ao Vivo).
 * Cuida da sessão ao vivo, próximo lead, lock, resultados, heartbeat e prefetch.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCorretorIds } from "@/hooks/useCorretorIds";

export type Balde = "verde_hot" | "verde" | "amarelo";
export type Resultado = "pulado" | "nao_atendeu" | "sem_interesse" | "aproveitado" | "visita_agendada";

export interface LeadOferta {
  id: string;
  nome: string | null;
  telefone: string | null;
  telefone_normalizado: string | null;
  email: string | null;
  empreendimento_raw: string | null;
  empreendimento_canonico: { id: string; nome: string; segmento_id?: string | null } | null;
  segmento: { id: string; nome: string; cor?: string | null } | null;
  campanha: string | null;
  origem: string | null;
  motivo_descarte: string | null;
  reengajamento_status: string | null;
  dias_desde_descarte: number | null;
  stage_changed_at: string | null;
  score: number | null;
  score_temperatura: string | null;
  created_at: string | null;
}


export interface ProximoLeadResult {
  ok: boolean;
  lead: LeadOferta | null;
  fila_id?: string;
  balde?: Balde;
  bucket_order?: number;
  locked_until?: string;
  reason?: string;
  prefetch?: boolean;
}

const STORAGE_KEY_FILTERS_BASE = "mutirao:filters";
const STORAGE_KEY_ONBOARDED_BASE = "mutirao:onboarded";

export function useMutiraoSession() {
  const qc = useQueryClient();
  const { profileId, authId } = useCorretorIds();
  // Escopa as chaves de localStorage por corretor para evitar vazamento de estado
  // entre usuários que compartilham o mesmo navegador.
  const scopeKey = profileId ?? authId ?? null;
  const filtersKey = scopeKey ? `${STORAGE_KEY_FILTERS_BASE}:${scopeKey}` : null;
  const onboardedKey = scopeKey ? `${STORAGE_KEY_ONBOARDED_BASE}:${scopeKey}` : null;

  // Sessão ao vivo
  const sessaoQ = useQuery({
    queryKey: ["mutirao", "sessao-ao-vivo"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("oferta_ativa_sessoes")
        .select("*")
        .eq("status", "ao_vivo")
        .lte("inicio_at", nowIso)
        .gte("fim_at", nowIso)
        .order("inicio_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  const sessaoId = sessaoQ.data?.id ?? null;

  // Filtros persistidos (escopados por corretor)
  const [filters, setFiltersState] = useState<{ empreendimento_ids: string[]; segmento_ids: string[] }>({
    empreendimento_ids: [],
    segmento_ids: [],
  });
  const [onboarded, setOnboardedState] = useState<boolean>(false);

  // Carrega estado do localStorage assim que o scopeKey (corretor) for resolvido.
  useEffect(() => {
    if (!filtersKey || !onboardedKey) return;
    try {
      const raw = localStorage.getItem(filtersKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.empreendimento_ids) && Array.isArray(parsed.segmento_ids)) {
          setFiltersState(parsed);
        } else {
          setFiltersState({ empreendimento_ids: [], segmento_ids: [] });
        }
      } else {
        setFiltersState({ empreendimento_ids: [], segmento_ids: [] });
      }
    } catch {
      setFiltersState({ empreendimento_ids: [], segmento_ids: [] });
    }
    setOnboardedState(localStorage.getItem(onboardedKey) === "1");
  }, [filtersKey, onboardedKey]);

  const setFilters = useCallback((f: { empreendimento_ids: string[]; segmento_ids: string[] }) => {
    setFiltersState(f);
    if (filtersKey) localStorage.setItem(filtersKey, JSON.stringify(f));
  }, [filtersKey]);

  const setOnboarded = useCallback((v: boolean) => {
    setOnboardedState(v);
    if (onboardedKey && v) localStorage.setItem(onboardedKey, "1");
  }, [onboardedKey]);

  // Lead atual (client-side state). fila_id vazio = preview otimista (lock ainda não confirmou).
  const [current, setCurrent] = useState<{ fila_id: string; balde: Balde; lead: LeadOferta; locked_until?: string } | null>(null);
  const [lockConfirmed, setLockConfirmed] = useState(false);
  const [noLeadsReason, setNoLeadsReason] = useState<string | null>(null);

  // Prévia do próximo lead (prefetch — sem lock). Só para exibição.
  const [prefetched, setPrefetched] = useState<{ balde: Balde; lead: LeadOferta } | null>(null);
  const prefetchedRef = useRef<{ balde: Balde; lead: LeadOferta } | null>(null);
  useEffect(() => { prefetchedRef.current = prefetched; }, [prefetched]);

  // Chamada de ligação (client timer)
  const [callState, setCallState] = useState<"idle" | "in_call" | "ended">("idle");
  const [callStart, setCallStart] = useState<number | null>(null);
  const [callEnd, setCallEnd] = useState<number | null>(null);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // ─── Prefetch: espia o próximo lead SEM lock ───
  const prefetchNext = useCallback(async () => {
    if (!sessaoId) return;
    try {
      const body: any = {
        sessao_id: sessaoId,
        empreendimento_ids: filtersRef.current.empreendimento_ids.length ? filtersRef.current.empreendimento_ids : undefined,
        segmento_ids: filtersRef.current.segmento_ids.length ? filtersRef.current.segmento_ids : undefined,
        prefetch: true,
      };
      const { data } = await supabase.functions.invoke<ProximoLeadResult>("oferta-ativa-proximo-lead", { body });
      if (data?.ok && data.lead) {
        setPrefetched({ balde: (data.balde ?? "verde") as Balde, lead: data.lead });
      } else {
        setPrefetched(null);
      }
    } catch { /* silent */ }
  }, [sessaoId]);

  // Aquece a edge function e já deixa o primeiro lead pronto assim que a sessão existe e o corretor estiver onboarded.
  useEffect(() => {
    if (sessaoId && onboarded) {
      prefetchNext();
    }
  }, [sessaoId, onboarded, prefetchNext]);

  const proximoLeadM = useMutation({
    mutationFn: async () => {
      if (!sessaoId) throw new Error("Nenhuma sessão ao vivo agora");
      const body: any = {
        sessao_id: sessaoId,
        empreendimento_ids: filters.empreendimento_ids.length ? filters.empreendimento_ids : undefined,
        segmento_ids: filters.segmento_ids.length ? filters.segmento_ids : undefined,
      };
      const { data, error } = await supabase.functions.invoke<ProximoLeadResult>("oferta-ativa-proximo-lead", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.ok && data.lead && data.fila_id) {
        setCurrent((prev) => {
          // Se o preview otimista já está exibindo o mesmo lead, apenas confirma o lock (evita re-render/piscada).
          if (prev && prev.lead.id === data.lead!.id) {
            return { fila_id: data.fila_id!, balde: (data.balde ?? prev.balde) as Balde, lead: data.lead!, locked_until: data.locked_until };
          }
          // Lead diferente (o prefetched já foi pego por outro corretor) — troca pelo que o lock retornou.
          return { fila_id: data.fila_id!, balde: (data.balde ?? "verde") as Balde, lead: data.lead!, locked_until: data.locked_until };
        });
        setLockConfirmed(true);
        setNoLeadsReason(null);
        setCallState("idle");
        setCallStart(null);
        setCallEnd(null);
        setPrefetched(null);
        // Dispara prefetch do PRÓXIMO em background (~1s depois)
        setTimeout(() => { prefetchNext(); }, 1000);
      } else {
        setCurrent(null);
        setLockConfirmed(false);
        setPrefetched(null);
        setNoLeadsReason(data?.reason === "fila_vazia" ? "fila_vazia" : "sem_filtros_match");
      }
    },
    onError: (e: any) => {
      // Rollback do preview otimista se o lock falhou.
      setLockConfirmed(false);
      setCurrent(null);
      toast.error(e?.message || "Erro ao buscar próximo lead");
    },
  });

  const registrarM = useMutation({
    mutationFn: async (payload: {
      resultado: Resultado;
      observacao?: string;
      motivo_perda?: string;
      visita_payload?: any;
    }) => {
      if (!sessaoId || !current) throw new Error("Sem lead ativo");
      if (!current.fila_id) throw new Error("Aguardando lock do lead");
      const { data, error } = await supabase.functions.invoke("oferta-ativa-registrar-resultado", {
        body: {
          sessao_id: sessaoId,
          fila_id: current.fila_id,
          pipeline_lead_id: current.lead.id,
          ...payload,
        },
      });
      if (error) throw error;
      if ((data as any)?.error === "DUPLICATE_ACTIVE") {
        toast.error("Lead já ativo em outro pipeline. Nada foi duplicado.");
        return data;
      }
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.error === "DUPLICATE_ACTIVE") return;
      qc.invalidateQueries({ queryKey: ["mutirao", "ranking"] });
      qc.invalidateQueries({ queryKey: ["mutirao", "participantes"] });
      qc.invalidateQueries({ queryKey: ["mutirao", "historico"] });
      qc.invalidateQueries({ queryKey: ["mutirao", "reaproveitar"] });
      if (data?.bateu_meta) toast.success("🏆 Você bateu uma meta!");
      // Auto-next — preview otimista com o prefetched (se existir) enquanto o lock roda.
      applyOptimisticAndFetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar resultado"),
  });

  // Pular: envia resultado='pulado'. Backend solta o lock, não seta cooldown,
  // NÃO toca ultimo_corretor_id (mantém o descartador). O RPC exclui o lead do
  // pulador nesta sessão.
  const pularM = useMutation({
    mutationFn: async () => {
      if (!current) return;
      if (!current.fila_id) {
        toast.info("Aguardando confirmação do lead atual…");
        return;
      }
      await registrarM.mutateAsync({ resultado: "pulado", observacao: "[Pulado sem ligar]" });
    },
  });

  // Aplica o preview otimista (do prefetched) e dispara o lock real em paralelo.
  const applyOptimisticAndFetch = useCallback(() => {
    const pf = prefetchedRef.current;
    if (pf) {
      setCurrent({ fila_id: "", balde: pf.balde, lead: pf.lead });
      setLockConfirmed(false);
      setCallState("idle");
      setCallStart(null);
      setCallEnd(null);
      setPrefetched(null);
      prefetchedRef.current = null;
    } else {
      setCurrent(null);
      setLockConfirmed(false);
      setCallState("idle");
    }
    proximoLeadM.mutate();
  }, [proximoLeadM]);

  // Heartbeat 30s
  const hbTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!sessaoId) return;
    const send = () => {
      supabase.functions.invoke("oferta-ativa-participantes", { body: { sessao_id: sessaoId } }).catch(() => {});
    };
    send();
    hbTimerRef.current = window.setInterval(send, 30_000) as unknown as number;
    return () => { if (hbTimerRef.current) window.clearInterval(hbTimerRef.current); };
  }, [sessaoId]);

  // Timer da ligação
  const startCall = useCallback(() => {
    setCallState("in_call");
    setCallStart(Date.now());
    setCallEnd(null);
  }, []);
  const endCall = useCallback(() => {
    setCallState("ended");
    setCallEnd(Date.now());
  }, []);

  return {
    sessao: sessaoQ.data,
    sessaoLoading: sessaoQ.isLoading,
    sessaoId,
    filters,
    setFilters,
    onboarded,
    setOnboarded,
    current,
    setCurrent,
    lockConfirmed,
    prefetched,
    proximoLead: applyOptimisticAndFetch,
    proximoLeadPending: proximoLeadM.isPending,
    noLeadsReason,
    clearNoLeads: () => setNoLeadsReason(null),
    registrar: registrarM.mutateAsync,
    registrarPending: registrarM.isPending,
    pular: pularM.mutate,
    callState,
    callStart,
    callEnd,
    startCall,
    endCall,
    resetCorretor: () => {
      setCurrent(null);
      setLockConfirmed(false);
      setPrefetched(null);
      setCallState("idle");
      setCallStart(null);
      setCallEnd(null);
      setNoLeadsReason(null);
      setFilters({ empreendimento_ids: [], segmento_ids: [] });
      setOnboardedState(false);
      localStorage.removeItem(STORAGE_KEY_ONBOARDED);
    },
  };
}
