import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

// ─── Types ───
export interface OALista {
  id: string;
  nome: string;
  empreendimento: string;
  campanha: string | null;
  origem: string | null;
  status: string;
  max_tentativas: number;
  cooldown_dias: number;
  total_leads: number;
  criado_por: string;
  created_at: string;
  updated_at: string;
}

export interface OALead {
  id: string;
  lista_id: string;
  nome: string;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
  telefone_normalizado: string | null;
  empreendimento: string | null;
  campanha: string | null;
  origem: string | null;
  data_lead: string | null;
  observacoes: string | null;
  status: string;
  motivo_descarte: string | null;
  corretor_id: string | null;
  jetimob_id: string | null;
  cadastrado_jetimob: boolean;
  cadastrado_jetimob_em: string | null;
  tentativas_count: number;
  ultima_tentativa: string | null;
  proxima_tentativa_apos: string | null;
  created_at: string;
  updated_at: string;
}

export interface OATentativa {
  id: string;
  lead_id: string;
  corretor_id: string;
  lista_id: string | null;
  empreendimento: string | null;
  canal: string;
  resultado: string;
  feedback: string;
  pontos: number;
  created_at: string;
}

export interface OATemplate {
  id: string;
  empreendimento: string | null;
  tipo: string;
  canal: string;
  titulo: string;
  conteudo: string;
  criado_por: string;
  created_at: string;
}

// ─── Normalization ───
export function normalizeTelefone(tel: string | null | undefined): string {
  if (!tel) return "";
  const digits = tel.replace(/\D/g, "");
  // Remove country code 55 if present
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

// ─── Hook: Listas ───
export function useOAListas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: listas = [], isLoading } = useQuery({
    queryKey: ["oa-listas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oferta_ativa_listas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OALista[];
    },
    enabled: !!user,
  });

  const createLista = useCallback(async (lista: Partial<OALista>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("oferta_ativa_listas")
      .insert({ ...lista, criado_por: user.id } as any)
      .select()
      .single();
    if (error) { toast.error("Erro ao criar lista"); console.error(error); return null; }
    queryClient.invalidateQueries({ queryKey: ["oa-listas"] });
    return data;
  }, [user, queryClient]);

  const updateLista = useCallback(async (id: string, updates: Partial<OALista>) => {
    const { error } = await supabase
      .from("oferta_ativa_listas")
      .update(updates as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar lista"); return; }
    queryClient.invalidateQueries({ queryKey: ["oa-listas"] });
  }, [queryClient]);

  const deleteLista = useCallback(async (id: string) => {
    // Delete leads first (FK constraint)
    await supabase.from("oferta_ativa_leads").delete().eq("lista_id", id);
    const { error } = await supabase.from("oferta_ativa_listas").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir lista"); return; }
    toast.success("Lista excluída!");
    queryClient.invalidateQueries({ queryKey: ["oa-listas"] });
  }, [queryClient]);

  return { listas, isLoading, createLista, updateLista, deleteLista };
}

// ─── Hook: Leads de uma lista ───
export function useOALeads(listaId?: string) {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["oa-leads", listaId],
    queryFn: async () => {
      let query = supabase.from("oferta_ativa_leads").select("*").order("created_at", { ascending: true });
      if (listaId) query = query.eq("lista_id", listaId);
      const { data, error } = await query;
      if (error) throw error;
      return data as OALead[];
    },
    enabled: !!listaId,
  });

  return { leads, isLoading };
}

