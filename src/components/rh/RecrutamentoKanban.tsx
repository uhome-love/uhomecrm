import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AgendaRecrutamento from "@/components/rh/AgendaRecrutamento";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Mail, Users, Plus, CalendarDays, Megaphone, UserCheck, Video, Search, X, Paperclip, Download, Trash2, FileText, Loader2 } from "lucide-react";
import { MEET_LINK } from "@/config/recrutamento";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";


/**
 * RecrutamentoKanban — kanban compartilhado entre a tela da RH (todos os
 * candidatos + criação + atribuição de gerente) e a tela do gerente
 * ("Meus Candidatos", só os candidatos com gerente_id = usuário logado).
 */

export const ETAPAS = [
  { key: "novo_lead", label: "Novo Lead", color: "#4969FF" },
  { key: "atendimento", label: "Atendimento", color: "#06B6D4" },
  { key: "entrevista_marcada", label: "Entrevista Marcada", color: "#F97316" },
  { key: "pre_entrevista_realizada", label: "Pré-Entrevista Realizada", color: "#EAB308" },
  { key: "entrevista_realizada", label: "Entrevista Presencial Realizada", color: "#10B981" },
  { key: "contratado", label: "Contratado", color: "#22C55E" },
  { key: "sem_interesse", label: "Não Tem Interesse", color: "#EF4444" },
];


type Temperatura = "quente" | "morno" | "frio";

const TEMP_META: Record<Temperatura, { label: string; color: string; soft: string }> = {
  quente: { label: "QUENTE", color: "#E0533A", soft: "rgba(224, 83, 58, 0.12)" },
  morno: { label: "MORNO", color: "#E0982A", soft: "rgba(224, 152, 42, 0.12)" },
  frio: { label: "FRIO", color: "#7C8AA3", soft: "rgba(124, 138, 163, 0.14)" },
};

const TEMP_ORDER: Record<string, number> = { quente: 0, morno: 1, frio: 2 };

function normTemp(v?: string | null): Temperatura | null {
  const s = (v || "").toLowerCase();
  return s === "quente" || s === "morno" || s === "frio" ? (s as Temperatura) : null;
}

interface QuizRespostas {
  nome?: string;
  telefone?: string;
  vendas?: string;
  imobiliario?: string;
  disponibilidade?: string;
  regiao?: string;
  motivacao?: string;
  [k: string]: unknown;
}

export interface Candidato {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  observacoes: string | null;
  etapa: string;
  created_at: string;
  temperatura?: string | null;
  respostas?: QuizRespostas | null;
  gerente_id?: string | null;
}

interface Gerente {
  user_id: string;
  nome: string;
  avatar_url: string | null;
}

interface EntrevistaInfo {
  id: string;
  data_entrevista: string;
  local: string | null;
}

interface Anexo {
  id: string;
  nome: string;
  path: string;
  mime: string | null;
  tamanho: number | null;
  created_at: string;
}

const ANEXO_BUCKET = "rh-candidato-docs";

const STATUS_ENTREVISTA_LABEL: Record<string, string> = {
  cancelada: "Cancelada",
  realizada: "Realizada",
  nao_compareceu: "Não compareceu",
};

