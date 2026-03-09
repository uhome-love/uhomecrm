import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Time Window Logic ───

export type JanelaId = "manha" | "tarde" | "noturna" | "madrugada";

interface JanelaInfo {
  id: JanelaId;
  label: string;
  emoji: string;
  inicio: string; // HH:mm
  fim: string;    // HH:mm
  credenciamentoAberto: boolean;
  descricao: string;
}

const JANELAS: JanelaInfo[] = [
  { id: "manha", label: "Manhã", emoji: "🌅", inicio: "09:30", fim: "13:30", credenciamentoAberto: false, descricao: "Roleta da manhã ativa" },
  { id: "tarde", label: "Tarde", emoji: "🌞", inicio: "13:30", fim: "18:00", credenciamentoAberto: false, descricao: "Roleta da tarde ativa" },
  { id: "noturna", label: "Noturna", emoji: "🌙", inicio: "18:00", fim: "23:30", credenciamentoAberto: false, descricao: "Roleta noturna ativa" },
  { id: "madrugada", label: "Madrugada", emoji: "🔒", inicio: "23:30", fim: "09:30", credenciamentoAberto: false, descricao: "Acumulando leads para amanhã" },
];

function getMinutesFromMidnight(h: number, m: number) {
  return h * 60 + m;
}

function parseTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return getMinutesFromMidnight(h, m);
}

export function getCurrentWindowInfo(): {
  janela: JanelaId;
  label: string;
  emoji: string;
  descricao: string;
  credenciamentoAberto: boolean;
  credenciamentoJanela: JanelaId | null;
  proximaTransicao: Date;
  minutosRestantes: number;
} {
  const now = new Date();
  const mins = getMinutesFromMidnight(now.getHours(), now.getMinutes());

  // TODO: TEMPORÁRIO - ajustar horários após período de teste
  // Janelas de distribuição:
  // Manhã:   10:00 — 12:00 (cred 00:00-10:00)
  // Tarde:   13:30 — 18:00 (cred 12:00-13:30)
  // Noturna: 18:00 — 23:59 (cred 18:00+, com requisitos)
  // Madrugada: 00:00 — 10:00 (acumulando)

  const t1000 = parseTime("10:00");
  const t1200 = parseTime("12:00");
  const t1330 = parseTime("13:30");
  const t1800 = parseTime("18:00");

  let janela: JanelaId;
  let descricao: string;
  let emoji: string;
  let credenciamentoAberto = false;
  let credenciamentoJanela: JanelaId | null = null;
  let nextTransitionMins: number;

  // Credenciamento manhã SEMPRE aberto (qualquer horário)
  credenciamentoAberto = true;
  credenciamentoJanela = "manha";

  if (mins < t1000) {
    // 00:00 — 10:00: Madrugada/acúmulo.
    janela = "madrugada";
    emoji = "🌅";
    descricao = "Credenciamento manhã aberto";
    nextTransitionMins = t1000;
  } else if (mins < t1200) {
    // 10:00 — 12:00: Manhã ativa.
    janela = "manha";
    emoji = "☀️";
    descricao = "Roleta da manhã ativa · Cred manhã aberto";
    nextTransitionMins = t1200;
  } else if (mins < t1330) {
    // 12:00 — 13:30: Intervalo, cred tarde aberto.
    janela = "manha";
    emoji = "☀️";
    descricao = "Cred manhã e tarde abertos";
    credenciamentoJanela = "tarde";
    nextTransitionMins = t1330;
  } else if (mins < t1800) {
    // 13:30 — 18:00: Tarde ativa.
    janela = "tarde";
    emoji = "🌞";
    descricao = "Roleta da tarde ativa · Cred manhã aberto";
    nextTransitionMins = t1800;
  } else {
    // 18:00 — 23:59: Noturna.
    janela = "noturna";
    emoji = "🌙";
    descricao = "Roleta noturna ativa · Cred manhã e noturna abertos";
    credenciamentoJanela = "noturna";
    nextTransitionMins = 24 * 60; // midnight
  }

  const proximaTransicao = new Date(now);
  const diffMins = nextTransitionMins - mins;
  proximaTransicao.setMinutes(proximaTransicao.getMinutes() + diffMins);
  proximaTransicao.setSeconds(0);

  return {
    janela,
    label: janela === "madrugada" ? "Madrugada" : janela === "manha" ? "Manhã" : janela === "tarde" ? "Tarde" : "Noturna",
    emoji,
    descricao,
    credenciamentoAberto,
    credenciamentoJanela,
    proximaTransicao,
    minutosRestantes: Math.max(0, diffMins),
  };
}

// ─── Types ───

