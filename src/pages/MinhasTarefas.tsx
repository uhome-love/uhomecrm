import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isBefore, startOfDay, endOfWeek, addDays, addHours } from "date-fns";
import { dateToBRT, parseDateBRT } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { Phone, MessageCircle, CheckCircle2, Clock, Calendar, Building2, User, ClipboardList, Plus, Search, Pencil, BookOpen, Target, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { lazy, Suspense } from "react";

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

type TabFilter = "hoje" | "amanha" | "semana" | "atrasadas" | "concluidas";

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  window.open(`https://wa.me/${full}`, "_blank");
}

export default function MinhasTarefas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState<"leads" | "negocios">("leads");
  const [activeTab, setActiveTab] = useState<TabFilter>("hoje");
  const [adiarId, setAdiarId] = useState<string | null>(null);
  const [adiarData, setAdiarData] = useState("");
  const [adiarHora, setAdiarHora] = useState("");
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [showTipoSelector, setShowTipoSelector] = useState(false);
  const [showNovaTarefaNegocio, setShowNovaTarefaNegocio] = useState(false);
  const [novoTipo, setNovoTipo] = useState("follow_up");
  const [novoData, setNovoData] = useState("");
  const [novoHora, setNovoHora] = useState("");
  const [novoObs, setNovoObs] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadNome, setSelectedLeadNome] = useState("");
  // Negocio task state
  const [negocioSearch, setNegocioSearch] = useState("");
  const [selectedNegocioId, setSelectedNegocioId] = useState<string | null>(null);
  const [selectedNegocioNome, setSelectedNegocioNome] = useState("");
  const [negocioTipo, setNegocioTipo] = useState("mandar_simulacao");
  const [negocioData, setNegocioData] = useState("");
  const [negocioHora, setNegocioHora] = useState("");
  const [negocioObs, setNegocioObs] = useState("");
  // Edit task state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState("follow_up");
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editObs, setEditObs] = useState("");
  const [scriptsOpen, setScriptsOpen] = useState(false);

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["minhas-tarefas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("pipeline_tarefas")
        .select("*")
        .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("vence_em", { ascending: true })
        .order("hora_vencimento", { ascending: true });
      if (error) return [];
      const rows = (data || []) as any[];
      const leadIds = [...new Set(rows.map(r => r.pipeline_lead_id).filter(Boolean))];
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads").select("id, nome, telefone, empreendimento").in("id", leadIds);
        const leadMap = new Map((leads || []).map(l => [l.id, l]));
        rows.forEach(r => {
          const lead = leadMap.get(r.pipeline_lead_id);
          if (lead) { r.lead_nome = lead.nome; r.lead_telefone = lead.telefone; r.lead_empreendimento = lead.empreendimento; }
        });
      }
      return rows as TarefaComLead[];
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  // ── Negocios tasks ──
  const { data: negociosTarefas = [], isLoading: isLoadingNegocios } = useQuery({
    queryKey: ["minhas-tarefas-negocios", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("negocios_tarefas")
        .select("*")
        .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("vence_em", { ascending: true })
        .order("hora_vencimento", { ascending: true });
      if (error) return [];
      const rows = (data || []) as any[];
      // Enrich with negocio info
      const negIds = [...new Set(rows.map(r => r.negocio_id).filter(Boolean))];
      if (negIds.length > 0) {
        const { data: negs } = await supabase
          .from("negocios").select("id, nome_cliente, telefone, empreendimento").in("id", negIds);
        const negMap = new Map((negs || []).map(n => [n.id, n]));
        rows.forEach(r => {
          const neg = negMap.get(r.negocio_id);
          if (neg) { r.lead_nome = neg.nome_cliente; r.lead_telefone = neg.telefone; r.lead_empreendimento = neg.empreendimento; r.pipeline_lead_id = neg.id; }
        });
      }
      return rows as TarefaComLead[];
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const { data: searchLeads = [] } = useQuery({
    queryKey: ["lead-search-tarefas", leadSearch],
    queryFn: async () => {
      if (!user || leadSearch.length < 2) return [];
      const { data } = await supabase.from("pipeline_leads").select("id, nome, telefone, empreendimento")
        .eq("corretor_id", user.id).ilike("nome", `%${leadSearch}%`).limit(10);
      return data || [];
    },
    enabled: !!user && leadSearch.length >= 2,
  });

  const { data: searchNegocios = [] } = useQuery({
    queryKey: ["negocio-search-tarefas", negocioSearch],
    queryFn: async () => {
      if (!user || negocioSearch.length < 2) return [];
      const { data } = await supabase.from("negocios").select("id, nome_cliente, empreendimento, fase")
        .not("fase", "eq", "caiu").ilike("nome_cliente", `%${negocioSearch}%`).limit(10);
      return (data || []) as { id: string; nome_cliente: string | null; empreendimento: string | null; fase: string | null }[];
    },
    enabled: !!user && negocioSearch.length >= 2,
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const activeTarefas = categoria === "leads" ? tarefas : negociosTarefas;

  const pendentes = useMemo(() => activeTarefas.filter(t => t.status === "pendente"), [activeTarefas]);
  const concluidas = useMemo(() => activeTarefas.filter(t => t.status === "concluida").slice(0, 20), [activeTarefas]);
  const atrasadas = useMemo(() => pendentes.filter(t => t.vence_em && isBefore(parseDateBRT(t.vence_em), todayStart)), [pendentes]);
  const hoje = useMemo(() => pendentes.filter(t => t.vence_em && isToday(parseDateBRT(t.vence_em))), [pendentes]);
  const amanha = useMemo(() => pendentes.filter(t => t.vence_em && isTomorrow(parseDateBRT(t.vence_em))), [pendentes]);
  const semana = useMemo(() => pendentes.filter(t => {
    if (!t.vence_em) return false;
    const d = parseDateBRT(t.vence_em);
    return d >= todayStart && d <= weekEnd;
  }), [pendentes]);

  const filteredTarefas = activeTab === "atrasadas" ? atrasadas : activeTab === "hoje" ? hoje :
    activeTab === "amanha" ? amanha : activeTab === "concluidas" ? concluidas : semana;

  const handleConcluir = async (id: string, leadId: string) => {
    if (categoria === "negocios") {
      await supabase.from("negocios_tarefas").update({ status: "concluida", concluida_em: new Date().toISOString() } as any).eq("id", id);
      toast.success("Tarefa concluída ✅");
      queryClient.invalidateQueries({ queryKey: ["minhas-tarefas-negocios"] });
      return;
    }
    await supabase.from("pipeline_tarefas").update({ status: "concluida", concluida_em: new Date().toISOString() } as any).eq("id", id);
    await supabase.from("pipeline_leads").update({ ultima_acao_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any).eq("id", leadId);
    toast.success("Tarefa concluída ✅");
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
  };

  const handleAdiarRapido = async (id: string, horas: number) => {
    const novaData = addHours(new Date(), horas);
    await supabase.from("pipeline_tarefas").update({ vence_em: dateToBRT(novaData), hora_vencimento: format(novaData, "HH:mm") } as any).eq("id", id);
    toast.success("Tarefa adiada ✅");
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
  };

  const handleAdiarCustom = async () => {
    if (!adiarId || !adiarData) return;
    await supabase.from("pipeline_tarefas").update({ vence_em: adiarData, hora_vencimento: adiarHora || null } as any).eq("id", adiarId);
    toast.success("Tarefa reagendada ✅");
    setAdiarId(null);
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
  };

  const handleCriarTarefa = async () => {
    if (!user || !selectedLeadId || !novoData) return;
    await supabase.from("pipeline_tarefas").insert({
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
    toast.success("Tarefa criada ✅");
    setShowNovaTarefa(false);
    setSelectedLeadId(null);
    setSelectedLeadNome("");
    setLeadSearch("");
    setNovoObs("");
    setNovoData("");
    setNovoHora("");
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
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
    await supabase.from("pipeline_tarefas").update({
      tipo: editTipo,
      vence_em: editData || null,
      hora_vencimento: editHora || null,
      descricao: editObs || null,
      updated_at: new Date().toISOString(),
    } as any).eq("id", editId);
    toast.success("Tarefa atualizada ✅");
    setEditId(null);
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "atrasadas", label: "🔴 Atrasadas", count: atrasadas.length },
    { key: "hoje", label: "📅 Hoje", count: hoje.length },
    { key: "amanha", label: "📅 Amanhã", count: amanha.length },
    { key: "semana", label: "📅 Semana", count: semana.length },
    { key: "concluidas", label: "✅ Concluídas", count: concluidas.length },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
            <p className="text-sm text-muted-foreground">Organize seu dia e nunca perca um follow-up</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNovaTarefa(true)}>
          <Plus className="h-4 w-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Category tabs: Leads vs Negócios */}
      <div className="flex gap-2">
        <Button variant={categoria === "leads" ? "default" : "outline"} size="sm" className="text-sm gap-1.5" onClick={() => { setCategoria("leads"); setActiveTab("hoje"); }}>
          🎯 Tarefas de Leads
          <Badge variant="secondary" className="ml-1 text-xs">{tarefas.filter(t => t.status === "pendente").length}</Badge>
        </Button>
        <Button variant={categoria === "negocios" ? "default" : "outline"} size="sm" className="text-sm gap-1.5" onClick={() => { setCategoria("negocios"); setActiveTab("hoje"); }}>
          💼 Tarefas de Negócios
          <Badge variant="secondary" className="ml-1 text-xs">{negociosTarefas.filter(t => t.status === "pendente").length}</Badge>
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span>📊 <strong className="text-foreground">Hoje:</strong> {hoje.length} pendentes</span>
        <span>·</span>
        <span><strong className="text-destructive">Atrasadas:</strong> {atrasadas.length}</span>
        <span>·</span>
        <span><strong className="text-foreground">Amanhã:</strong> {amanha.length}</span>
        <span>·</span>
        <span><strong className="text-foreground">Semana:</strong> {semana.length}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <Button key={tab.key} variant={activeTab === tab.key ? "default" : "outline"} size="sm" className="text-sm gap-1.5" onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            <Badge variant="secondary" className="ml-1 text-xs">{tab.count}</Badge>
          </Button>
        ))}
      </div>

      {/* Task list */}
      {(isLoading || isLoadingNegocios) ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredTarefas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">🎉 Nenhuma tarefa {activeTab === "atrasadas" ? "atrasada" : activeTab === "concluidas" ? "concluída recente" : "para este período"}!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTarefas.map(tarefa => {
            const isOverdue = tarefa.vence_em && isBefore(parseDateBRT(tarefa.vence_em), todayStart) && tarefa.status === "pendente";
            const isConcluida = tarefa.status === "concluida";
            return (
              <Card key={tarefa.id} className={`p-4 border-l-[3px] ${
                isConcluida ? "border-l-green-500 bg-green-500/5 opacity-70" :
                isOverdue ? "border-l-red-500 bg-red-500/5" :
                isToday(new Date(tarefa.vence_em || "")) ? "border-l-yellow-500 bg-yellow-500/5" :
                "border-l-muted-foreground/40"
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {isOverdue && <Badge variant="destructive" className="text-[10px]">ATRASADA</Badge>}
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tarefa.vence_em ? format(parseDateBRT(tarefa.vence_em), "dd/MM", { locale: ptBR }) : "Sem data"}
                        {tarefa.hora_vencimento && ` ${tarefa.hora_vencimento.slice(0, 5)}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {TIPO_EMOJI[tarefa.tipo] || "📋"} {TIPO_LABELS[tarefa.tipo] || tarefa.tipo}
                      </Badge>
                    </div>
                  </div>

                  <button onClick={() => navigate(categoria === "negocios" ? "/meus-negocios" : "/pipeline")} className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {tarefa.lead_nome || (categoria === "negocios" ? "Negócio" : "Lead")}
                  </button>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {tarefa.lead_empreendimento && (
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{tarefa.lead_empreendimento}</span>
                    )}
                    {tarefa.lead_telefone && <span>{formatPhone(tarefa.lead_telefone)}</span>}
                  </div>

                  {tarefa.descricao && <p className="text-xs text-muted-foreground italic">📝 "{tarefa.descricao}"</p>}

                  {!isConcluida && (
                    <div className="flex items-center gap-1 pt-1 flex-wrap">
                      {tarefa.lead_telefone && (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => window.open(`tel:${tarefa.lead_telefone}`, "_self")}>
                            <Phone className="h-3.5 w-3.5" /> Ligar
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => openWhatsApp(tarefa.lead_telefone!)}>
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => setScriptsOpen(true)}>
                        <BookOpen className="h-3.5 w-3.5" /> Scripts
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleConcluir(tarefa.id, tarefa.pipeline_lead_id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => openEditTarefa(tarefa)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setAdiarId(tarefa.id); setAdiarData(""); setAdiarHora(""); }}>
                        <Calendar className="h-3.5 w-3.5" /> Adiar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Adiar dialog */}
      <Dialog open={!!adiarId} onOpenChange={() => setAdiarId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Adiar tarefa</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 1); setAdiarId(null); }}>Daqui 1h</Button>
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 2); setAdiarId(null); }}>Daqui 2h</Button>
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 24); setAdiarId(null); }}>Amanhã</Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">ou escolha data/hora:</p>
            <Input type="date" value={adiarData} onChange={e => setAdiarData(e.target.value)} />
            <Input type="time" value={adiarHora} onChange={e => setAdiarHora(e.target.value)} />
            <Button className="w-full" onClick={handleAdiarCustom} disabled={!adiarData}>Reagendar ✅</Button>
          </div>
        </DialogContent>
      </Dialog>

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
                <Input type="date" value={editData} onChange={e => setEditData(e.target.value)} />
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">{selectedLeadNome}</Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedLeadId(null); setSelectedLeadNome(""); }}>Trocar</Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar lead..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)} className="pl-8" />
                  {searchLeads.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {searchLeads.map(l => (
                        <button key={l.id} className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => {
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
                </div>
              )}
            </div>

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
                <Input type="date" value={novoData} onChange={e => setNovoData(e.target.value)} />
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
    </div>
  );
}