function fmtTamanho(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function slugArquivo(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function shorten(v: unknown, max = 22): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function miniTags(r?: QuizRespostas | null): string[] {
  if (!r) return [];
  return [shorten(r.vendas), shorten(r.imobiliario), shorten(r.disponibilidade)]
    .filter((x): x is string => !!x)
    .slice(0, 3);
}

function formatEntrevista(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
}

function prefEntrevista(r?: QuizRespostas | null): { data: string; turno: "manha" | "tarde"; label: string } | null {
  if (!r) return null;
  const data = typeof r.pref_data === "string" ? r.pref_data : null;
  const turno = r.pref_turno === "manha" || r.pref_turno === "tarde" ? r.pref_turno : null;
  if (!data || !turno) return null;
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return null;
  const d = new Date(`${data}T12:00:00-03:00`);
  const semana = Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(d).replace(".", "");
  return {
    data,
    turno,
    label: `${semana ? `${semana} ` : ""}${dia}/${mes} · ${turno === "manha" ? "Manhã" : "Tarde"}`,
  };
}

function iniciais(nome?: string | null): string {
  const parts = (nome || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/** Quebra um ISO (ou agora) em data (yyyy-mm-dd) e hora (HH:mm) no fuso BRT. */
function brtParts(iso?: string | null): { data: string; hora: string } {
  const d = iso ? new Date(iso) : new Date();
  const data = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { data, hora };
}

/** Junta data (yyyy-mm-dd) + hora (HH:mm) BRT (-03:00) num ISO UTC. */
function brtToISO(data: string, hora: string): string {
  return new Date(`${data}T${hora}:00-03:00`).toISOString();
}

function TemperaturaBadge({ t }: { t: Temperatura }) {
  const m = TEMP_META[t];
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
      style={{ background: m.soft, color: m.color }}
    >
      {m.label}
    </span>
  );
}

function GerenteChip({ g, size = "sm" }: { g: Gerente; size?: "sm" | "md" }) {
  const px = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <Avatar className={px}>
        {g.avatar_url && <AvatarImage src={g.avatar_url} alt={g.nome} />}
        <AvatarFallback className="text-[8px]">{iniciais(g.nome)}</AvatarFallback>
      </Avatar>
      {g.nome}
    </span>
  );
}

interface Props {
  /** 'rh' = todos os candidatos, cria e atribui gerente. 'gerente' = só os meus. */
  scope: "rh" | "gerente";
  title?: string;
  subtitle?: string;
}

export default function RecrutamentoKanban({ scope, title, subtitle }: Props) {
  const { user } = useAuth();
  const { isAdmin, isRh: hasRhRole, isDiretor: hasDiretorRole } = useUserRole();
  // Diretoria: acompanha em modo leitura (sem criar, atribuir ou mover)
  const readOnly = scope === "rh" && hasDiretorRole && !hasRhRole && !isAdmin;
  const isRh = scope === "rh" && !readOnly;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"kanban" | "agenda">(
    searchParams.get("tab") === "agenda" ? "agenda" : "kanban"
  );

  // Mantém a aba em sincronia com o ?tab da URL (links diretos / redirects)
  useEffect(() => {
    const urlTab = searchParams.get("tab") === "agenda" ? "agenda" : "kanban";
    setTab((prev) => (prev === urlTab ? prev : urlTab));
  }, [searchParams]);

  // Indicador de rolagem horizontal do board
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [maisColunas, setMaisColunas] = useState(false);
  const atualizarScroll = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    setMaisColunas(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
  }, []);
  useEffect(() => {
    atualizarScroll();
    window.addEventListener("resize", atualizarScroll);
    return () => window.removeEventListener("resize", atualizarScroll);
  }, [atualizarScroll, tab]);



  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [entrevistas, setEntrevistas] = useState<Record<string, EntrevistaInfo>>({});
  const [gerentes, setGerentes] = useState<Gerente[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidato | null>(null);
  const [obsDraft, setObsDraft] = useState("");
  const [savingObs, setSavingObs] = useState(false);


  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("whatsapp");
  const [observacoes, setObservacoes] = useState("");

  // Filtros do board (só aplicam ao Kanban; a Agenda tem os próprios)
  const [busca, setBusca] = useState("");
  const [filtroGerente, setFiltroGerente] = useState<string>("todos"); // "todos" | "sem" | user_id
  const [filtroTemp, setFiltroTemp] = useState<string>("todas");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todas");
  const filtrosAtivos = busca.trim() !== "" || filtroGerente !== "todos" || filtroTemp !== "todas" || filtroOrigem !== "todas";
  const limparFiltros = () => { setBusca(""); setFiltroGerente("todos"); setFiltroTemp("todas"); setFiltroOrigem("todas"); };

  // Diálogos de entrevista (marcar / remarcar / cancelar) — só RH/admin
  const [entrevistaDlg, setEntrevistaDlg] = useState<{ mode: "criar" | "remarcar"; candidatoId: string; entrevistaId?: string; data: string; hora: string; local: string } | null>(null);
  const [savingEntrevista, setSavingEntrevista] = useState(false);
  const [cancelDlg, setCancelDlg] = useState<{ entrevistaId: string; candidatoId: string; motivo: string } | null>(null);
  const [savingCancel, setSavingCancel] = useState(false);

  // Anexos (documentos do candidato)
  const [anexosCount, setAnexosCount] = useState<Record<string, number>>({});
  const [detailAnexos, setDetailAnexos] = useState<Anexo[]>([]);
  const [detailHistorico, setDetailHistorico] = useState<{ id: string; data_entrevista: string; status: string; local: string | null; motivo_cancelamento: string | null }[]>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOverDoc, setDragOverDoc] = useState(false);

  // Drag & drop de card entre colunas (nativo, sem lib)
  const dragCandidatoId = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const gerenteById = useMemo(() => {
    const m: Record<string, Gerente> = {};
    for (const g of gerentes) m[g.user_id] = g;
    return m;
  }, [gerentes]);

  const fetchCandidatos = async () => {
    let q = supabase.from("rh_candidatos" as any).select("*").order("created_at", { ascending: false });
    if (scope !== "rh" && user?.id) q = q.eq("gerente_id", user.id);
    const { data, error } = await q;
    if (!error) setCandidatos((data || []) as unknown as Candidato[]);
  };

  const fetchEntrevistas = async () => {
    const { data, error } = await supabase
      .from("rh_entrevistas" as any)
      .select("id, candidato_id, data_entrevista, local, status")
      .eq("status", "agendada")
      .order("data_entrevista", { ascending: true });
    if (error) return;
    const map: Record<string, EntrevistaInfo> = {};
    for (const e of (data || []) as unknown as { id: string; candidato_id: string; data_entrevista: string; local: string | null }[]) {
      if (e.candidato_id && !map[e.candidato_id]) map[e.candidato_id] = { id: e.id, data_entrevista: e.data_entrevista, local: e.local ?? null };
    }
    setEntrevistas(map);
  };

  const fetchGerentes = async () => {
    // Fonte = papel real (user_roles): gestor e NÃO diretor
    const { data, error } = await supabase.rpc("get_gerentes_recrutamento" as any);
    if (error) return;
    const list = ((data || []) as any[])
      .filter((p) => p.user_id)
      .map((p) => ({ user_id: p.user_id as string, nome: (p.nome as string) || "Gerente", avatar_url: p.avatar_url ?? null }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setGerentes(list);
  };

  const fetchAnexosCount = async () => {
    const { data, error } = await supabase.from("rh_candidato_anexos" as any).select("candidato_id");
    if (error) return;
    const m: Record<string, number> = {};
    for (const r of (data || []) as unknown as { candidato_id: string }[]) m[r.candidato_id] = (m[r.candidato_id] || 0) + 1;
    setAnexosCount(m);
  };

  const fetchDetailAnexos = async (candidatoId: string) => {
    setLoadingAnexos(true);
    const { data, error } = await supabase
      .from("rh_candidato_anexos" as any)
      .select("id, nome, path, mime, tamanho, created_at")
      .eq("candidato_id", candidatoId)
      .order("created_at", { ascending: false });
    setLoadingAnexos(false);
    if (!error) setDetailAnexos((data || []) as unknown as Anexo[]);
  };

  const fetchDetailHistorico = async (candidatoId: string) => {
    const { data } = await supabase
      .from("rh_entrevistas" as any)
      .select("id, data_entrevista, status, local, motivo_cancelamento")
      .eq("candidato_id", candidatoId)
      .neq("status", "agendada")
      .order("data_entrevista", { ascending: false });
    setDetailHistorico((data || []) as unknown as typeof detailHistorico);
  };


  useEffect(() => {
    fetchCandidatos();
    fetchEntrevistas();
    fetchAnexosCount();
    if (isRh) fetchGerentes();
    else fetchGerentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, user?.id]);

  // Auto-atualização: refetch ao focar aba/janela + Realtime (aditivo)
  const fetchRef = useRef<() => void>(() => {});
  fetchRef.current = () => { fetchCandidatos(); fetchEntrevistas(); fetchAnexosCount(); };

  useEffect(() => {
    const onFocus = () => fetchRef.current();
    const onVisibility = () => { if (document.visibilityState === "visible") fetchRef.current(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchRef.current(), 400);
    };

    const channel = supabase
      .channel("rh_recrutamento_kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_candidatos" }, debouncedRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_entrevistas" }, debouncedRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_candidato_anexos" }, debouncedRefetch)
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, user?.id]);


  const handleAdd = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const { error } = await supabase.from("rh_candidatos" as any).insert({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      origem,
      observacoes: observacoes.trim() || null,
      etapa: "novo_lead",
      created_by: user?.id,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Candidato adicionado!");
    setDialogOpen(false);
    setNome(""); setTelefone(""); setEmail(""); setOrigem("whatsapp"); setObservacoes("");
    fetchCandidatos();
  };

  const moveToEtapa = async (id: string, etapa: string) => {
    const { error } = await supabase.from("rh_candidatos" as any).update({ etapa, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Erro ao mover"); return; }
    fetchCandidatos();
  };

  const atribuirGerente = async (id: string, gerenteId: string | null) => {
    const { error } = await supabase
      .from("rh_candidatos" as any)
      .update({ gerente_id: gerenteId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erro ao atribuir gerente"); return; }
    toast.success(gerenteId ? "Gerente atribuído!" : "Atribuição removida");
    setDetailCandidate((c) => (c && c.id === id ? { ...c, gerente_id: gerenteId } : c));
    fetchCandidatos();

    // Notificação in-app para o gerente (silenciosa: nunca quebra a atribuição)
    if (gerenteId) {
      const nomeCand = candidatos.find((c) => c.id === id)?.nome || "Candidato";
      try {
        await supabase.rpc("criar_notificacao" as any, {
          p_user_id: gerenteId,
          p_tipo: "info",
          p_categoria: "recrutamento_atribuicao",
          p_titulo: "Novo candidato atribuído a você",
          p_mensagem: `${nomeCand} foi atribuído a você no funil de recrutamento.`,
          p_dados: { candidato_id: id, url: "/gerente/candidatos" },
          p_agrupamento_key: `recrutamento_atribuicao:${id}:${gerenteId}`,
        });
      } catch (e) {
        console.error("[recrutamento] falha ao notificar gerente", e);
      }
    }
  };

  // Observações da RH (campo editável no modal)
  useEffect(() => {
    setObsDraft(detailCandidate?.observacoes ?? "");
  }, [detailCandidate?.id, detailCandidate?.observacoes]);

  useEffect(() => {
    if (detailCandidate?.id) { fetchDetailAnexos(detailCandidate.id); fetchDetailHistorico(detailCandidate.id); }
    else { setDetailAnexos([]); setDetailHistorico([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailCandidate?.id]);

  const salvarObservacoes = async (id: string) => {
    setSavingObs(true);
    const valor = obsDraft.trim() || null;
    const { error } = await supabase
      .from("rh_candidatos" as any)
      .update({ observacoes: valor, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSavingObs(false);
    if (error) { toast.error("Erro ao salvar observações"); return; }
    toast.success("Observações salvas!");
    setDetailCandidate((c) => (c && c.id === id ? { ...c, observacoes: valor } : c));
    setCandidatos((list) => list.map((c) => (c.id === id ? { ...c, observacoes: valor } : c)));
  };

  // ── Entrevista: marcar / remarcar / cancelar (RH/admin) ──────────────────────
  const abrirMarcar = (candidatoId: string) => {
    const { data, hora } = brtParts(null);
    const cand = candidatos.find((c) => c.id === candidatoId);
    const pref = prefEntrevista(cand?.respostas);
    setEntrevistaDlg({
      mode: "criar",
      candidatoId,
      data: pref?.data || data,
      hora: pref ? (pref.turno === "manha" ? "09:00" : "14:00") : hora,
      local: "",
    });
  };
  const abrirRemarcar = (candidatoId: string, e: EntrevistaInfo) => {
    const { data, hora } = brtParts(e.data_entrevista);
    setEntrevistaDlg({ mode: "remarcar", candidatoId, entrevistaId: e.id, data, hora, local: e.local ?? "" });
  };

  const salvarEntrevista = async () => {
    if (!entrevistaDlg) return;
    const { mode, candidatoId, entrevistaId, data, hora, local } = entrevistaDlg;
    if (!data || !hora) { toast.error("Informe data e hora"); return; }
    const iso = brtToISO(data, hora);
    setSavingEntrevista(true);
    if (mode === "criar") {
      const { error } = await supabase.from("rh_entrevistas" as any).insert({
        candidato_id: candidatoId, data_entrevista: iso, local: local.trim() || "Entrevista", status: "agendada", created_by: user?.id,
      });
      if (error) { setSavingEntrevista(false); toast.error(error.code === "23505" ? "Já existe entrevista nesse horário" : "Erro ao marcar entrevista"); return; }
      await supabase.from("rh_candidatos" as any).update({ etapa: "entrevista_marcada", updated_at: new Date().toISOString() }).eq("id", candidatoId);
      toast.success("Entrevista marcada!");
    } else {
      const { error } = await supabase.from("rh_entrevistas" as any).update({ data_entrevista: iso, local: local.trim() || null, updated_at: new Date().toISOString() }).eq("id", entrevistaId!);
      if (error) { setSavingEntrevista(false); toast.error(error.code === "23505" ? "Já existe entrevista nesse horário" : "Erro ao remarcar"); return; }
      toast.success("Entrevista remarcada!");
    }
    setSavingEntrevista(false);
    setEntrevistaDlg(null);
    fetchCandidatos(); fetchEntrevistas();
  };

  const abrirCancelar = (entrevistaId: string, candidatoId: string) => setCancelDlg({ entrevistaId, candidatoId, motivo: "" });

  const confirmarCancelamento = async () => {
    if (!cancelDlg) return;
    if (!cancelDlg.motivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    setSavingCancel(true);
    const { error } = await supabase.from("rh_entrevistas" as any).update({
      status: "cancelada", motivo_cancelamento: cancelDlg.motivo.trim(), cancelada_por: user?.id, cancelada_em: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", cancelDlg.entrevistaId);
    if (error) { setSavingCancel(false); toast.error("Erro ao cancelar entrevista"); return; }
    await supabase.from("rh_candidatos" as any).update({ etapa: "atendimento", updated_at: new Date().toISOString() }).eq("id", cancelDlg.candidatoId);
    setSavingCancel(false);
    setCancelDlg(null);
    toast.success("Entrevista cancelada — candidato voltou para Atendimento");
    fetchCandidatos(); fetchEntrevistas();
    if (detailCandidate) fetchDetailHistorico(detailCandidate.id);
  };

  // ── Anexos: upload / baixar / remover ────────────────────────────────────────
  const uploadAnexo = async (file: File) => {
    if (!detailCandidate) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo acima de 20 MB"); return; }
    setUploadingAnexo(true);
    const path = `${detailCandidate.id}/${Date.now()}_${slugArquivo(file.name)}`;
    const up = await supabase.storage.from(ANEXO_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) { setUploadingAnexo(false); toast.error("Erro ao enviar arquivo: " + up.error.message); return; }
    const { error } = await supabase.from("rh_candidato_anexos" as any).insert({
      candidato_id: detailCandidate.id, nome: file.name, path, mime: file.type || null, tamanho: file.size, created_by: user?.id,
    });
    setUploadingAnexo(false);
    if (error) {
      await supabase.storage.from(ANEXO_BUCKET).remove([path]); // evita arquivo órfão
      toast.error("Erro ao registrar anexo: " + error.message);
      return;
    }
    toast.success("Documento anexado!");
    fetchDetailAnexos(detailCandidate.id);
    fetchAnexosCount();
  };

  const baixarAnexo = async (a: Anexo) => {
    const { data, error } = await supabase.storage.from(ANEXO_BUCKET).createSignedUrl(a.path, 60);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link do arquivo"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const removerAnexo = async (a: Anexo) => {
    const { error } = await supabase.from("rh_candidato_anexos" as any).delete().eq("id", a.id);
    if (error) { toast.error("Erro ao remover anexo"); return; }
    await supabase.storage.from(ANEXO_BUCKET).remove([a.path]);
    toast.success("Documento removido");
    setDetailAnexos((list) => list.filter((x) => x.id !== a.id));
    fetchAnexosCount();
  };



  const candidatosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return candidatos.filter((c) => {
      if (q) {
        const hay = `${c.nome} ${c.telefone ?? ""} ${c.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroGerente === "sem") {
        if (c.gerente_id) return false;
      } else if (filtroGerente !== "todos") {
        if (c.gerente_id !== filtroGerente) return false;
      }
      if (filtroTemp !== "todas" && normTemp(c.temperatura) !== filtroTemp) return false;
      if (filtroOrigem !== "todas" && (c.origem ?? "") !== filtroOrigem) return false;
      return true;
    });
  }, [candidatos, busca, filtroGerente, filtroTemp, filtroOrigem]);

  const getCandidatosByEtapa = (etapa: string) =>
    candidatosFiltrados
      .filter((c) => c.etapa === etapa)
      .sort((a, b) => {
        const ta = TEMP_ORDER[normTemp(a.temperatura) ?? ""] ?? 99;
        const tb = TEMP_ORDER[normTemp(b.temperatura) ?? ""] ?? 99;
        return ta - tb;
      });

  const detailTemp = normTemp(detailCandidate?.temperatura);
  const detailEntrevistaInfo = detailCandidate ? entrevistas[detailCandidate.id] : undefined;
  const detailEntrevista = detailEntrevistaInfo ? formatEntrevista(detailEntrevistaInfo.data_entrevista) : null;
  const podeEntrevista = !readOnly && isRh; // RH/admin no board da RH
  const detailRespostas = detailCandidate?.respostas || null;
  const detailPref = prefEntrevista(detailRespostas);
  const detailGerente = detailCandidate?.gerente_id ? gerenteById[detailCandidate.gerente_id] : null;

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-4 sm:p-6 lg:p-8 -m-4 sm:-m-6 lg:-m-8 h-[calc(100%+2rem)] sm:h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)] min-h-[520px] flex flex-col gap-4 overflow-hidden">
      <PageHeader
        title={title ?? "Candidatos"}
        subtitle={subtitle ?? "Pipeline de recrutamento"}
        icon={<Users size={18} strokeWidth={1.5} />}
        actions={
          isRh ? (
            <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-primary hover:bg-primary text-white gap-1 rounded-full shadow-sm">
              <Plus size={14} /> Novo Candidato
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v as "kanban" | "agenda";
          setTab(next);
          const params = new URLSearchParams(searchParams);
          if (next === "agenda") params.set("tab", "agenda");
          else params.delete("tab");
          setSearchParams(params, { replace: true });
        }}

        className="flex-1 min-h-0 flex flex-col"
      >
        <TabsList className="h-9 rounded-full bg-background/80 border border-border/60 p-1 shadow-sm self-start">
          <TabsTrigger
            value="kanban"
            className="rounded-full px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Kanban
          </TabsTrigger>
          <TabsTrigger
            value="agenda"
            className="rounded-full px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <AgendaRecrutamento
            candidatos={candidatos.map((c) => ({ id: c.id, nome: c.nome, etapa: c.etapa }))}
            onKanbanUpdate={() => { fetchCandidatos(); fetchEntrevistas(); }}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
          {/* Barra de filtros do board */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome, telefone, e-mail"
                className="h-9 w-[230px] pl-8 rounded-full bg-background"
              />
            </div>

            {scope === "rh" && (
              <Select value={filtroGerente} onValueChange={setFiltroGerente}>
                <SelectTrigger className="h-9 w-[170px] rounded-full bg-background text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os gerentes</SelectItem>
                  <SelectItem value="sem">Sem gerente</SelectItem>
                  {gerentes.map((g) => (
                    <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filtroTemp} onValueChange={setFiltroTemp}>
              <SelectTrigger className="h-9 w-[130px] rounded-full bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda temperatura</SelectItem>
                <SelectItem value="quente">Quente</SelectItem>
                <SelectItem value="morno">Morno</SelectItem>
                <SelectItem value="frio">Frio</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger className="h-9 w-[130px] rounded-full bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda origem</SelectItem>
                <SelectItem value="anuncio">Anúncio</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            {filtrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9 rounded-full px-3 text-xs text-muted-foreground gap-1">
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {candidatosFiltrados.length} de {candidatos.length}
            </span>
          </div>

          {/* Kanban — ocupa toda a altura; a rolagem horizontal fica no rodapé */}
          <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={boardRef}
            onScroll={atualizarScroll}
            className="flex-1 min-h-0 flex gap-3 overflow-x-auto overflow-y-hidden scrollbar-thin pb-1"
          >

            {ETAPAS.map((etapa) => {
              const items = getCandidatosByEtapa(etapa.key);
              return (
                <div
                  key={etapa.key}
                  onDragOver={(e) => { if (dragCandidatoId.current && !readOnly) { e.preventDefault(); if (dragOverCol !== etapa.key) setDragOverCol(etapa.key); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverCol === etapa.key) setDragOverCol(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = dragCandidatoId.current;
                    dragCandidatoId.current = null;
                    setDragOverCol(null);
                    if (id && !readOnly) {
                      const cand = candidatos.find((x) => x.id === id);
                      if (cand && cand.etapa !== etapa.key) moveToEtapa(id, etapa.key);
                    }
                  }}
                  className={cn(
                    "min-w-[248px] max-w-[248px] flex-shrink-0 flex flex-col rounded-2xl border bg-background/70 dark:bg-white/[0.03] shadow-sm transition-colors",
                    dragOverCol === etapa.key ? "border-primary ring-2 ring-primary/30 bg-primary/[0.04]" : "border-border/60"
                  )}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: etapa.color }} />
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">{etapa.label}</span>
                    <span
                      className="ml-auto inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${etapa.color}1A`, color: etapa.color }}
                    >
                      {items.length}
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2.5 space-y-2.5">
                    {items.map((c) => {
                      const temp = normTemp(c.temperatura);
                      const tags = miniTags(c.respostas);
                      const entrevista = etapa.key === "entrevista_marcada" ? formatEntrevista(entrevistas[c.id]?.data_entrevista) : null;
                      const pref = !entrevista ? prefEntrevista(c.respostas) : null;
                      const ger = c.gerente_id ? gerenteById[c.gerente_id] : null;
                      return (
                        <Card
                          key={c.id}
                          draggable={!readOnly}
                          onDragStart={(e) => { dragCandidatoId.current = c.id; e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { dragCandidatoId.current = null; setDragOverCol(null); }}
                          className={cn(
                            "group cursor-pointer rounded-xl border-border/60 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_6px_18px_-6px_rgba(16,24,40,0.22)] hover:border-primary/35 transition-all bg-card overflow-hidden relative",
                            !readOnly && "active:cursor-grabbing"
                          )}
                          onClick={() => setDetailCandidate(c)}
                        >
                          {temp && (
                            <span
                              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                              style={{ background: TEMP_META[temp].color }}
                            />
                          )}
                          <CardContent className="p-3 pl-3.5 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] font-semibold leading-snug text-foreground truncate">{c.nome}</p>
                              {temp && <TemperaturaBadge t={temp} />}
                            </div>

                            {(c.telefone || c.email) && (
                              <div className="space-y-1">
                                {c.telefone && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                                    <Phone className="h-3 w-3 shrink-0 opacity-70" /> {c.telefone}
                                  </p>
                                )}
                                {c.email && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                                    <Mail className="h-3 w-3 shrink-0 opacity-70" />
                                    <span className="truncate">{c.email}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {entrevista && (
                              <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary/8 text-primary px-2 py-1 text-[11px] font-semibold">
                                <CalendarDays className="h-3 w-3" /> {entrevista}
                              </p>
                            )}

                            {pref && (
                              <p className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 text-muted-foreground px-2 py-1 text-[10.5px] font-semibold">
                                <CalendarDays className="h-3 w-3" /> Prefere: {pref.label}
                              </p>
                            )}

                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {tags.map((t, i) => (
                                  <span
                                    key={i}
                                    className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] leading-4 text-muted-foreground"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {(ger || c.origem || (anexosCount[c.id] ?? 0) > 0) && (
                              <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/50">
                                {ger && <GerenteChip g={ger} />}
                                {(anexosCount[c.id] ?? 0) > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="Documentos anexados">
                                    <Paperclip className="h-2.5 w-2.5" /> {anexosCount[c.id]}
                                  </span>
                                )}
                                {c.origem === "anuncio" ? (
                                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                                    <Megaphone className="h-3 w-3" /> veio do anúncio
                                  </span>
                                ) : (
                                  c.origem && (
                                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                                      {c.origem}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {items.length === 0 && (
                      <div className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border/70 px-3 py-6 gap-1.5">
                        <Users size={18} strokeWidth={1.5} className="text-muted-foreground/60" />
                        <p className="text-[11px] font-medium text-muted-foreground">Nenhum candidato</p>
                        {isRh && (
                          <button
                            type="button"
                            onClick={() => setDialogOpen(true)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Novo candidato
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
            {/* Indicador sutil de rolagem horizontal */}
            {maisColunas && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 right-0 h-full w-14 bg-gradient-to-l from-background to-transparent rounded-r-2xl"
              />
            )}
          </div>
        </TabsContent>

      </Tabs>




      {/* Add Dialog (só RH) */}
      {isRh && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Novo Candidato</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="h-9" /></div>
                <div><Label className="text-xs">E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" /></div>
              </div>
              <div>
                <Label className="text-xs">Origem</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="h-16" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailCandidate} onOpenChange={() => setDetailCandidate(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin p-0 gap-0 rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-5 border-b border-border/60 bg-muted/20 rounded-t-2xl">
            <DialogTitle asChild>
              <div className="flex items-center gap-3.5 text-left">
                <span
                  className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
                  style={
                    detailTemp
                      ? { background: TEMP_META[detailTemp].soft, color: TEMP_META[detailTemp].color }
                      : { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }
                  }
                >
                  {iniciais(detailCandidate?.nome)}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-lg font-semibold leading-tight text-foreground truncate">{detailCandidate?.nome}</p>
                  <div className="flex items-center gap-2">
                    {detailTemp && <TemperaturaBadge t={detailTemp} />}
                    {detailCandidate?.origem && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{detailCandidate.origem}</span>
                    )}
                  </div>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          {detailCandidate && (
            <div className="px-6 py-6 space-y-6">
              {/* Contato */}
              {(detailCandidate.telefone || detailCandidate.email) && (
                <section className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contato</p>
                  <div className="rounded-xl border border-border/60 bg-muted/25 divide-y divide-border/50">
                    {detailCandidate.telefone && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Phone className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-foreground">{detailCandidate.telefone}</span>
                      </div>
                    )}
                    {detailCandidate.email && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Mail className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-foreground break-all">{detailCandidate.email}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Entrevista + origem */}
              {(detailEntrevistaInfo || podeEntrevista || detailCandidate.origem) && (
                <section className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-4 space-y-3">
                  {detailEntrevistaInfo ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
                          <CalendarDays className="h-4 w-4 text-primary" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entrevista</p>
                          <p className="text-sm font-semibold text-foreground">{detailEntrevista}</p>
                          {detailEntrevistaInfo.local && <p className="text-[11px] text-muted-foreground truncate">{detailEntrevistaInfo.local}</p>}
                        </div>
                        <a
                          href={MEET_LINK}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/15 transition-colors"
                        >
                          <Video className="h-3.5 w-3.5" /> Entrar no Meet
                        </a>
                      </div>
                      {podeEntrevista && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs gap-1.5" onClick={() => abrirRemarcar(detailCandidate.id, detailEntrevistaInfo)}>
                            <CalendarDays className="h-3.5 w-3.5" /> Remarcar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => abrirCancelar(detailEntrevistaInfo.id, detailCandidate.id)}>
                            <X className="h-3.5 w-3.5" /> Cancelar
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    podeEntrevista && (
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
                          <CalendarDays className="h-4 w-4 text-primary" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entrevista</p>
                          <p className="text-sm text-muted-foreground">
                            {detailPref ? `Prefere: ${detailPref.label}` : "Nenhuma entrevista marcada"}
                          </p>
                        </div>
                        <Button size="sm" className="ml-auto h-8 rounded-full px-3 text-xs gap-1.5" onClick={() => abrirMarcar(detailCandidate.id)}>
                          <Plus className="h-3.5 w-3.5" /> Agendar entrevista
                        </Button>
                      </div>
                    )
                  )}
                  {detailCandidate.origem && (
                    <Badge variant="outline" className="gap-1 rounded-full border-primary/40 text-primary bg-background/70">
                      <Megaphone className="h-3 w-3" /> {detailCandidate.origem}
                    </Badge>
                  )}
                </section>
              )}


              {/* Histórico de entrevistas (canceladas / realizadas / faltou) */}
              {detailHistorico.length > 0 && (
                <section className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Histórico de entrevistas</p>
                  <div className="rounded-xl border border-border/60 divide-y divide-border/50 overflow-hidden">
                    {detailHistorico.map((h) => (
                      <div key={h.id} className="flex items-start gap-2.5 px-3 py-2.5">
                        <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", h.status === "realizada" ? "bg-emerald-500" : h.status === "cancelada" ? "bg-red-500" : "bg-amber-500")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] text-foreground">
                            {formatEntrevista(h.data_entrevista)} <span className="text-muted-foreground">· {STATUS_ENTREVISTA_LABEL[h.status] ?? h.status}</span>
                          </p>
                          {h.motivo_cancelamento && <p className="text-[11px] text-muted-foreground">Motivo: {h.motivo_cancelamento}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Gerente */}
              {(detailGerente || isRh) && (
                <section className="rounded-xl border border-border/60 px-4 py-4 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-primary" /> Gerente
                  </p>
                  {detailGerente && <GerenteChip g={detailGerente} size="md" />}
                  {isRh && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Atribuir a gerente</Label>
                      <Select
                        value={detailCandidate.gerente_id ?? "none"}
                        onValueChange={(v) => atribuirGerente(detailCandidate.id, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Selecionar gerente" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem gerente</SelectItem>
                          {gerentes.map((g) => (
                            <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </section>
              )}

              {/* Respostas do quiz */}
              {detailRespostas && (
                <section className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Respostas do quiz</p>
                  <div className="space-y-3">
                    {[
                      ["Vendas", detailRespostas.vendas],
                      ["Imobiliário", detailRespostas.imobiliario],
                      ["Disponibilidade", detailRespostas.disponibilidade],
                      ["Região", detailRespostas.regiao],
                      ["Motivação", detailRespostas.motivacao],
                    ].map(([label, value]) =>
                      value ? (
                        <div key={label as string} className="border-l-2 border-primary/40 pl-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label as string}</p>
                          <p className="text-sm text-foreground leading-relaxed">{String(value)}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                </section>
              )}

              {/* Observações da RH */}
              <section className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Observações da RH</p>
                {readOnly ? (
                  <p className="text-sm text-muted-foreground bg-muted/35 border border-border/60 rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed">
                    {detailCandidate.observacoes || "Sem observações — adicione anotações sobre o perfil"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={obsDraft}
                      onChange={(e) => setObsDraft(e.target.value)}
                      placeholder="Sem observações — adicione anotações sobre o perfil"
                      className="min-h-[88px] rounded-xl text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="h-8 rounded-full px-4 text-xs"
                        disabled={savingObs || obsDraft === (detailCandidate.observacoes ?? "")}
                        onClick={() => salvarObservacoes(detailCandidate.id)}
                      >
                        {savingObs ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </div>
                )}
              </section>


              {/* Documentos */}
              <section
                className="space-y-2"
                onDragOver={!readOnly ? (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOverDoc(true); } } : undefined}
                onDragLeave={!readOnly ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDoc(false); } : undefined}
                onDrop={!readOnly ? (e) => { e.preventDefault(); setDragOverDoc(false); const f = e.dataTransfer.files?.[0]; if (f) uploadAnexo(f); } : undefined}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-primary" /> Documentos
                  </p>
                  {!readOnly && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAnexo(f); e.currentTarget.value = ""; }}
                      />
                      <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs gap-1.5" disabled={uploadingAnexo} onClick={() => fileInputRef.current?.click()}>
                        {uploadingAnexo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {uploadingAnexo ? "Enviando..." : "Anexar"}
                      </Button>
                    </>
                  )}
                </div>

                {loadingAnexos ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">Carregando…</p>
                ) : detailAnexos.length > 0 ? (
                  <div className="rounded-xl border border-border/60 divide-y divide-border/50 overflow-hidden">
                    {detailAnexos.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                        <FileText className="h-4 w-4 text-primary/70 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-foreground truncate">{a.nome}</p>
                          {fmtTamanho(a.tamanho) && <p className="text-[10px] text-muted-foreground">{fmtTamanho(a.tamanho)}</p>}
                        </div>
                        <button type="button" onClick={() => baixarAnexo(a)} title="Baixar" className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {!readOnly && (
                          <button type="button" onClick={() => removerAnexo(a)} title="Remover" className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn(
                    "text-xs rounded-xl px-4 py-3 border transition-colors",
                    dragOverDoc ? "border-primary border-dashed bg-primary/[0.05] text-primary" : "text-muted-foreground bg-muted/35 border-border/60"
                  )}>
                    {readOnly ? "Nenhum documento anexado." : dragOverDoc ? "Solte o arquivo para anexar" : "Nenhum documento. Anexe ou arraste currículo, RG, contrato…"}
                  </p>
                )}
              </section>

              {/* Mover para etapa */}
              {!readOnly && (
                <section className="pt-5 border-t border-border/60 space-y-2.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mover para etapa</Label>
                  <div className="flex flex-wrap gap-2">
                    {ETAPAS.filter((e) => e.key !== detailCandidate.etapa).map((e) => (
                      <Button
                        key={e.key} size="sm" variant="outline"
                        className="text-xs h-8 rounded-full px-3.5 font-medium bg-background hover:bg-transparent transition-colors"
                        style={{ borderColor: `${e.color}66`, color: e.color }}
                        onClick={() => { moveToEtapa(detailCandidate.id, e.key); setDetailCandidate(null); }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: e.color }} />
                        {e.label}
                      </Button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo marcar / remarcar entrevista (RH/admin) */}
      <Dialog open={!!entrevistaDlg} onOpenChange={(o) => !o && setEntrevistaDlg(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{entrevistaDlg?.mode === "remarcar" ? "Remarcar entrevista" : "Marcar entrevista"}</DialogTitle></DialogHeader>
          {entrevistaDlg && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Data</Label><Input type="date" value={entrevistaDlg.data} onChange={(e) => setEntrevistaDlg({ ...entrevistaDlg, data: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Hora</Label><Input type="time" value={entrevistaDlg.hora} onChange={(e) => setEntrevistaDlg({ ...entrevistaDlg, hora: e.target.value })} className="h-9" /></div>
              </div>
              <div><Label className="text-xs">Local / observação (opcional)</Label><Input value={entrevistaDlg.local} onChange={(e) => setEntrevistaDlg({ ...entrevistaDlg, local: e.target.value })} placeholder="Entrevista" className="h-9" /></div>
              <p className="text-[11px] text-muted-foreground">Horário livre — o sistema só bloqueia se já houver entrevista nesse mesmo horário.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEntrevistaDlg(null)}>Fechar</Button>
            <Button size="sm" onClick={salvarEntrevista} disabled={savingEntrevista}>{savingEntrevista ? "Salvando..." : (entrevistaDlg?.mode === "remarcar" ? "Remarcar" : "Marcar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo cancelar entrevista (motivo → volta para Atendimento) */}
      <Dialog open={!!cancelDlg} onOpenChange={(o) => !o && setCancelDlg(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Cancelar entrevista</DialogTitle></DialogHeader>
          {cancelDlg && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">O horário é liberado e o candidato volta para <b className="text-foreground">Atendimento</b>.</p>
              <Label className="text-xs">Motivo do cancelamento *</Label>
              <Textarea value={cancelDlg.motivo} onChange={(e) => setCancelDlg({ ...cancelDlg, motivo: e.target.value })} placeholder="Ex.: candidato pediu para remarcar, não pôde comparecer..." className="min-h-[80px]" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelDlg(null)}>Voltar</Button>
            <Button size="sm" variant="destructive" onClick={confirmarCancelamento} disabled={savingCancel}>{savingCancel ? "Cancelando..." : "Cancelar entrevista"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
