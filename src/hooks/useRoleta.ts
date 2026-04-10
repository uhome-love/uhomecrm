import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { format } from "date-fns";
import { todayBRT } from "@/lib/utils";

// ─── Time Window Logic ───

export type JanelaId = "manha" | "tarde" | "noturna" | "madrugada" | "dia_todo";

// Holiday cache — loaded from database
let _feriadosCache: string[] = [];
let _feriadosCacheExpiry = 0;

async function loadFeriadosFromDB(): Promise<string[]> {
  if (Date.now() < _feriadosCacheExpiry && _feriadosCache.length > 0) return _feriadosCache;
  try {
    const { data } = await supabase.from("feriados").select("data").gte("data", new Date().getFullYear() + "-01-01");
    _feriadosCache = (data || []).map((f: any) => typeof f.data === "string" ? f.data.slice(0, 10) : "");
    _feriadosCacheExpiry = Date.now() + 1000 * 60 * 60; // 1h cache
  } catch { /* fallback to empty */ }
  return _feriadosCache;
}

// Synchronous check using cache (call loadFeriadosFromDB on mount)
export function getBrtDateInfo() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dateStr = brt.toISOString().slice(0, 10);
  return {
    brt,
    dateStr,
    isSunday: brt.getDay() === 0,
    isHoliday: _feriadosCache.includes(dateStr),
  };
}

export function isSundayBRT(): boolean {
  return getBrtDateInfo().isSunday;
}