export interface RoletaSegmento {
  id: string;
  nome: string;
  descricao: string | null;
  faixa_preco: string | null;
  campanhas: string[];
}

export interface RoletaCredenciamento {
  id: string;
  corretor_id: string | null;
  janela: string;
  segmento_1_id: string | null;
  segmento_2_id: string | null;
  status: string | null;
  data: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  saiu_em: string | null;
  created_at: string | null;
  corretor_nome?: string;
  corretor_avatar?: string | null;
}

export interface RoletaFilaItem {
  id: string;
  corretor_id: string | null;
  segmento_id: string | null;
  janela: string;
  posicao: number;
  leads_recebidos: number | null;
  ativo: boolean | null;
  data: string;
  corretor_nome?: string;
  corretor_avatar?: string | null;
}

export interface RoletaDistribuicao {
  id: string;
  lead_id: string | null;
  corretor_id: string | null;
  segmento_id: string | null;
  janela: string;
  status: string | null;
  enviado_em: string | null;
  expira_em: string | null;
  aceito_em: string | null;
  primeira_interacao_em: string | null;
  lead_nome?: string;
  corretor_nome?: string;
  segmento_nome?: string;
}

// ─── Hook ───

export function useRoleta() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [segmentos, setSegmentos] = useState<RoletaSegmento[]>([]);
  const [credenciamentos, setCredenciamentos] = useState<RoletaCredenciamento[]>([]);
  const [fila, setFila] = useState<RoletaFilaItem[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<RoletaDistribuicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const hoje = format(new Date(), "yyyy-MM-dd");

  // Load profile ID (profiles.id != auth user.id)
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfileId(data.id); });
  }, [user]);

  // Load segmentos + campanhas
  const loadSegmentos = useCallback(async () => {
    const { data: segs } = await supabase
      .from("roleta_segmentos")
      .select("id, nome, descricao, faixa_preco, ativo")
      .eq("ativo", true);
    const { data: camps } = await supabase
      .from("roleta_campanhas")
      .select("id, empreendimento, segmento_id, ativo")
      .eq("ativo", true);

    const mapped = (segs || []).map(s => ({
      id: s.id,
      nome: s.nome,
      descricao: s.descricao,
      faixa_preco: s.faixa_preco,
      campanhas: (camps || []).filter(c => c.segmento_id === s.id).map(c => c.empreendimento),
    }));
    setSegmentos(mapped);
  }, []);

  // Load credenciamentos for today
  const loadCredenciamentos = useCallback(async () => {
    const { data: creds } = await supabase
      .from("roleta_credenciamentos")
      .select("*")
      .eq("data", hoje)
      .order("created_at", { ascending: true });

    if (!creds?.length) { setCredenciamentos([]); return; }

    const userIds = [...new Set(creds.map(c => c.corretor_id).filter(Boolean))] as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome, avatar_url")
      .in("id", userIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    setCredenciamentos(creds.map(c => ({
      ...c,
      corretor_nome: c.corretor_id ? profileMap.get(c.corretor_id)?.nome || "Corretor" : "Corretor",
      corretor_avatar: c.corretor_id ? profileMap.get(c.corretor_id)?.avatar_url || null : null,
    })));
  }, [hoje]);

  // Load fila for today — enriched with REAL lead counts from pipeline_leads
  const loadFila = useCallback(async () => {
    const { data: filaData } = await supabase
      .from("roleta_fila")
      .select("*")
      .eq("data", hoje)
      .eq("ativo", true);

    if (!filaData?.length) { setFila([]); return; }

    const profileIds = [...new Set(filaData.map(f => f.corretor_id).filter(Boolean))] as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome, avatar_url, user_id")
      .in("id", profileIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Get auth user IDs to count real leads from pipeline_leads
    const authUserIds = (profiles || []).map(p => p.user_id).filter(Boolean) as string[];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Count leads received TODAY per auth user (only aceito + pendente = actually assigned)
    const { data: todayLeads } = authUserIds.length > 0
      ? await supabase
          .from("pipeline_leads")
          .select("corretor_id")
          .in("corretor_id", authUserIds)
          .gte("distribuido_em", todayStart.toISOString())
          .in("aceite_status", ["aceito", "pendente"])
      : { data: [] };

    // Build count map: auth_user_id → count
    const authLeadCount = new Map<string, number>();
    for (const l of todayLeads || []) {
      authLeadCount.set(l.corretor_id, (authLeadCount.get(l.corretor_id) || 0) + 1);
    }
    // Map profile_id → real lead count
    const profileLeadCount = new Map<string, number>();
    for (const p of profiles || []) {
      profileLeadCount.set(p.id, p.user_id ? (authLeadCount.get(p.user_id) || 0) : 0);
    }

    const enriched = filaData.map(f => ({
      ...f,
      leads_recebidos: f.corretor_id ? profileLeadCount.get(f.corretor_id) ?? (f.leads_recebidos || 0) : 0,
      corretor_nome: f.corretor_id ? profileMap.get(f.corretor_id)?.nome || "Corretor" : "Corretor",
      corretor_avatar: f.corretor_id ? profileMap.get(f.corretor_id)?.avatar_url || null : null,
    }));

    // Sort by leads_recebidos ascending (fewer leads = higher priority = top of list)
    enriched.sort((a, b) => (a.leads_recebidos || 0) - (b.leads_recebidos || 0));

    setFila(enriched);
  }, [hoje]);

  // Load recent distributions
  const loadDistribuicoes = useCallback(async () => {
    const { data: dists } = await supabase
      .from("roleta_distribuicoes")
      .select("*")
      .order("enviado_em", { ascending: false })
      .limit(50);

    if (!dists?.length) { setDistribuicoes([]); return; }

    // Get lead names
    const leadIds = [...new Set(dists.map(d => d.lead_id).filter(Boolean))] as string[];
    const corretorIds = [...new Set(dists.map(d => d.corretor_id).filter(Boolean))] as string[];
    const segIds = [...new Set(dists.map(d => d.segmento_id).filter(Boolean))] as string[];

    const [leadsRes, profilesRes, segsRes] = await Promise.all([
      leadIds.length > 0 ? supabase.from("pipeline_leads").select("id, nome").in("id", leadIds) : { data: [] },
      corretorIds.length > 0 ? supabase.from("profiles").select("id, nome").in("id", corretorIds) : { data: [] },
      segIds.length > 0 ? supabase.from("roleta_segmentos").select("id, nome").in("id", segIds) : { data: [] },
    ]);

    const leadMap = new Map((leadsRes.data || []).map(l => [l.id, l.nome]));
    const profMap = new Map((profilesRes.data || []).map(p => [p.id, p.nome]));
    const segMap = new Map((segsRes.data || []).map(s => [s.id, s.nome]));

    setDistribuicoes(dists.map(d => ({
      ...d,
      lead_nome: d.lead_id ? leadMap.get(d.lead_id) || "Lead" : "Lead",
      corretor_nome: d.corretor_id ? profMap.get(d.corretor_id) || "Corretor" : "—",
      segmento_nome: d.segmento_id ? segMap.get(d.segmento_id) || "—" : "—",
    })));
  }, []);

  // Initial load
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadSegmentos(), loadCredenciamentos(), loadFila(), loadDistribuicoes()])
      .finally(() => setLoading(false));
  }, [user, loadSegmentos, loadCredenciamentos, loadFila, loadDistribuicoes]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("roleta-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "roleta_credenciamentos" }, () => {
        loadCredenciamentos();
        loadFila();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "roleta_fila" }, () => { loadFila(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "roleta_distribuicoes" }, () => { loadDistribuicoes(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadCredenciamentos, loadFila, loadDistribuicoes]);

  // ─── Corretor Actions ───

  const credenciar = useCallback(async (janela: string, segmento1Id: string, segmento2Id: string | null) => {
    if (!user || !profileId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("roleta_credenciamentos").upsert({
        corretor_id: profileId,
        janela,
        segmento_1_id: segmento1Id,
        segmento_2_id: segmento2Id || null,
        data: hoje,
        status: "pendente",
      } as any, {
        onConflict: "corretor_id,data,janela",
      });
      if (error) throw error;
      toast.success("Credenciamento enviado! Aguardando aprovação.");
      await loadCredenciamentos();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao se credenciar: " + (e.message || ""));
    } finally {
      setSubmitting(false);
    }
  }, [user, profileId, hoje, loadCredenciamentos]);

  const sairDaRoleta = useCallback(async (credenciamentoId: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await supabase.from("roleta_credenciamentos")
        .update({ status: "saiu", saiu_em: new Date().toISOString() })
        .eq("id", credenciamentoId);
      // Deactivate from fila
      await supabase.from("roleta_fila")
        .update({ ativo: false })
        .eq("credenciamento_id", credenciamentoId);
      toast.success("Você saiu da roleta.");
      await Promise.all([loadCredenciamentos(), loadFila()]);
    } catch (e: any) {
      toast.error("Erro ao sair da roleta.");
    } finally {
      setSubmitting(false);
    }
  }, [user, loadCredenciamentos, loadFila]);

  // ─── CEO Actions ───

  const getProfileId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    return data?.id || null;
  }, [user]);

  const aprovarCredenciamento = useCallback(async (credId: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const profileId = await getProfileId();
      if (!profileId) throw new Error("Perfil não encontrado");

      // Approve
      const { data: cred } = await supabase.from("roleta_credenciamentos")
        .update({ status: "aprovado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
        .eq("id", credId)
        .select()
        .single();

      if (!cred) throw new Error("Credenciamento não encontrado");

      // Add to fila for each segmento (skip if already in fila for that segmento today)
      const segmentoIds = [cred.segmento_1_id, cred.segmento_2_id].filter(Boolean) as string[];
      for (const segId of segmentoIds) {
        // Check if corretor already has an ACTIVE entry for this segmento today
        const { data: alreadyActive } = await supabase.from("roleta_fila")
          .select("id")
          .eq("data", hoje)
          .eq("segmento_id", segId)
          .eq("corretor_id", cred.corretor_id)
          .eq("ativo", true)
          .limit(1);

        if (alreadyActive && alreadyActive.length > 0) continue;

        // Check if there's an INACTIVE entry we can reactivate
        const { data: inactiveEntry } = await supabase.from("roleta_fila")
          .select("id")
          .eq("data", hoje)
          .eq("segmento_id", segId)
          .eq("corretor_id", cred.corretor_id)
          .eq("ativo", false)
          .limit(1);

        if (inactiveEntry && inactiveEntry.length > 0) {
          // Reactivate existing entry
          await supabase.from("roleta_fila")
            .update({ ativo: true, credenciamento_id: credId })
            .eq("id", inactiveEntry[0].id);
          continue;
        }

        // Create new entry
        const { data: existing } = await supabase.from("roleta_fila")
          .select("posicao")
          .eq("data", hoje)
          .eq("segmento_id", segId)
          .eq("ativo", true)
          .order("posicao", { ascending: false })
          .limit(1);

        const nextPos = (existing?.[0]?.posicao || 0) + 1;

        await supabase.from("roleta_fila").insert({
          corretor_id: cred.corretor_id,
          segmento_id: segId,
          janela: cred.janela,
          posicao: nextPos,
          data: hoje,
          ativo: true,
          credenciamento_id: credId,
        });
      }

      toast.success("Corretor aprovado e adicionado à fila!");
      await Promise.all([loadCredenciamentos(), loadFila()]);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao aprovar: " + (e.message || ""));
    } finally {
      setSubmitting(false);
    }
  }, [user, hoje, loadCredenciamentos, loadFila, getProfileId]);

  const recusarCredenciamento = useCallback(async (credId: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const profileId = await getProfileId();
      await supabase.from("roleta_credenciamentos")
        .update({ status: "recusado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
        .eq("id", credId);
      toast.success("Credenciamento recusado.");
      await loadCredenciamentos();
    } catch (e: any) {
      toast.error("Erro ao recusar.");
    } finally {
      setSubmitting(false);
    }
  }, [user, loadCredenciamentos]);

  const aprovarTodos = useCallback(async () => {
    const pendentes = credenciamentos.filter(c => c.status === "pendente");
    for (const c of pendentes) {
      await aprovarCredenciamento(c.id);
    }
  }, [credenciamentos, aprovarCredenciamento]);

  const removerDaFila = useCallback(async (filaId: string) => {
    if (!user) return;
    try {
      await supabase.from("roleta_fila").update({ ativo: false }).eq("id", filaId);
      toast.success("Corretor removido da fila.");
      await loadFila();
    } catch (e: any) {
      toast.error("Erro ao remover da fila.");
    }
  }, [user, loadFila]);

  // Current corretor's credenciamento
  const meuCredenciamento = useMemo(() => {
    if (!profileId) return null;
    return credenciamentos.find(c => c.corretor_id === profileId && c.data === hoje && c.status !== "recusado" && c.status !== "saiu") || null;
  }, [profileId, credenciamentos, hoje]);

  // Pending count
  const pendentesCount = useMemo(() => {
    return credenciamentos.filter(c => c.status === "pendente").length;
  }, [credenciamentos]);

  // Leads acumulados (simplified: pipeline_leads without corretor from overnight)
  const [leadsAcumulados, setLeadsAcumulados] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("pipeline_leads")
      .select("id", { count: "exact", head: true })
      .is("corretor_id", null)
      .then(({ count }) => setLeadsAcumulados(count || 0));
  }, [isAdmin]);

  return {
    segmentos,
    credenciamentos,
    fila,
    distribuicoes,
    loading,
    submitting,
    meuCredenciamento,
    pendentesCount,
    leadsAcumulados,
    credenciar,
    sairDaRoleta,
    aprovarCredenciamento,
    recusarCredenciamento,
    aprovarTodos,
    removerDaFila,
    reload: () => Promise.all([loadCredenciamentos(), loadFila(), loadDistribuicoes()]),
  };
}
