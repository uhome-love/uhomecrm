/**
 * useMutiraoSession — hook central do "Mutirão Inteligente" (Oferta Ativa Ao Vivo).
 * Cuida da sessão ao vivo, próximo lead, lock, resultados e heartbeat.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Balde = "verde_hot" | "verde" | "amarelo";
export type Resultado = "nao_atendeu" | "sem_interesse" | "aproveitado" | "visita_agendada";

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
}

const STORAGE_KEY_FILTERS = "mutirao:filters";
const STORAGE_KEY_ONBOARDED = "mutirao:onboarded";

export function useMutiraoSession() {
  const qc = useQueryClient();

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

  // Filtros persistidos
  const [filters, setFiltersState] = useState<{ empreendimento_ids: string[]; segmento_ids: string[] }>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_FILTERS) || "") || { empreendimento_ids: [], segmento_ids: [] };
    } catch {
      return { empreendimento_ids: [], segmento_ids: [] };
    }
  });
  const setFilters = useCallback((f: typeof filters) => {
    setFiltersState(f);
    localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(f));
  }, []);

  const [onboarded, setOnboardedState] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY_ONBOARDED) === "1");
  const setOnboarded = useCallback((v: boolean) => {
    setOnboardedState(v);
    if (v) localStorage.setItem(STORAGE_KEY_ONBOARDED, "1");
  }, []);

  // Lead atual (client-side state)
  const [current, setCurrent] = useState<{ fila_id: string; balde: Balde; lead: LeadOferta; locked_until?: string } | null>(null);

  // Chamada de ligação (client timer)
  const [callState, setCallState] = useState<"idle" | "in_call" | "ended">("idle");
  const [callStart, setCallStart] = useState<number | null>(null);
  const [callEnd, setCallEnd] = useState<number | null>(null);

  const proximoLeadM = useMutation({
    mutationFn: async (opts?: { skipCurrent?: boolean }) => {
      if (!sessaoId) throw new Error("Nenhuma sessão ao vivo agora");
      // Se pulando, primeiro libera o lock atual como nao_atendeu silencioso? Requisito: "não repete pro corretor"
      // -> tratamos como pular: chamamos registrar-resultado skip via 'nao_atendeu' — mas isso conta ligação.
      // Mais correto: apenas soltar o lock e marcar ultimo_corretor_id como já eu (para evitar repetição).
      // Implementação: chamamos edge com body {sessao_id, ..., filtros}. Skip trata no client removendo o current e liberando lock via update direto.
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
        setCurrent({ fila_id: data.fila_id, balde: (data.balde ?? "verde") as Balde, lead: data.lead, locked_until: data.locked_until });
        setCallState("idle");
        setCallStart(null);
        setCallEnd(null);
      } else {
        setCurrent(null);
        toast.info(data?.reason === "fila_vazia" ? "Fila vazia por enquanto" : "Sem leads disponíveis com esses filtros");
      }
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao buscar próximo lead"),
  });

  const registrarM = useMutation({
    mutationFn: async (payload: {
      resultado: Resultado;
      observacao?: string;
      motivo_perda?: string;
      visita_payload?: any;
    }) => {
      if (!sessaoId || !current) throw new Error("Sem lead ativo");
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
      qc.invalidateQueries({ queryKey: ["mutirao", "reaproveitar"] });
      if (data?.bateu_meta) toast.success("🏆 Você bateu uma meta!");
      // Auto-next
      setCurrent(null);
      setCallState("idle");
      setTimeout(() => proximoLeadM.mutate(undefined), 250);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar resultado"),
  });

  // Pular: libera lock via update direto (o próprio corretor detém o lock; RLS permite update em fila? Não — fila só service_role).
  // Alternativa: chamamos registrar-resultado com nao_atendeu, o cooldown de 1h evita repetição a curto prazo.
  const pularM = useMutation({
    mutationFn: async () => {
      if (!current) return;
      await registrarM.mutateAsync({ resultado: "nao_atendeu", observacao: "[Pulado sem ligar]" });
    },
  });

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
    proximoLead: proximoLeadM.mutate,
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
