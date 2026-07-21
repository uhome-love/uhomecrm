import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthUser } from "@/hooks/useAuthUser";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isBefore, startOfDay, endOfWeek, addDays, addHours } from "date-fns";
import { dateToBRT, parseDateBRT, cn } from "@/lib/utils";
import { fetchInBatchesWithRetry, normalizeQueryError, runQueryWithRetry } from "@/lib/taskQueryUtils";
import { classifyTask } from "@/lib/taskBuckets";
import { ptBR } from "date-fns/locale";
import { Phone, MessageCircle, CheckCircle2, Clock, Calendar, Building2, User, ClipboardList, Plus, Search, Pencil, BookOpen, FileText, Send, RefreshCw, CornerUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate, useSearchParams } from "react-router-dom";
import TaskCompletionDialog from "@/components/pipeline/TaskCompletionDialog";
import { getLeadStatusFilter, isTaskHigherPriority, type LeadClientStatus, type ProximaTarefa } from "@/lib/taskQueryUtils";
import { maxTaskDateBRT, isTaskDateTooFar, TASK_DATE_TOO_FAR_MSG } from "@/lib/taskScheduling";
import { lazy, Suspense } from "react";
import { getPresetsForStage, applyPresetToTarefa, PRESET_OUTRO_ID, type TaskPreset } from "@/lib/taskPresets";

const CorretorScriptsView = lazy(() => import("@/components/scripts/CorretorScriptsView"));

interface TarefaComLead {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  prioridade: string;
  vence_em: string | null;
  hora_vencimento: string | null;
  concluida_em: string | null;
  pipeline_lead_id: string;
  created_at: string;
  adiamentos_count?: number | null;
  lead_nome?: string;
  lead_telefone?: string;
  lead_empreendimento?: string;
}

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up", ligar: "Ligar", whatsapp: "WhatsApp", enviar_proposta: "Enviar proposta",
  enviar_material: "Enviar material", marcar_visita: "Marcar visita", confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar cliente", outro: "Outro",
};

const TIPO_EMOJI: Record<string, string> = {
  follow_up: "🔄", ligar: "📞", whatsapp: "💬", enviar_proposta: "📄",
  enviar_material: "📎", marcar_visita: "📅", confirmar_visita: "✅", retornar_cliente: "↩️", outro: "📋",
};


type TabFilter = "todas" | "hoje" | "amanha" | "semana" | "atrasadas" | "desatualizados" | "concluidas";