// ─── Hook: Server-side lead fetching (atomic lock + anti-repeat + scoring) ───
export function useOAServerQueue(listaId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentLead, setCurrentLead] = useState<OALead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queueEmpty, setQueueEmpty] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch next lead from server (atomic: select + lock in one call)
  const fetchNext = useCallback(async (): Promise<OALead | null> => {
    if (!user) return null;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("fetch_next_lead", {
        p_corretor_id: user.id,
        p_lista_id: listaId,
        p_lock_minutes: 5,
      });
      if (error) { console.error("fetch_next_lead error:", error); return null; }
      const result = data as any;
      if (!result?.found) {
        setQueueEmpty(true);
        setCurrentLead(null);
        return null;
      }
      setQueueEmpty(false);
      const lead = result.lead as OALead;
      setCurrentLead(lead);
      return lead;
    } finally {
      setIsLoading(false);
    }
  }, [user, listaId]);

  // Heartbeat: renew lock every 60s (TTL/3 for 5min lock) + renew on focus
  const renewLock = useCallback(async (leadId: string) => {
    if (!user) return;
    const { data, error } = await supabase.rpc("renew_lead_lock", {
      p_lead_id: leadId,
      p_corretor_id: user.id,
      p_lock_minutes: 5,
    });
    if (error || !(data as any)?.renewed) {
      console.warn("Lock renewal failed for lead", leadId);
    }
  }, [user]);

  const startHeartbeat = useCallback((leadId: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    // Renew immediately, then every 60s
    renewLock(leadId);
    heartbeatRef.current = setInterval(() => renewLock(leadId), 60 * 1000);

    // Renew on window focus (tab switch back)
    const onFocus = () => renewLock(leadId);
    window.addEventListener("focus", onFocus);
    // Store cleanup ref
    (heartbeatRef as any)._focusCleanup = () => window.removeEventListener("focus", onFocus);
  }, [renewLock]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if ((heartbeatRef as any)._focusCleanup) { (heartbeatRef as any)._focusCleanup(); (heartbeatRef as any)._focusCleanup = null; }
  }, []);

  // Release lock
  const unlockLead = useCallback(async (leadId: string) => {
    stopHeartbeat();
    await supabase.from("oferta_ativa_leads").update({
      em_atendimento_por: null,
      em_atendimento_ate: null,
    } as any).eq("id", leadId);
  }, [stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopHeartbeat(); };
  }, [stopHeartbeat]);

  return {
    currentLead,
    setCurrentLead,
    isLoading,
    queueEmpty,
    fetchNext,
    startHeartbeat,
    stopHeartbeat,
    unlockLead,
  };
}

// Keep legacy useOAFila for backward compat (PerformanceLivePanel etc.)
export function useOAFila(listaId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: fila = [], isLoading } = useQuery({
    queryKey: ["oa-fila", listaId],
    queryFn: async () => {
      await supabase.rpc("cleanup_expired_locks");
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("oferta_ativa_leads")
        .select("*")
        .eq("lista_id", listaId)
        .in("status", ["na_fila", "em_cooldown"])
        .or(`proxima_tentativa_apos.is.null,proxima_tentativa_apos.lt.${now}`)
        .order("tentativas_count", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as OALead[];
    },
    enabled: !!listaId && !!user,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const lockLead = useCallback(async (leadId: string): Promise<{ locked: boolean; reason?: string }> => {
    if (!user) return { locked: false, reason: "no_user" };
    const { data, error } = await supabase.rpc("lock_lead_atomic", {
      p_lead_id: leadId, p_corretor_id: user.id, p_lock_minutes: 5,
    });
    if (error) return { locked: false, reason: "error" };
    return data as { locked: boolean; reason?: string };
  }, [user]);

  const unlockLead = useCallback(async (leadId: string) => {
    await supabase.from("oferta_ativa_leads").update({
      em_atendimento_por: null, em_atendimento_ate: null,
    } as any).eq("id", leadId);
  }, []);

  return {
    fila, isLoading, lockLead, unlockLead,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["oa-fila", listaId] }),
  };
}

