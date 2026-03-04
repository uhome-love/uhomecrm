import { useState, useCallback } from "react";
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

// ─── Hook: Fila do corretor ───
export function useOAFila(listaId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: fila = [], isLoading } = useQuery({
    queryKey: ["oa-fila", listaId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("oferta_ativa_leads")
        .select("*")
        .eq("lista_id", listaId)
        .eq("status", "na_fila")
        .or(`proxima_tentativa_apos.is.null,proxima_tentativa_apos.lt.${now}`)
        .order("data_lead", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as OALead[];
    },
    enabled: !!listaId && !!user,
  });

  return { fila, isLoading, refetch: () => queryClient.invalidateQueries({ queryKey: ["oa-fila", listaId] }) };
}

// ─── Hook: Registrar tentativa ───
export function useOARegistrarTentativa() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const registrar = useCallback(async (
    lead: OALead,
    canal: string,
    resultado: string,
    feedback: string,
    lista?: OALista
  ) => {
    if (!user) return;

    // Calculate points
    let pontos = 1; // base
    if (resultado === "com_interesse") pontos = 3;
    if (resultado === "numero_errado") pontos = -1;

    // Insert attempt
    const { error: errTent } = await supabase.from("oferta_ativa_tentativas").insert({
      lead_id: lead.id,
      corretor_id: user.id,
      lista_id: lead.lista_id,
      empreendimento: lead.empreendimento,
      canal,
      resultado,
      feedback,
      pontos,
    } as any);

    if (errTent) { toast.error("Erro ao registrar tentativa"); console.error(errTent); return; }

    // Update lead based on result
    const updates: Record<string, any> = {
      tentativas_count: lead.tentativas_count + 1,
      ultima_tentativa: new Date().toISOString(),
    };

    if (resultado === "numero_errado") {
      updates.status = "descartado";
      updates.motivo_descarte = "numero_errado";
    } else if (resultado === "sem_interesse") {
      updates.status = "descartado";
      updates.motivo_descarte = "sem_interesse";
    } else if (resultado === "com_interesse") {
      updates.status = "aproveitado";
      updates.corretor_id = user.id;
    }

    // Apply cooldown for "sem_resposta" (not used in current 3-option model but ready)
    const maxTentativas = lista?.max_tentativas || 3;
    if (resultado !== "com_interesse" && resultado !== "numero_errado" && resultado !== "sem_interesse") {
      if (lead.tentativas_count + 1 >= maxTentativas) {
        updates.status = "descartado";
        updates.motivo_descarte = "max_tentativas";
      } else {
        const cooldownDias = lista?.cooldown_dias || 7;
        const cooldownDate = new Date();
        cooldownDate.setDate(cooldownDate.getDate() + cooldownDias);
        updates.proxima_tentativa_apos = cooldownDate.toISOString();
        updates.status = "em_cooldown";
      }
    }

    const { error: errLead } = await supabase.from("oferta_ativa_leads").update(updates).eq("id", lead.id);
    if (errLead) console.error(errLead);

    queryClient.invalidateQueries({ queryKey: ["oa-fila"] });
    queryClient.invalidateQueries({ queryKey: ["oa-leads"] });
    queryClient.invalidateQueries({ queryKey: ["oa-stats"] });
    queryClient.invalidateQueries({ queryKey: ["oa-ranking"] });
    toast.success(resultado === "com_interesse" ? "🎉 Lead aproveitado!" : "Tentativa registrada");
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
      let dateFilter = new Date();
      if (period === "hoje") {
        dateFilter.setHours(0, 0, 0, 0);
      } else if (period === "semana") {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else {
        dateFilter.setDate(1);
        dateFilter.setHours(0, 0, 0, 0);
      }

      const { data: tentativas, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("*")
        .gte("created_at", dateFilter.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by corretor
      const byCorretor: Record<string, {
        corretor_id: string;
        tentativas: number;
        aproveitados: number;
        sem_interesse: number;
        numero_errado: number;
        pontos: number;
        ligacoes: number;
        whatsapps: number;
        emails: number;
      }> = {};

      for (const t of (tentativas || []) as OATentativa[]) {
        if (!byCorretor[t.corretor_id]) {
          byCorretor[t.corretor_id] = {
            corretor_id: t.corretor_id,
            tentativas: 0, aproveitados: 0, sem_interesse: 0,
            numero_errado: 0, pontos: 0, ligacoes: 0, whatsapps: 0, emails: 0,
          };
        }
        const c = byCorretor[t.corretor_id];
        c.tentativas++;
        c.pontos += t.pontos;
        if (t.resultado === "com_interesse") c.aproveitados++;
        if (t.resultado === "sem_interesse") c.sem_interesse++;
        if (t.resultado === "numero_errado") c.numero_errado++;
        if (t.canal === "ligacao") c.ligacoes++;
        if (t.canal === "whatsapp") c.whatsapps++;
        if (t.canal === "email") c.emails++;
      }

      const ranking = Object.values(byCorretor).sort((a, b) => b.pontos - a.pontos);
      return { ranking, totalTentativas: tentativas?.length || 0 };
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
  }>
) {
  // Fetch existing normalized phones + emails for dedup
  const { data: existing } = await supabase
    .from("oferta_ativa_leads")
    .select("telefone_normalizado, email");

  const existingPhones = new Set((existing || []).map(e => e.telefone_normalizado).filter(Boolean));
  const existingEmails = new Set((existing || []).map(e => e.email?.toLowerCase()).filter(Boolean));

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

    if (normPhone) seenPhones.add(normPhone);
    if (normEmail) seenEmails.add(normEmail);

    // Validate phone length (BR mobile)
    const isValidPhone = normPhone.length >= 10 && normPhone.length <= 11;

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
      data_lead: row.data_lead || null,
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
    if (error) { console.error(error); toast.error("Erro ao importar batch"); }
    else inserted += batch.length;
  }

  // Update lista total
  await supabase.from("oferta_ativa_listas").update({
    total_leads: inserted,
  } as any).eq("id", listaId);

  return { inserted, duplicates: dupCount, invalid: toInsert.filter(l => l.status === "descartado").length };
}