interface OwnedLead {
  id: string;
  nome: string | null;
  telefone: string | null;
  empreendimento: string | null;
  stage_id: string | null;
  stage_tipo: string | null;
  negocio_id: string | null;
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

const TIPO_VISUAL: Record<string, { Icon: typeof Phone; cls: string }> = {
  follow_up: { Icon: RefreshCw, cls: "bg-primary/10 text-primary" },
  ligar: { Icon: Phone, cls: "bg-success-500/10 text-success-700" },
  ligacao: { Icon: Phone, cls: "bg-success-500/10 text-success-700" },
  whatsapp: { Icon: MessageCircle, cls: "bg-success-500/10 text-success-700" },
  enviar_proposta: { Icon: FileText, cls: "bg-primary/10 text-primary" },
  proposta: { Icon: FileText, cls: "bg-primary/10 text-primary" },
  enviar_material: { Icon: Send, cls: "bg-primary/10 text-primary" },
  marcar_visita: { Icon: Calendar, cls: "bg-warning-500/10 text-warning-700" },
  visita: { Icon: Calendar, cls: "bg-warning-500/10 text-warning-700" },
  confirmar_visita: { Icon: CheckCircle2, cls: "bg-success-500/10 text-success-700" },
  retornar_cliente: { Icon: CornerUpLeft, cls: "bg-primary/10 text-primary" },
  outro: { Icon: ClipboardList, cls: "bg-muted text-muted-foreground" },
};

function tipoVisual(tipo: string) {
  return TIPO_VISUAL[tipo] || { Icon: ClipboardList, cls: "bg-muted text-muted-foreground" };
}

function toneBadgeClass(tone?: "destructive" | "warning" | "success") {
  if (tone === "destructive") return "bg-destructive/10 text-destructive";
  if (tone === "warning") return "bg-warning-500/15 text-warning-700";
  if (tone === "success") return "bg-success-500/15 text-success-700";
  return "";
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  window.open(`https://wa.me/${full}`, "_blank");
}

export default function MinhasTarefas() {
  const { user } = useAuth();
  const { profileId } = useAuthUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    const valid: TabFilter[] = ["todas", "hoje", "amanha", "semana", "atrasadas", "desatualizados", "concluidas"];
    return (valid as string[]).includes(t || "") ? (t as TabFilter) : "todas";
  })();
  const [activeTab, setActiveTab] = useState<TabFilter>(initialTab);
  // Sync com URL quando navegação muda ?tab= sem remontar (TabProvider Chrome-style)
  useEffect(() => {
    const t = searchParams.get("tab");
    const valid: TabFilter[] = ["todas", "hoje", "amanha", "semana", "atrasadas", "desatualizados", "concluidas"];
    if (t && (valid as string[]).includes(t) && t !== activeTab) {
      setActiveTab(t as TabFilter);
    }
  }, [searchParams]);
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [novoTipo, setNovoTipo] = useState("follow_up");
  const [novoData, setNovoData] = useState("");
  const [novoHora, setNovoHora] = useState("");
  const [novoObs, setNovoObs] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadNome, setSelectedLeadNome] = useState("");
  // Edit task state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState("follow_up");
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editObs, setEditObs] = useState("");
  const [scriptsOpen, setScriptsOpen] = useState(false);

  // Owned leads alinhado com usePipeline: arquivado=false, aceite_status válido,
  // e inclui leads de parceria via v_user_partner_leads (sem isso, contagem de
  // Atrasadas/Desatualizados diverge do pipeline).
  const { data: ownedLeadsFull = [], isLoading: isLoadingOwnedLeads } = useQuery({
    queryKey: ["owned-leads-tarefas", user?.id, profileId],
    queryFn: async (): Promise<OwnedLead[]> => {
      if (!user) return [];
      const corretorIds = [user.id, profileId].filter(Boolean) as string[];
      if (corretorIds.length === 0) return [];

      const PAGE = 1000;
      const leads: any[] = [];

      // 1) Leads onde sou corretor principal (mesma regra do pipeline)
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, empreendimento, stage_id, negocio_id")
          .eq("arquivado", false)
          .in("corretor_id", corretorIds)
          .in("aceite_status", ["aceito", "pendente", "aguardando_aceite"])
          .range(from, from + PAGE - 1);
        if (error) {
          throw error;
        }
        const batch = (data || []) as any[];
        leads.push(...batch);
        if (batch.length < PAGE) break;
      }

      // 2) Leads de parceria (mesma view canônica usada no pipeline) — paginado
      try {
        const partnerIds: string[] = [];
        for (let off = 0; ; off += PAGE) {
          const { data: partnerships, error: pErr } = await supabase
            .from("v_user_partner_leads")
            .select("pipeline_lead_id")
            .range(off, off + PAGE - 1);
          if (pErr) throw pErr;
          const rows = (partnerships || []) as any[];
          rows.forEach(p => { if (p.pipeline_lead_id) partnerIds.push(p.pipeline_lead_id); });
          if (rows.length < PAGE) break;
        }
        const existing = new Set(leads.map(l => l.id));
        const missing = partnerIds.filter(id => !existing.has(id));
        for (let i = 0; i < missing.length; i += 200) {
          const chunk = missing.slice(i, i + 200);
          const { data: partnerLeads, error: plErr } = await supabase
            .from("pipeline_leads")
            .select("id, nome, telefone, empreendimento, stage_id, negocio_id, arquivado")
            .in("id", chunk);
          if (plErr) throw plErr;
          (partnerLeads || []).forEach((l: any) => {
            if (!l.arquivado) leads.push(l);
          });
        }
      } catch (e) {
        console.warn("[MinhasTarefas] Falha ao carregar leads de parceria", e);
      }

      const dedup = new Map<string, any>();
      leads.forEach(l => { if (!dedup.has(l.id)) dedup.set(l.id, l); });
      const finalLeads = [...dedup.values()];

      const stageIds = [...new Set(finalLeads.map(l => l.stage_id).filter(Boolean))];
      const stageTipoMap = new Map<string, string>();
      if (stageIds.length > 0) {
        const { data: stages } = await supabase
          .from("pipeline_stages").select("id, tipo").in("id", stageIds);
        (stages || []).forEach((s: any) => stageTipoMap.set(s.id, s.tipo));
      }

      return finalLeads.map(l => ({
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        empreendimento: l.empreendimento,
        stage_id: l.stage_id,
        stage_tipo: l.stage_id ? stageTipoMap.get(l.stage_id) || null : null,
        negocio_id: l.negocio_id,
      }));
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const ownedLeadIds = useMemo(() => ownedLeadsFull.map((lead) => lead.id), [ownedLeadsFull]);
  const ownedLeadIdsKey = useMemo(() => ownedLeadIds.slice().sort().join(","), [ownedLeadIds]);

  const { data: ownedLeadTaskMap = {}, isLoading: isLoadingOwnedLeadTaskMap } = useQuery({
    queryKey: ["owned-lead-task-map", ownedLeadIdsKey],
    queryFn: async (): Promise<Record<string, ProximaTarefa>> => {
      if (ownedLeadIds.length === 0) return {};

      const map: Record<string, ProximaTarefa> = {};
      const { rows, errors } = await fetchInBatchesWithRetry<any>(
        ownedLeadIds,
        (chunk) =>
          supabase
            .from("pipeline_tarefas")
            .select("pipeline_lead_id, tipo, vence_em, hora_vencimento")
            .in("pipeline_lead_id", chunk)
            .eq("status", "pendente")
            .order("vence_em", { ascending: true })
            .order("hora_vencimento", { ascending: true }),
        { chunkSize: 50, minChunkSize: 10 }
      );

      for (const row of rows) {
        const nextTask: ProximaTarefa = {
          tipo: row.tipo,
          vence_em: row.vence_em,
          hora_vencimento: row.hora_vencimento,
        };
        const currentTask = map[row.pipeline_lead_id];
        if (!currentTask || isTaskHigherPriority(nextTask, currentTask)) {
          map[row.pipeline_lead_id] = nextTask;
        }
      }

      if (errors.length && rows.length === 0) {
        throw normalizeQueryError(errors[0], "Erro ao carregar tarefas pendentes dos leads");
      }

      if (errors.length) {
        console.warn("[MinhasTarefas] Algumas consultas de tarefas dos leads falharam e foram isoladas por chunk", errors);
      }

      return map;
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["minhas-tarefas", user?.id, ownedLeadIdsKey],
    queryFn: async () => {
      if (!user) return [];

      const reportLoadError = (context: string, error: { message?: string }) => {
        console.error(`[MinhasTarefas] ${context}:`, error);
        toast.error(`Erro ao carregar tarefas: ${error.message || context}`);
      };

      const { data: directRows, error: directErr } = await runQueryWithRetry(() =>
        supabase
          .from("pipeline_tarefas")
          .select("*")
          .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
          .order("vence_em", { ascending: true })
          .order("hora_vencimento", { ascending: true })
          .limit(2000)
      );

      if (directErr) {
        reportLoadError("Erro ao buscar tarefas diretas", directErr);
        throw directErr;
      }

      const rows = (directRows || []) as any[];

      if (ownedLeadIds.length > 0) {
        const { rows: ownedTaskRows, errors: ownedTasksErrors } = await fetchInBatchesWithRetry<any>(
          ownedLeadIds,
          (slice) =>
            supabase
              .from("pipeline_tarefas")
              .select("*")
              .in("pipeline_lead_id", slice)
              .order("vence_em", { ascending: true })
              .order("hora_vencimento", { ascending: true }),
          { chunkSize: 50, minChunkSize: 10 }
        );

        if (ownedTaskRows.length) rows.push(...ownedTaskRows);

        if (ownedTasksErrors.length && rows.length === 0) {
          const error = normalizeQueryError(ownedTasksErrors[0], "Erro ao buscar tarefas dos leads do corretor");
          reportLoadError("Erro ao buscar tarefas dos leads do corretor", error);
          throw error;
        }

        if (ownedTasksErrors.length) {
          console.warn("[MinhasTarefas] Algumas consultas de tarefas por lead falharam, mas o restante foi carregado", ownedTasksErrors);
        }
      }

      // Deduplicar por id e enriquecer com dados do lead (incl. arquivado/stage_tipo/negocio_id
      // para que tarefas órfãs de leads descartados/arquivados/convertidos não vazem nas listas).
      const uniqueRows = [...new Map(rows.map(r => [r.id, r])).values()];
      const leadIds = [...new Set(uniqueRows.map(r => r.pipeline_lead_id).filter(Boolean))];
      if (leadIds.length > 0) {
        const CHUNK = 100;
        const leadMap = new Map<string, any>();
        const stageIdsSet = new Set<string>();
        for (let i = 0; i < leadIds.length; i += CHUNK) {
          const slice = leadIds.slice(i, i + CHUNK);
          const { data: leads, error: leadsErr } = await runQueryWithRetry(() =>
            supabase
              .from("pipeline_leads")
              .select("id, nome, telefone, empreendimento, arquivado, stage_id, negocio_id")
              .in("id", slice)
          );
          if (leadsErr) {
            console.warn("[MinhasTarefas] Falha ao enriquecer tarefas com dados de lead", leadsErr);
            continue;
          }
          (leads as any[] || []).forEach((l: any) => {
            leadMap.set(l.id, l);
            if (l.stage_id) stageIdsSet.add(l.stage_id);
          });
        }
        const stageTipoMap = new Map<string, string>();
        if (stageIdsSet.size > 0) {
          const { data: stages } = await supabase
            .from("pipeline_stages").select("id, tipo").in("id", [...stageIdsSet]);
          (stages || []).forEach((s: any) => stageTipoMap.set(s.id, s.tipo));
        }
        uniqueRows.forEach(r => {
          const lead = leadMap.get(r.pipeline_lead_id);
          if (lead) {
            r.lead_nome = lead.nome;
            r.lead_telefone = lead.telefone;
            r.lead_empreendimento = lead.empreendimento;
            r.lead_arquivado = lead.arquivado;
            r.lead_negocio_id = lead.negocio_id;
            r.lead_stage_tipo = lead.stage_id ? stageTipoMap.get(lead.stage_id) || null : null;
          }
        });
      }
      uniqueRows.sort((a, b) => {
        const dueA = `${a.vence_em ?? "9999-12-31"}T${a.hora_vencimento ?? "23:59:59"}`;
        const dueB = `${b.vence_em ?? "9999-12-31"}T${b.hora_vencimento ?? "23:59:59"}`;
        return dueA.localeCompare(dueB) || b.created_at.localeCompare(a.created_at);
      });

      return uniqueRows as TarefaComLead[];
    },
    enabled: !!user && !isLoadingOwnedLeads,
    refetchOnWindowFocus: true,
  });

  // Etapas elegíveis para tarefa manual (as demais têm cadência/fluxo automático)
  const { data: elegibleStageIds = [] } = useQuery({
    queryKey: ["nova-tarefa-elegible-stages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, tipo")
        .in("tipo", ["qualificacao", "aquecimento", "negociacao"]);
      return (data || []).map((s: any) => s.id as string);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: searchLeads = [] } = useQuery({
    queryKey: ["lead-search-tarefas", leadSearch, elegibleStageIds],
    queryFn: async () => {
      if (!user || leadSearch.length < 2) return [];
      if (elegibleStageIds.length === 0) return [];
      const corretorIds = [user.id, profileId].filter(Boolean) as string[];
      if (corretorIds.length === 0) return [];
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, stage_id, pipeline_stages:stage_id(tipo, nome)")
        .in("corretor_id", corretorIds)
        .in("stage_id", elegibleStageIds)
        .eq("arquivado", false)
        .in("aceite_status", ["aceito", "pendente", "aguardando_aceite"])
        .ilike("nome", `%${leadSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: !!user && leadSearch.length >= 2 && elegibleStageIds.length > 0,
  });


  // Etapa do lead selecionado — dispara presets contextuais no popup "Nova tarefa"
  const { data: selectedLeadStage } = useQuery({
    queryKey: ["nova-tarefa-lead-stage", selectedLeadId],
    queryFn: async () => {
      if (!selectedLeadId) return null;
      const { data } = await supabase
        .from("pipeline_leads")
        .select("stage_id, flag_status, pipeline_stages:stage_id(tipo)")
        .eq("id", selectedLeadId)
        .maybeSingle();
      const stageTipo = (data as any)?.pipeline_stages?.tipo ?? null;
      return { stageTipo, flagStatus: (data as any)?.flag_status ?? {} };
    },
    enabled: !!selectedLeadId,
  });
  const stageTipoSelecionado = selectedLeadStage?.stageTipo ?? null;
  const presetsDisponiveis = useMemo(() => getPresetsForStage(stageTipoSelecionado), [stageTipoSelecionado]);
  const [presetSelecionadoId, setPresetSelecionadoId] = useState<string | null>(null);
  const presetSelecionado = useMemo<TaskPreset | null>(
    () => presetsDisponiveis.find((p) => p.id === presetSelecionadoId) ?? null,
    [presetsDisponiveis, presetSelecionadoId],
  );


  const now = new Date();
  const todayStart = startOfDay(now);
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const activeTarefas = tarefas;

  // Map de leads "elegíveis" (igual ao pipeline: exclui descarte e leads com negócio criado)
  const ownedLeadsMap = useMemo(() => {
    const m = new Map<string, OwnedLead>();
    ownedLeadsFull.forEach(l => m.set(l.id, l));
    return m;
  }, [ownedLeadsFull]);

  // Filtro unificado: tarefa só é elegível se o lead NÃO está arquivado,
  // NÃO está em stage de descarte e NÃO virou negócio.
  // Usa primeiro o estado embarcado na tarefa (lead_arquivado/lead_stage_tipo/lead_negocio_id),
  // e em fallback o ownedLeadsMap (para parcerias/leads ativos).
  const isLeadElegivel = (t: TarefaComLead) => {
    const leadId = t.pipeline_lead_id;
    if (!leadId) return true; // tarefas sem lead (negócios) seguem normais
    const embarcado: any = t as any;
    if (embarcado.lead_arquivado === true) return false;
    if (embarcado.lead_stage_tipo === "descarte") return false;
    if (embarcado.lead_negocio_id) return false;
    const l = ownedLeadsMap.get(leadId);
    if (l) {
      if (l.stage_tipo === "descarte") return false;
      if (l.negocio_id) return false;
    }
    return true;
  };

  const pendentes = useMemo(
    () => activeTarefas.filter(t => t.status === "pendente" && isLeadElegivel(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTarefas, ownedLeadsMap]
  );
  const concluidas = useMemo(
    () =>
      activeTarefas
        .filter(t => t.status === "concluida")
        .slice()
        .sort((a, b) => {
          const aKey = a.concluida_em || "";
          const bKey = b.concluida_em || "";
          if (aKey && bKey) return bKey.localeCompare(aKey);
          if (aKey && !bKey) return -1;
          if (!aKey && bKey) return 1;
          const aFb = (a as any).updated_at || a.created_at || "";
          const bFb = (b as any).updated_at || b.created_at || "";
          return bFb.localeCompare(aFb);
        })
        .slice(0, 20),
    [activeTarefas]
  );

  const ownedLeadStatusMap = useMemo(() => {
    const map = new Map<string, LeadClientStatus>();
    ownedLeadsFull.forEach((lead) => {
      map.set(lead.id, getLeadStatusFilter(lead as any, ownedLeadTaskMap[lead.id] || null, lead.stage_tipo || undefined));
    });
    return map;
  }, [ownedLeadsFull, ownedLeadTaskMap]);

  // Atrasadas (regra canônica unificada — ver src/lib/taskBuckets.ts):
  // tarefa pendente com vence_em<hoje OU (vence_em=hoje E hora_vencimento<agora BRT).
  // Conta TAREFAS (não leads distintos) para alinhar com o KPI do dashboard.
  const atrasadasTarefas = useMemo(() => {
    return pendentes.filter(t => {
      if (!isLeadElegivel(t)) return false;
      return classifyTask({ vence_em: t.vence_em, hora_vencimento: t.hora_vencimento }).isOverdue;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendentes, ownedLeadsMap]);

  // Conta de leads únicos atrasados (uso interno — ex: badge auxiliar)
  const atrasadasLeadCount = useMemo(() => new Set(atrasadasTarefas.map(t => t.pipeline_lead_id).filter(Boolean)).size, [atrasadasTarefas]);

  const hoje = useMemo(() => pendentes.filter(t => t.vence_em && isToday(parseDateBRT(t.vence_em))), [pendentes]);
  const amanha = useMemo(() => pendentes.filter(t => t.vence_em && isTomorrow(parseDateBRT(t.vence_em))), [pendentes]);
  const semana = useMemo(() => pendentes.filter(t => {
    if (!t.vence_em) return false;
    const d = parseDateBRT(t.vence_em);
    return d >= todayStart && d <= weekEnd;
  }), [pendentes]);

  // Desatualizados: leads do corretor (elegíveis) SEM nenhuma tarefa pendente
  const desatualizados = useMemo<OwnedLead[]>(() => {
    return ownedLeadsFull
      .filter(l => ownedLeadStatusMap.get(l.id) === "desatualizado")
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [ownedLeadsFull, ownedLeadStatusMap]);

  const filteredTarefas = activeTab === "todas" ? pendentes : activeTab === "atrasadas" ? atrasadasTarefas : activeTab === "hoje" ? hoje :
    activeTab === "amanha" ? amanha : activeTab === "concluidas" ? concluidas : activeTab === "desatualizados" ? [] : semana;

  // Completion dialog state
  const [completingTarefa, setCompletingTarefa] = useState<TarefaComLead | null>(null);

  const handleConcluir = async (tarefa: TarefaComLead) => {
    setCompletingTarefa(tarefa);
  };

  const [savingCompletion, setSavingCompletion] = useState(false);

  const handleCompletionConfirm = async (
    payload: import("@/components/pipeline/task-completion/types").CompletionPayload
  ) => {
    if (!completingTarefa || !user || savingCompletion) return;
    const id = completingTarefa.id;
    const leadId = completingTarefa.pipeline_lead_id;
    const {
      tipo_contato, resultado, descricao,
      outcome, nova_tarefa, novo_stage_id,
      reason_label, reason_code, status_etapa,
    } = payload;

    setSavingCompletion(true);

    try {
      const now = new Date().toISOString();


      // ── LEADS: fluxo com switch de outcomes ─────────────────────────
      const { error: toggleErr } = await supabase.from("pipeline_tarefas")
        .update({ status: "concluida", concluida_em: now } as never).eq("id", id);
      if (toggleErr) throw toggleErr;

      // Persiste status da etapa (Qualificação/Aquecimento) em flag_status junto com ultima_acao_at
      if (status_etapa?.key && status_etapa.value) {
        const { data: leadRow } = await supabase
          .from("pipeline_leads")
          .select("flag_status")
          .eq("id", leadId)
          .maybeSingle();
        const nextFlag: Record<string, unknown> = {
          ...(((leadRow as { flag_status?: Record<string, unknown> } | null)?.flag_status) || {}),
        };
        nextFlag[status_etapa.key] = status_etapa.value;
        await supabase.from("pipeline_leads")
          .update({ flag_status: nextFlag, ultima_acao_at: now, updated_at: now } as never)
          .eq("id", leadId);
      } else {
        await supabase.from("pipeline_leads")
          .update({ ultima_acao_at: now, updated_at: now } as never).eq("id", leadId);
      }


      // Activity capture (sempre)
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: leadId,
        tipo: tipo_contato,
        tipo_contato,
        resultado,
        titulo: `${completingTarefa.titulo} — ${resultado}`,
        descricao: descricao ?? null,
        data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
        hora: new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
        prioridade: "media",
        status: "concluida",
        created_by: user.id,
      } as never);

      let toastMsg = "Tarefa concluída ✅";

      // outcome=agendar → cria próxima
      if (outcome === "agendar" && nova_tarefa) {
        const leadNome = completingTarefa.lead_nome || "Lead";
        const TIPO_LABELS_MAP: Record<string, string> = {
          ligacao: "Ligar", whatsapp: "WhatsApp", follow_up: "Follow-up",
          visita: "Visita", proposta: "Proposta", email: "E-mail",
        };
        const [yPt, mPt, dPt] = (nova_tarefa.vence_em || "").split("-");
        const dateSuffix = yPt && mPt && dPt ? ` · ${dPt}/${mPt}` : "";
        const titulo = `${TIPO_LABELS_MAP[nova_tarefa.tipo] || nova_tarefa.tipo}: ${leadNome}${dateSuffix}`;
        const { error: insertErr } = await supabase.from("pipeline_tarefas").insert({
          pipeline_lead_id: leadId,
          tipo: nova_tarefa.tipo,
          titulo,
          descricao: nova_tarefa.obs?.trim() || descricao?.trim() || null,
          prioridade: "media",
          status: "pendente",
          responsavel_id: user.id,
          vence_em: nova_tarefa.vence_em,
          hora_vencimento: nova_tarefa.hora_vencimento || null,
          created_by: user.id,
        } as never);
        if (insertErr) throw insertErr;
        toastMsg = "Tarefa concluída e próxima agendada ✅";
      }

      // outcome=agendar|concluir + stage opcional
      if ((outcome === "agendar" || outcome === "concluir") && novo_stage_id && leadId) {
        const { error: stageErr } = await supabase.from("pipeline_leads").update({
          stage_id: novo_stage_id,
          stage_changed_at: now,
          updated_at: now,
        } as never).eq("id", leadId);
        if (stageErr) {
          toast.warning("Tarefa concluída, mas etapa não foi alterada.");
        } else {
          await supabase.from("pipeline_historico").insert({
            pipeline_lead_id: leadId,
            stage_novo_id: novo_stage_id,
            movido_por: user.id,
            observacao: "Movido via Central de Tarefas (conclusão)",
          });
        }
      }

      // outcome=descartar → move pra Descarte
      if (outcome === "descartar" && leadId) {
        const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
        const motivo = buildMotivoDescarte("reengajavel", reason_label || "Sem motivo informado");
        const { data: descarteStage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_tipo", "leads")
          .eq("tipo", "descarte")
          .limit(1)
          .maybeSingle();
        if (!descarteStage) {
          toast.error("Etapa de Descarte não encontrada.");
        } else {
          const { error } = await supabase.from("pipeline_leads").update({
            stage_id: descarteStage.id,
            stage_changed_at: now,
            updated_at: now,
            motivo_descarte: motivo,
            tipo_descarte: "reengajavel",
            arquivado: false,
          } as never).eq("id", leadId);
          if (error) {
            toast.error("Não foi possível descartar: " + error.message);
          } else {
            await supabase.from("pipeline_historico").insert({
              pipeline_lead_id: leadId,
              stage_novo_id: descarteStage.id,
              movido_por: user.id,
              observacao: motivo,
            } as never);
            toastMsg = "Lead descartado ✅";
          }
        }
      }

      // outcome=inativar → arquiva
      if (outcome === "inativar" && leadId) {
        const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
        const motivo = buildMotivoDescarte("definitivo", reason_label || "Sem motivo informado");
        const { error } = await supabase.from("pipeline_leads").update({
          motivo_descarte: motivo,
          tipo_descarte: "definitivo",
          arquivado: true,
          ultima_acao_at: now,
          updated_at: now,
        } as never).eq("id", leadId);
        if (error) {
          toast.error("Não foi possível inativar: " + error.message);
        } else {
          toastMsg = "Lead inativado ✅";
        }
      }

      console.info("[task_completed]", { lead_id: leadId, tarefa_id: id, outcome, reason_code });
      toast.success(toastMsg);
      setCompletingTarefa(null);
      invalidateTaskQueries(queryClient, leadId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao concluir tarefa";
      toast.error("Não foi possível concluir: " + msg);
    } finally {
      setSavingCompletion(false);
    }
  };


  const handleCriarTarefa = async () => {
    if (!user || !selectedLeadId || !novoData) return;
    if (isTaskDateTooFar(novoData)) { toast.error(TASK_DATE_TOO_FAR_MSG); return; }
    const { error } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: selectedLeadId,
      titulo: `${TIPO_LABELS[novoTipo] || novoTipo}: ${selectedLeadNome}`,
      descricao: novoObs || null,
      tipo: novoTipo,
      vence_em: novoData,
      hora_vencimento: novoHora || null,
      status: "pendente",
      prioridade: "media",
      responsavel_id: user.id,
      created_by: user.id,
    } as any);
    if (error) {
      toast.error("Não foi possível criar a tarefa: " + error.message);
      return;
    }
    // Se um preset com syncFlag foi selecionado, sincroniza flag_status do lead
    if (presetSelecionado?.syncFlagKey && presetSelecionado?.syncFlagValue) {
      const currentFlag = (selectedLeadStage?.flagStatus as Record<string, unknown>) || {};
      const nextFlag = { ...currentFlag, [presetSelecionado.syncFlagKey]: presetSelecionado.syncFlagValue };
      const { error: flagErr } = await supabase
        .from("pipeline_leads")
        .update({ flag_status: nextFlag } as any)
        .eq("id", selectedLeadId);
      if (flagErr) toast.warning("Tarefa criada, mas não consegui atualizar o status da etapa.");
    }
    toast.success("Tarefa criada ✅");
    setShowNovaTarefa(false);
    setSelectedLeadId(null);
    setSelectedLeadNome("");
    setLeadSearch("");
    setNovoObs("");
    setNovoData("");
    setNovoHora("");
    setPresetSelecionadoId(null);
    invalidateTaskQueries(queryClient, selectedLeadId);
  };


  const openEditTarefa = (tarefa: TarefaComLead) => {
    setEditId(tarefa.id);
    setEditTipo(tarefa.tipo);
    setEditData(tarefa.vence_em || "");
    setEditHora(tarefa.hora_vencimento?.slice(0, 5) || "");
    setEditObs(tarefa.descricao || "");
  };

  const handleEditTarefa = async () => {
    if (!editId) return;
    if (isTaskDateTooFar(editData)) { toast.error(TASK_DATE_TOO_FAR_MSG); return; }
    const { error } = await supabase.from("pipeline_tarefas").update({
      tipo: editTipo,
      vence_em: editData || null,
      hora_vencimento: editHora || null,
      descricao: editObs || null,
      updated_at: new Date().toISOString(),
    } as any).eq("id", editId);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return; }
    toast.success("Tarefa atualizada ✅");
    setEditId(null);
    invalidateTaskQueries(queryClient, null);
  };

  const tabs: { key: TabFilter; label: string; count: number; tone?: "destructive" | "warning" | "success" }[] = [
    { key: "todas", label: "Todas", count: pendentes.length },
    { key: "atrasadas", label: "Atrasadas", count: atrasadasTarefas.length, tone: "destructive" },
    { key: "hoje", label: "Hoje", count: hoje.length, tone: "warning" },
    { key: "amanha", label: "Amanhã", count: amanha.length },
    { key: "semana", label: "Semana", count: semana.length },
    { key: "desatualizados" as TabFilter, label: "Desatualizados", count: desatualizados.length, tone: "warning" as const },
    { key: "concluidas", label: "Concluídas", count: concluidas.length, tone: "success" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Minhas Tarefas"
        subtitle="Organize seu dia e nunca perca um follow-up"
        icon={<ClipboardList className="h-5 w-5" />}
        className="mb-0"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setShowNovaTarefa(true)}>
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        }
      />


      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible" role="tablist" aria-label="Filtrar tarefas por período">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          const btn = (
            <Button key={tab.key} role="tab" aria-selected={isActive} variant={isActive ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5 shrink-0" onClick={() => setActiveTab(tab.key)}>
              {tab.label}
              <Badge variant="secondary" className={cn("ml-0.5 text-[10px] px-1.5", !isActive && toneBadgeClass(tab.tone))}>{tab.count}</Badge>
            </Button>
          );
          if (tab.key === "desatualizados") {
            return (
              <Tooltip key={tab.key}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Leads ativos sem nenhuma próxima tarefa agendada. Adicione uma tarefa para retomar a direção do contato.
                </TooltipContent>
              </Tooltip>
            );
          }
          return btn;
        })}
      </div>


      {/* Task list */}
      {(isLoading || isLoadingOwnedLeads || isLoadingOwnedLeadTaskMap) ? (
        <div className="rounded-[12px] border divide-y overflow-hidden">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-l-[3px] border-l-muted animate-pulse">
              <div className="shrink-0 h-9 w-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 bg-muted rounded" />
                <div className="h-3 w-56 bg-muted rounded" />
              </div>
              <div className="h-7 w-24 bg-muted rounded-full hidden lg:block" />
            </div>
          ))}
        </div>

      ) : activeTab === "desatualizados" ? (
        desatualizados.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">🎉 Todos os seus leads ativos têm tarefa criada!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              🟡 Leads ativos sem nenhuma tarefa pendente. Crie um follow-up pra não perder o contato.
            </p>
            <div className="rounded-[12px] border divide-y overflow-hidden">
            {desatualizados.map(lead => (
              <div key={lead.id} className="flex flex-col lg:flex-row lg:items-center gap-3 px-3 py-2.5 border-l-[3px] border-l-warning-500 transition-colors hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => navigate(`/pipeline-leads?lead=${lead.id}`)}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate"
                  >
                    <User className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{lead.nome || "Sem nome"}</span>
                  </button>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {lead.empreendimento && (<span className="flex items-center gap-1 truncate"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{lead.empreendimento}</span></span>)}
                    {lead.telefone && <span className="shrink-0">{formatPhone(lead.telefone)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap shrink-0 lg:justify-end">
                  {lead.telefone && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => window.open(`tel:${lead.telefone}`, "_self")}>
                        <Phone className="h-3.5 w-3.5" /> Ligar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => openWhatsApp(lead.telefone!)}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                    </>
                  )}
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={() => {
                    setSelectedLeadId(lead.id);
                    setSelectedLeadNome(lead.nome || "Lead");
                    setNovoTipo("follow_up");
                    setNovoData(dateToBRT(new Date()));
                    setNovoHora("10:00");
                    setNovoObs("");
                    setShowNovaTarefa(true);
                  }}>
                    <Plus className="h-3.5 w-3.5" /> Criar Tarefa
                  </Button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )

      ) : filteredTarefas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">🎉 Nenhuma tarefa {activeTab === "atrasadas" ? "atrasada" : activeTab === "concluidas" ? "concluída recente" : "para este período"}!</p>
        </Card>
      ) : (
        <div className="rounded-[12px] border divide-y overflow-hidden">
          {filteredTarefas.map(tarefa => {
            const isOverdue = tarefa.vence_em && isBefore(parseDateBRT(tarefa.vence_em), todayStart) && tarefa.status === "pendente";
            const isToday_ = tarefa.vence_em && isToday(parseDateBRT(tarefa.vence_em));
            const isConcluida = tarefa.status === "concluida";
            const tv = tipoVisual(tarefa.tipo);
            const prazoTone = isConcluida ? "text-success-700 bg-success-500/10" : isOverdue ? "text-destructive bg-destructive/10" : isToday_ ? "text-warning-700 bg-warning-500/10" : "text-muted-foreground bg-muted";
            return (
              <div key={tarefa.id} className={cn(
                "relative px-4 py-3.5 transition-colors hover:bg-muted/40 border-l-[3px]",
                isConcluida ? "border-l-success-500 opacity-70" :
                isOverdue ? "border-l-destructive" :
                isToday_ ? "border-l-warning-500" :
                "border-l-transparent"
              )}>
                {/* Content (primary) */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={cn("shrink-0 h-9 w-9 rounded-full flex items-center justify-center mt-0.5", tv.cls)}>
                    <tv.Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Row 1: name + prazo */}
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => {
                        navigate(`/pipeline-leads?lead=${tarefa.pipeline_lead_id}`);
                      }} className="text-[15px] font-semibold text-foreground hover:text-primary transition-colors truncate flex items-center gap-1.5 min-w-0">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{tarefa.lead_nome || "Lead"}</span>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOverdue && <Badge variant="destructive" className="text-[10px]">ATRASADA</Badge>}
                        <span className={cn("text-[11px] font-medium px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap", prazoTone)}>
                          <Clock className="h-3 w-3" />
                          {isConcluida ? (
                            tarefa.concluida_em ? `Concluída ${format(new Date(tarefa.concluida_em), "dd/MM HH:mm", { locale: ptBR })}` : "Concluída"
                          ) : (
                            <>
                              {tarefa.vence_em ? format(parseDateBRT(tarefa.vence_em), "dd/MM", { locale: ptBR }) : "Sem data"}
                              {tarefa.hora_vencimento && ` ${tarefa.hora_vencimento.slice(0, 5)}`}
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: o que fazer + empreendimento + telefone */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5">{TIPO_LABELS[tarefa.tipo] || tarefa.tipo}</Badge>
                      {tarefa.lead_empreendimento && (
                        <span className="flex items-center gap-1 min-w-0"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{tarefa.lead_empreendimento}</span></span>
                      )}
                      {tarefa.lead_telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{formatPhone(tarefa.lead_telefone)}</span>}
                    </div>

                    {/* Row 3: feedback escrito */}
                    {tarefa.descricao && (
                      <p className="text-xs text-foreground/80 italic mt-1.5 bg-muted/40 rounded-md px-2 py-1.5">📝 "{tarefa.descricao}"</p>
                    )}
                  </div>
                </div>

                {/* Actions footer (secondary) */}
                <div className="flex items-center gap-0.5 mt-2.5 pt-2 border-t border-border/60 lg:pl-12">
                  {!isConcluida && tarefa.lead_telefone && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => window.open(`tel:${tarefa.lead_telefone}`, "_self")}>
                        <Phone className="h-3.5 w-3.5" /> Ligar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => openWhatsApp(tarefa.lead_telefone!)}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                    </>
                  )}
                  {!isConcluida && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-success-700 hover:text-success-700 hover:bg-success-500/10" onClick={() => handleConcluir(tarefa)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => openEditTarefa(tarefa)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 ml-auto" onClick={() => {
                    setSelectedLeadId(tarefa.pipeline_lead_id);
                    setSelectedLeadNome(tarefa.lead_nome || "Lead");
                    setNovoTipo("follow_up");
                    setNovoData(dateToBRT(new Date()));
                    setNovoHora("10:00");
                    setNovoObs("");
                    setShowNovaTarefa(true);
                  }}>
                    <Plus className="h-3.5 w-3.5" /> Nova Tarefa
                  </Button>
                </div>
              </div>

            );
          })}
        </div>
      )}



      {/* Edit Tarefa dialog */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>✏️ Editar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={editTipo} onValueChange={setEditTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{TIPO_EMOJI[k] || "📋"} {v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data</label>
                <Input type="date" value={editData} max={maxTaskDateBRT()} onChange={e => setEditData(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Hora</label>
                <Input type="time" value={editHora} onChange={e => setEditHora(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Observação</label>
              <Textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={2} placeholder="Observação..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditId(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleEditTarefa}>💾 Salvar Alterações</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova Tarefa dialog */}
      <Dialog open={showNovaTarefa} onOpenChange={setShowNovaTarefa}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>➕ Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Lead search */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Lead</label>
              {selectedLeadId ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-sm">{selectedLeadNome}</Badge>
                  {stageTipoSelecionado && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {stageTipoSelecionado === "negociacao" ? "Em Negociação" : stageTipoSelecionado}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedLeadId(null); setSelectedLeadNome(""); setPresetSelecionadoId(null); }}>Trocar</Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar lead..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)} className="pl-8" />
                  {searchLeads.length > 0 && (
                    <div role="listbox" aria-label="Resultados da busca de lead" className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {searchLeads.map(l => (
                        <button key={l.id} type="button" role="option" aria-selected={false} className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onClick={() => {
                          setSelectedLeadId(l.id);
                          setSelectedLeadNome(l.nome);
                          setLeadSearch("");
                        }}>
                          <p className="font-medium">{l.nome}</p>
                          <p className="text-xs text-muted-foreground">{l.empreendimento || "Sem empreendimento"} · {l.telefone || ""}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {leadSearch.length >= 2 && searchLeads.length === 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                      Nenhum lead disponível. Tarefa manual só existe em <span className="text-foreground/80">Qualificação, Aquecimento e Em Negociação</span> — as demais etapas rodam por automação.
                    </p>
                  )}
                </div>
              )}
            </div>


            {/* Presets contextuais por etapa (Qualificação / Aquecimento / Negociação) */}
            {selectedLeadId && presetsDisponiveis.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Sugestão de próxima tarefa · <span className="text-foreground/70 capitalize">{stageTipoSelecionado}</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {presetsDisponiveis.map((p) => {
                    const Icon = p.Icon;
                    const active = presetSelecionadoId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPresetSelecionadoId(p.id);
                          if (p.id === PRESET_OUTRO_ID) return; // "outro" só limpa a seleção visual
                          const payload = applyPresetToTarefa(p);
                          setNovoTipo(payload.tipo);
                          setNovoData(payload.vence_em);
                          setNovoHora(payload.hora_vencimento ?? "");
                          setNovoObs(payload.obs ?? "");
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border text-foreground",
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{TIPO_EMOJI[k]} {v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data</label>
                <Input type="date" value={novoData} max={maxTaskDateBRT()} onChange={e => setNovoData(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Hora</label>
                <Input type="time" value={novoHora} onChange={e => setNovoHora(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Observação</label>
              <Textarea value={novoObs} onChange={e => setNovoObs(e.target.value)} placeholder="Ex: Retornar sobre financiamento" rows={2} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNovaTarefa(false)}>Cancelar</Button>
              <Button onClick={handleCriarTarefa} disabled={!selectedLeadId || !novoData}>✅ Criar Tarefa</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Scripts Marketplace Sheet */}
      <Sheet open={scriptsOpen} onOpenChange={setScriptsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Scripts Prontos
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Carregando scripts...</div>}>
              <CorretorScriptsView />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>

      {/* Task Completion Dialog */}
      <TaskCompletionDialog
        open={!!completingTarefa}
        onOpenChange={(v) => { if (!v) setCompletingTarefa(null); }}
        tarefaTitulo={completingTarefa?.titulo || ""}
        leadNome={completingTarefa?.lead_nome}
        leadId={completingTarefa?.pipeline_lead_id}
        context="lead"
        onConfirm={handleCompletionConfirm}
      />
    </div>
  );
}