// ─── Hook: Registrar tentativa (v2 with idempotency + server-side logic) ───
export function useOARegistrarTentativa() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const registrar = useCallback(async (
    lead: OALead,
    canal: string,
    resultado: string,
    feedback: string,
    lista?: OALista,
    idempotencyKey?: string,
    visitaMarcada?: boolean
  ): Promise<{ success: boolean; reason?: string; idempotent?: boolean }> => {
    if (!user) return { success: false, reason: "no_user" };

    // Generate idempotency key if not provided
    const idemKey = idempotencyKey || `${user.id}_${lead.id}_${Date.now()}`;

    const { data, error } = await supabase.rpc("finalizar_tentativa_v2", {
      p_lead_id: lead.id,
      p_corretor_id: user.id,
      p_canal: canal,
      p_resultado: resultado,
      p_feedback: feedback,
      p_lista_id: lead.lista_id,
      p_empreendimento: lead.empreendimento,
      p_idempotency_key: idemKey,
      p_visita_marcada: visitaMarcada ?? false,
    });

    if (error) {
      console.error("finalizar_tentativa_v2 error:", error);
      toast.error("Erro ao registrar tentativa");
      return { success: false, reason: "error" };
    }

    const result = data as any;
    if (!result?.success) {
      if (result?.reason === "already_approved") {
        toast.error("Este lead já foi aproveitado por outro corretor!");
      } else if (result?.reason === "phone_already_approved") {
        toast.error("Um lead com este telefone já foi aproveitado!");
      } else {
        toast.error("Lead indisponível");
      }
      return result;
    }

    // If idempotent (duplicate request), just return success without toasts
    if (result.idempotent) {
      return { success: true, idempotent: true };
    }

    // Invalidate all relevant queries
    queryClient.invalidateQueries({ queryKey: ["oa-fila"] });
    queryClient.invalidateQueries({ queryKey: ["oa-leads"] });
    queryClient.invalidateQueries({ queryKey: ["oa-stats"] });
    queryClient.invalidateQueries({ queryKey: ["oa-ranking"] });
    queryClient.invalidateQueries({ queryKey: ["oa-aproveitados"] });

    if (resultado === "com_interesse") {
      toast.success("🎉 Lead aproveitado com exclusividade!");
    } else {
      toast.success("Tentativa registrada");
    }

    return { success: true };
  }, [user, queryClient]);

  return { registrar };
}

// ─── Hook: Aproveitados do corretor ───
export function useOAAproveitados() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: aproveitados = [], isLoading } = useQuery({
    queryKey: ["oa-aproveitados", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oferta_ativa_leads")
        .select("*")
        .eq("corretor_id", user!.id)
        .eq("status", "aproveitado")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as OALead[];
    },
    enabled: !!user,
  });

  const marcarCadastrado = useCallback(async (id: string, jetimobId?: string) => {
    const updates: Record<string, any> = {
      cadastrado_jetimob: true,
      cadastrado_jetimob_em: new Date().toISOString(),
      status: "concluido",
    };
    if (jetimobId) updates.jetimob_id = jetimobId;
    const { error } = await supabase.from("oferta_ativa_leads").update(updates).eq("id", id);
    if (error) { toast.error("Erro ao marcar"); return; }
    queryClient.invalidateQueries({ queryKey: ["oa-aproveitados"] });
    toast.success("Lead marcado como cadastrado no Jetimob!");
  }, [queryClient]);

  return { aproveitados, isLoading, marcarCadastrado };
}