export function isHolidayBRT(): boolean {
  return getBrtDateInfo().isHoliday;
}

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
  { id: "manha", label: "Manhã", emoji: "🌅", inicio: "07:30", fim: "12:00", credenciamentoAberto: false, descricao: "Roleta da manhã ativa" },
  { id: "tarde", label: "Tarde", emoji: "🌞", inicio: "12:00", fim: "18:30", credenciamentoAberto: false, descricao: "Roleta da tarde ativa" },
  { id: "noturna", label: "Noturna", emoji: "🌙", inicio: "18:30", fim: "23:30", credenciamentoAberto: false, descricao: "Roleta noturna ativa" },
  { id: "madrugada", label: "Madrugada", emoji: "🔒", inicio: "23:30", fim: "07:30", credenciamentoAberto: false, descricao: "Acumulando leads para amanhã" },
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
  const { brt: brtNow, isSunday, isHoliday } = getBrtDateInfo();
  const mins = getMinutesFromMidnight(brtNow.getHours(), brtNow.getMinutes());

  const isSaturday = brtNow.getDay() === 6;

  // Janelas de distribuição:
  // Domingo e feriado: dia todo
  // Seg-Sáb: manhã, tarde e noturna

  const t0730 = parseTime("07:30");
  const t0930_cred = isSaturday ? parseTime("10:30") : parseTime("09:30");
  const t1200 = parseTime("12:00");
  const t1330 = parseTime("13:30");
  const t1830 = parseTime("18:30");
  const t2000 = parseTime("20:00");
  const t2330 = parseTime("23:30");

  const credManhaFimLabel = isSaturday ? "10:30" : "09:30";

  let janela: JanelaId;
  let descricao: string;
  let emoji: string;
  let credenciamentoAberto = false;
  let credenciamentoJanela: JanelaId | null = null;
  let nextTransitionMins: number;

  if (isSunday || isHoliday) {
    const t0800 = parseTime("08:00");

    if (mins < t0800) {
      janela = "madrugada";
      emoji = "🌅";
      descricao = `${isHoliday ? "Feriado" : "Domingo"} · Roleta abre às 08:00`;
      nextTransitionMins = t0800;
    } else if (mins < t2330) {
      janela = "dia_todo";
      emoji = "☀️";
      descricao = `${isHoliday ? "Feriado" : "Domingo"} · Roleta aberta até 23:30`;
      credenciamentoAberto = true;
      credenciamentoJanela = "dia_todo";
      nextTransitionMins = t2330;
    } else {
      janela = "madrugada";
      emoji = "🔒";
      descricao = `${isHoliday ? "Feriado" : "Domingo"} · Roleta encerrada`;
      nextTransitionMins = 24 * 60;
    }
  } else if (mins < t0730) {
    janela = "madrugada";
    emoji = "🌅";
    descricao = "Acumulando leads · Credenciamento manhã abre às 07:30";
    nextTransitionMins = t0730;
  } else if (mins < t0930_cred) {
    janela = "manha";
    emoji = "☀️";
    descricao = `Roleta da manhã ativa · Cred aberto até ${credManhaFimLabel}`;
    credenciamentoAberto = true;
    credenciamentoJanela = "manha";
    nextTransitionMins = t0930_cred;
  } else if (mins < t1200) {
    janela = "manha";
    emoji = "☀️";
    descricao = "Manhã ativa · Cred manhã encerrado · Cred tarde abre às 12h";
    nextTransitionMins = t1200;
  } else if (mins < t1330) {
    janela = "tarde";
    emoji = "🌞";
    descricao = "Cred tarde aberto até 13:30";
    credenciamentoAberto = true;
    credenciamentoJanela = "tarde";
    nextTransitionMins = t1330;
  } else if (mins < t1830) {
    janela = "tarde";
    emoji = "🌞";
    descricao = "Roleta da tarde ativa";
    nextTransitionMins = t1830;
  } else if (mins < t2000) {
    janela = "noturna";
    emoji = "🌙";
    descricao = "Roleta noturna ativa · Cred noturno aberto até 20:00";
    credenciamentoAberto = true;
    credenciamentoJanela = "noturna";
    nextTransitionMins = t2000;
  } else if (mins < t2330) {
    janela = "noturna";
    emoji = "🌙";
    descricao = "Roleta noturna ativa · Cred encerrado";
    nextTransitionMins = t2330;
  } else {
    janela = "madrugada";
    emoji = "🔒";
    descricao = "Roleta encerrada · Leads acumulando para amanhã";
    nextTransitionMins = 24 * 60;
  }

  const proximaTransicao = new Date(now);
  const diffMins = nextTransitionMins - mins;
  proximaTransicao.setMinutes(proximaTransicao.getMinutes() + diffMins);
  proximaTransicao.setSeconds(0);

  return {
    janela,
    label: janela === "dia_todo" ? "Dia Todo" : janela === "madrugada" ? "Madrugada" : janela === "manha" ? "Manhã" : janela === "tarde" ? "Tarde" : "Noturna",
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

  const hoje = todayBRT();

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
    const profileMap = new Map((profiles as any[])?.map((p: any) => [p.id, p]) || []);

    setCredenciamentos(creds.map(c => ({
      ...c,
      corretor_nome: c.corretor_id ? (profileMap.get(c.corretor_id) as any)?.nome || "Corretor" : "Corretor",
      corretor_avatar: c.corretor_id ? (profileMap.get(c.corretor_id) as any)?.avatar_url || null : null,
    })));
  }, [hoje]);

  // Load fila for today — enriched with REAL lead counts from pipeline_leads
  // Only shows entries for the CURRENT janela (shift window), except Sunday (all)
  const loadFila = useCallback(async () => {
    const windowInfo = getCurrentWindowInfo();
    const currentJanela = windowInfo.janela;
    const { isSunday, isHoliday } = getBrtDateInfo();
    const isAllDay = isSunday || isHoliday;

    let query = supabase
      .from("roleta_fila")
      .select("*")
      .eq("data", hoje)
      .eq("ativo", true);
    
    // On Sunday/holiday, show all janelas; otherwise filter by current
    if (!isAllDay) {
      query = query.eq("janela", currentJanela);
    }

    const { data: filaData } = await query;

    if (!filaData?.length) { setFila([]); return; }

    const profileIds = [...new Set(filaData.map(f => f.corretor_id).filter(Boolean))] as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome, avatar_url, user_id")
      .in("id", profileIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Get auth user IDs to count ONLY roleta-distributed leads (not manual transfers)
    const authUserIds = (profiles || []).map(p => p.user_id).filter(Boolean) as string[];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Count leads distributed via roleta TODAY per corretor (acao='distribuido' only)
    const { data: todayDistribuicoes } = authUserIds.length > 0
      ? await supabase
          .from("distribuicao_historico")
          .select("corretor_id")
          .in("corretor_id", authUserIds)
          .eq("acao", "distribuido")
          .gte("created_at", todayStart.toISOString())
      : { data: [] };

    // Build count map: auth_user_id → count
    const authLeadCount = new Map<string, number>();
    for (const l of todayDistribuicoes || []) {
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
      corretor_nome: f.corretor_id ? (profileMap.get(f.corretor_id) as any)?.nome || "Corretor" : "Corretor",
      corretor_avatar: f.corretor_id ? (profileMap.get(f.corretor_id) as any)?.avatar_url || null : null,
    }));

    // Sort by ultima_distribuicao_at ASC NULLS FIRST — matches the SQL engine's round-robin order
    enriched.sort((a, b) => {
      const aTime = (a as any).ultima_distribuicao_at;
      const bTime = (b as any).ultima_distribuicao_at;
      if (!aTime && !bTime) return 0;
      if (!aTime) return -1;
      if (!bTime) return 1;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

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
    loadFeriadosFromDB().then(() => Promise.all([loadSegmentos(), loadCredenciamentos(), loadFila(), loadDistribuicoes()]))
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

      // Add to fila for each segmento via atomic RPC
      const segmentoIds = [cred.segmento_1_id, cred.segmento_2_id].filter(Boolean) as string[];
      for (const segId of segmentoIds) {
        await supabase.rpc("upsert_roleta_fila" as any, {
          p_corretor_id: cred.corretor_id,
          p_segmento_id: segId,
          p_janela: cred.janela,
          p_data: hoje,
          p_credenciamento_id: credId,
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

  // CEO: Include any corretor manually in the fila (bypasses credenciamento) — auto-approved
  const incluirManualNaFila = useCallback(async (corretorProfileId: string, segmentoId: string, janela: JanelaId) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const ceoProfileId = await getProfileId();
      if (!ceoProfileId) throw new Error("Perfil não encontrado");

      let credId: string | null = null;

      // Check if there's already a credenciamento for this corretor+data+janela
      const { data: existingCred } = await supabase.from("roleta_credenciamentos")
        .select("id, segmento_1_id, segmento_2_id, status")
        .eq("corretor_id", corretorProfileId)
        .eq("data", hoje)
        .eq("janela", janela)
        .limit(1);

      if (existingCred && existingCred.length > 0) {
        const cred = existingCred[0];
        if (cred.status === "aprovado") {
          // Already approved — just ensure segmento is added
          if (cred.segmento_1_id !== segmentoId && cred.segmento_2_id !== segmentoId) {
            const updateFields: Record<string, unknown> = {};
            if (!cred.segmento_1_id) updateFields.segmento_1_id = segmentoId;
            else updateFields.segmento_2_id = segmentoId;
            await supabase.from("roleta_credenciamentos").update(updateFields).eq("id", cred.id);
          }
          credId = cred.id;
        } else {
          // Update to approved directly
          const updateFields: Record<string, unknown> = {
            saiu_em: null,
            status: "aprovado",
            aprovado_por: ceoProfileId,
            aprovado_em: new Date().toISOString(),
          };
          if (cred.segmento_1_id !== segmentoId && cred.segmento_2_id !== segmentoId) {
            if (!cred.segmento_1_id) updateFields.segmento_1_id = segmentoId;
            else updateFields.segmento_2_id = segmentoId;
          }
          await supabase.from("roleta_credenciamentos").update(updateFields).eq("id", cred.id);
          credId = cred.id;
        }
      } else {
        // Create new credenciamento as approved
        const { data: newCred } = await supabase.from("roleta_credenciamentos").insert({
          corretor_id: corretorProfileId,
          data: hoje,
          janela,
          segmento_1_id: segmentoId,
          status: "aprovado",
          aprovado_por: ceoProfileId,
          aprovado_em: new Date().toISOString(),
        }).select("id").single();
        credId = newCred?.id || null;
      }

      // Add to roleta_fila via atomic RPC
      if (credId) {
        await supabase.rpc("upsert_roleta_fila" as any, {
          p_corretor_id: corretorProfileId,
          p_segmento_id: segmentoId,
          p_janela: janela,
          p_data: hoje,
          p_credenciamento_id: credId,
        });
      }

      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", corretorProfileId).single();
      toast.success(`${profile?.nome || "Corretor"} aprovado e adicionado à fila!`);
      await Promise.all([loadCredenciamentos(), loadFila()]);
    } catch (e: any) {
      toast.error("Erro ao incluir na fila.");
    } finally {
      setSubmitting(false);
    }
  }, [user, hoje, loadCredenciamentos, loadFila, getProfileId]);

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
    incluirManualNaFila,
    reload: () => Promise.all([loadCredenciamentos(), loadFila(), loadDistribuicoes()]),
  };
}