// ─── Hook: Stats & Ranking ───
export function useOARanking(period: "hoje" | "semana" | "mes" = "hoje") {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["oa-ranking", period],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("get_individual_oa_ranking", {
        p_period: period,
      });
      if (error) throw error;
      const parsed = result as any;
      return {
        ranking: (parsed?.ranking || []) as Array<{
          corretor_id: string;
          nome: string;
          avatar_url: string | null;
          tentativas: number;
          aproveitados: number;
          pontos: number;
          ligacoes: number;
          whatsapps: number;
          emails: number;
        }>,
        totalTentativas: parsed?.total_tentativas || 0,
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  return { ranking: data?.ranking || [], totalTentativas: data?.totalTentativas || 0, isLoading };
}

// ─── Hook: Templates ───
export function useOATemplates(empreendimento?: string) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["oa-templates", empreendimento],
    queryFn: async () => {
      let query = supabase.from("oferta_ativa_templates").select("*").order("tipo");
      if (empreendimento) {
        query = query.or(`empreendimento.eq.${empreendimento},empreendimento.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as OATemplate[];
    },
  });

  return { templates, isLoading };
}

// ─── Import helper ───
export interface LeadImportIndexes {
  existingPhones: Set<string>;
  existingEmails: Set<string>;
}

export async function fetchLeadImportIndexes(): Promise<LeadImportIndexes> {
  const existingPhones = new Set<string>();
  const existingEmails = new Set<string>();

  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: batch } = await supabase
      .from("oferta_ativa_leads")
      .select("telefone_normalizado, email")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (!batch || batch.length === 0) break;

    for (const e of batch) {
      if (e.telefone_normalizado) existingPhones.add(e.telefone_normalizado);
      if (e.email) existingEmails.add(e.email.toLowerCase());
    }

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  return { existingPhones, existingEmails };
}

export async function importLeadsToLista(
  listaId: string,
  empreendimento: string,
  campanha: string | null,
  origem: string | null,
  rows: Array<{
    nome: string;
    telefone?: string;
    telefone2?: string;
    email?: string;
    data_lead?: string;
    observacoes?: string;
    campanha?: string;
    origem?: string;
  }>,
  indexes?: LeadImportIndexes
) {
  // Reuse preloaded indexes when importing multiple lists in sequence
  const { existingPhones, existingEmails } = indexes ?? await fetchLeadImportIndexes();

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const toInsert: any[] = [];
  let dupCount = 0;

  for (const row of rows) {
    const normPhone = normalizeTelefone(row.telefone);
    const normEmail = row.email?.trim().toLowerCase() || "";

    // Check duplicates
    if (normPhone && (existingPhones.has(normPhone) || seenPhones.has(normPhone))) {
      dupCount++;
      continue;
    }
    if (normEmail && (existingEmails.has(normEmail) || seenEmails.has(normEmail))) {
      dupCount++;
      continue;
    }

    if (normPhone) { seenPhones.add(normPhone); existingPhones.add(normPhone); }
    if (normEmail) { seenEmails.add(normEmail); existingEmails.add(normEmail); }

    // Validate phone length (BR mobile)
    const isValidPhone = normPhone.length >= 10 && normPhone.length <= 11;

    // Validate data_lead: must be a valid date or null
    let parsedDate: string | null = null;
    if (row.data_lead) {
      const raw = row.data_lead.trim();
      // Excel serial number detection (e.g. 45367.495833)
      const excelSerial = parseFloat(raw);
      if (!isNaN(excelSerial) && excelSerial > 25000 && excelSerial < 60000 && /^\d+(\.\d+)?$/.test(raw)) {
        // Convert Excel serial to JS Date: Excel epoch is 1899-12-30
        const excelEpoch = new Date(1899, 11, 30);
        const msPerDay = 86400000;
        const jsDate = new Date(excelEpoch.getTime() + excelSerial * msPerDay);
        if (!isNaN(jsDate.getTime())) {
          parsedDate = jsDate.toISOString().split("T")[0];
        }
      } else {
        // Try ISO format, BR format (dd/mm/yyyy), or other common formats
        const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (isoMatch) {
          parsedDate = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        } else if (brMatch) {
          parsedDate = `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
        } else if (usMatch) {
          const yr = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
          parsedDate = `${yr}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
        }
      }
      // If still invalid or NaN date, discard
      if (parsedDate && isNaN(new Date(parsedDate).getTime())) {
        parsedDate = null;
      }
    }

    toInsert.push({
      lista_id: listaId,
      nome: row.nome?.trim() || "Sem nome",
      telefone: row.telefone?.trim() || null,
      telefone2: row.telefone2?.trim() || null,
      email: row.email?.trim() || null,
      telefone_normalizado: isValidPhone ? normPhone : null,
      empreendimento,
      campanha: row.campanha || campanha,
      origem: row.origem || origem,
      data_lead: parsedDate,
      observacoes: row.observacoes || null,
      status: isValidPhone ? "na_fila" : "descartado",
      motivo_descarte: isValidPhone ? null : "telefone_invalido",
    });
  }

  // Batch insert (max 500 at a time)
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500);
    const { error } = await supabase.from("oferta_ativa_leads").insert(batch);
    if (error) { console.error("Batch insert error:", error.message, error.details, error.hint); toast.error(`Erro ao importar batch ${Math.floor(i/500)+1}: ${error.message}`); }
    else inserted += batch.length;
  }

  // Fix: Fetch current total and ADD inserted count (not overwrite)
  const { data: currentLista } = await supabase
    .from("oferta_ativa_listas")
    .select("total_leads")
    .eq("id", listaId)
    .single();
  const currentTotal = currentLista?.total_leads || 0;

  await supabase.from("oferta_ativa_listas").update({
    total_leads: currentTotal + inserted,
  } as any).eq("id", listaId);

  return { inserted, duplicates: dupCount, invalid: toInsert.filter(l => l.status === "descartado").length };
}
