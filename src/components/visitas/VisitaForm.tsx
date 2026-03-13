import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarPlus, Search, Handshake, Filter, X, Home, Building2 } from "lucide-react";
import { type Visita } from "@/hooks/useVisitas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import { toast } from "sonner";

interface PipelineLeadOption {
  id: string;
  nome: string;
  empreendimento: string | null;
  telefone: string | null;
  stage_id: string;
}

interface TeamMemberOption {
  user_id: string;
  nome: string;
  equipe: string | null;
}

interface StageOption {
  id: string;
  nome: string;
}

type FormErrors = Partial<{
  nome_cliente: string;
  pipeline_lead_id: string;
  data_visita: string;
  hora_visita: string;
  responsavel_visita: string;
  corretor_id: string;
}>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Visita>) => Promise<any>;
  initialData?: Partial<Visita> & { pipeline_lead_id?: string };
  mode?: "create" | "edit";
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const QUICK_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

const LOCAL_OPTIONS = [
  { value: "stand", label: "🏗️ Stand do empreendimento" },
  { value: "empresa", label: "🏢 Escritório / Empresa" },
  { value: "videochamada", label: "📹 Videochamada" },
  { value: "decorado", label: "🏠 Apartamento decorado" },
  { value: "no_imovel", label: "🔑 No imóvel específico" },
  { value: "outro", label: "📍 Outro" },
];

const RESPONSAVEL_OPTIONS = [
  { value: "gerente", label: "👔 Gerente" },
  { value: "proprio_corretor", label: "👤 Próprio corretor" },
  { value: "corretor_parceiro", label: "🤝 Corretor parceiro" },
  { value: "responsavel_construtora", label: "🏗️ Responsável da construtora" },
];

function getDefaultForm(initialData?: Props["initialData"]) {
  return {
    nome_cliente: initialData?.nome_cliente || "",
    telefone: initialData?.telefone || "",
    empreendimento: initialData?.empreendimento || "",
    corretor_id: initialData?.corretor_id || "",
    origem: initialData?.origem || "manual",
    data_visita: initialData?.data_visita || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    hora_visita: initialData?.hora_visita || "",
    local_visita: initialData?.local_visita || "",
    observacoes: initialData?.observacoes || "",
    pipeline_lead_id: (initialData as any)?.pipeline_lead_id || "",
    responsavel_visita: (initialData as any)?.responsavel_visita || "proprio_corretor",
  };
}

export default function VisitaForm({ open, onClose, onSubmit, initialData, mode = "create" }: Props) {
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const isManager = isGestor || isAdmin;

  const [form, setForm] = useState(() => getDefaultForm(initialData));
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLeadOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [searchPipeline, setSearchPipeline] = useState("");
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);

  // Filter state for client search
  const [filterStage, setFilterStage] = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Partnership state
  const [isParceria, setIsParceria] = useState(false);
  const [parceiroId, setParceiroId] = useState("");

  // Imóvel Jetimob search
  const [imovelSearch, setImovelSearch] = useState("");
  const [imovelResults, setImovelResults] = useState<any[]>([]);
  const [imovelLoading, setImovelLoading] = useState(false);
  const [selectedImovel, setSelectedImovel] = useState<any>(null);

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setForm(getDefaultForm(initialData));
      setFormErrors({});
      setSearchPipeline("");
      setSubmitting(false);
      setIsParceria(false);
      setParceiroId("");
      setFilterStage("");
      setFilterEmp("");
      setShowFilters(false);
      setImovelSearch("");
      setImovelResults([]);
      setSelectedImovel(null);
    }
  }, [open, initialData]);

  // Load pipeline leads + team members + empreendimentos + stages
  useEffect(() => {
    if (!user || !open) return;

    const load = async () => {
      let teamQuery = supabase
        .from("team_members")
        .select("user_id, nome, equipe")
        .eq("status", "ativo");

      if (isManager && !isAdmin) {
        teamQuery = teamQuery.eq("gerente_id", user.id);
      }

      const [leadsRes, teamRes, campanhasRes, stagesRes] = await Promise.all([
        supabase.from("pipeline_leads").select("id, nome, empreendimento, telefone, stage_id").order("updated_at", { ascending: false }).limit(500),
        teamQuery,
        supabase.from("roleta_campanhas").select("empreendimento").eq("ativo", true),
        supabase.from("pipeline_stages").select("id, nome").order("ordem", { ascending: true }),
      ]);

      const leads = (leadsRes.data || []) as PipelineLeadOption[];
      setPipelineLeads(leads);
      setTeamMembers((teamRes.data || []).filter((m) => m.user_id) as TeamMemberOption[]);
      setStages((stagesRes.data || []) as StageOption[]);

      const empSet = new Set<string>();
      (campanhasRes.data || []).forEach((c: any) => { if (c.empreendimento) empSet.add(c.empreendimento); });
      leads.forEach(l => { if (l.empreendimento) empSet.add(l.empreendimento); });
      setEmpreendimentos(Array.from(empSet).sort());
    };
    load();
  }, [user, open, isManager, isAdmin]);

  // Filtered leads with search + stage + empreendimento filters
  const filteredLeads = useMemo(() => {
    let result = pipelineLeads;
    if (filterStage) result = result.filter(l => l.stage_id === filterStage);
    if (filterEmp) result = result.filter(l => l.empreendimento === filterEmp);
    if (searchPipeline.trim()) {
      const term = searchPipeline.toLowerCase();
      result = result.filter(l =>
        l.nome.toLowerCase().includes(term) ||
        l.empreendimento?.toLowerCase().includes(term) ||
        l.telefone?.includes(term)
      );
    }
    return result.slice(0, 25);
  }, [pipelineLeads, searchPipeline, filterStage, filterEmp]);

  const selectedLead = pipelineLeads.find(l => l.id === form.pipeline_lead_id);

  // Unique empreendimentos from loaded leads for filter chips
  const leadEmpreendimentos = useMemo(() => {
    const set = new Set<string>();
    pipelineLeads.forEach(l => { if (l.empreendimento) set.add(l.empreendimento); });
    return Array.from(set).sort();
  }, [pipelineLeads]);

  // Parceiro options: grouped by equipe, exclude current corretor
  const parceiroGroups = useMemo(() => {
    const excludeId = form.corretor_id || user?.id;
    const filtered = teamMembers.filter(m => m.user_id !== excludeId);
    const groups = new Map<string, TeamMemberOption[]>();
    for (const m of filtered) {
      const team = m.equipe || "Sem equipe";
      if (!groups.has(team)) groups.set(team, []);
      groups.get(team)!.push(m);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [teamMembers, form.corretor_id, user?.id]);

  const hasActiveFilters = !!filterStage || !!filterEmp;

  // Jetimob imovel search
  const handleImovelSearch = async (term: string) => {
    setImovelSearch(term);
    if (term.length < 2) { setImovelResults([]); return; }
    setImovelLoading(true);
    try {
      // Check if searching by code (numeric)
      const isCode = /^\d{3,}/.test(term.trim());
      if (isCode) {
        const { data } = await supabase.functions.invoke("jetimob-proxy", {
          body: { action: "get_imovel", codigo: term.trim() },
        });
        if (data?.imovel) {
          setImovelResults([data.imovel]);
        } else {
          setImovelResults([]);
        }
      } else {
        const { data } = await supabase.functions.invoke("jetimob-proxy", {
          body: { action: "list_imoveis", cidade: "Porto Alegre", search: term.trim(), per_page: 10 },
        });
        setImovelResults(data?.imoveis || []);
      }
    } catch { setImovelResults([]); }
    setImovelLoading(false);
  };

  const handleSelectImovel = (imovel: any) => {
    const desc = imovel.descricao_anuncio || imovel.tipo || "";
    const bairro = imovel.endereco_bairro || "";
    const codigo = imovel.codigo || "";
    const label = `${desc}${bairro ? ` - ${bairro}` : ""}${codigo ? ` (${codigo})` : ""}`;
    setSelectedImovel(imovel);
    set("empreendimento", label);
    setImovelSearch("");
    setImovelResults([]);
  };

  const handleSelectPipelineLead = (leadId: string) => {
    const lead = pipelineLeads.find(l => l.id === leadId);
    if (lead) {
      setForm(f => ({
        ...f,
        pipeline_lead_id: leadId,
        nome_cliente: lead.nome,
        telefone: lead.telefone || f.telefone || "",
        empreendimento: lead.empreendimento || f.empreendimento || "",
      }));
      setFormErrors((prev) => ({ ...prev, pipeline_lead_id: undefined, nome_cliente: undefined }));
      setSearchPipeline("");
      setShowFilters(false);
    }
  };

  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};

    if (!form.nome_cliente.trim()) {
      errors.nome_cliente = "Informe o nome do cliente.";
    }

    if (mode === "create" && !UUID_REGEX.test((form.pipeline_lead_id || "").trim())) {
      errors.pipeline_lead_id = "Selecione um lead válido da lista.";
    }

    if (!form.data_visita) {
      errors.data_visita = "Selecione a data da visita.";
    } else if (Number.isNaN(new Date(`${form.data_visita}T00:00:00`).getTime())) {
      errors.data_visita = "Data inválida.";
    }

    if (form.hora_visita && !/^\d{2}:\d{2}$/.test(form.hora_visita)) {
      errors.hora_visita = "Horário inválido.";
    }

    if (!form.responsavel_visita) {
      errors.responsavel_visita = "Selecione o responsável pela visita.";
    }

    if (isManager && form.corretor_id && !UUID_REGEX.test(form.corretor_id)) {
      errors.corretor_id = "Selecione um corretor válido.";
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Revise os campos obrigatórios para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit({
        ...form,
        corretor_id: form.corretor_id || undefined,
        telefone: form.telefone?.trim() || null,
        empreendimento: form.empreendimento?.trim() || null,
        hora_visita: form.hora_visita || null,
        local_visita: form.local_visita || null,
        observacoes: form.observacoes?.trim() || null,
        pipeline_lead_id: form.pipeline_lead_id || null,
        lead_id: null,
        responsavel_visita: form.responsavel_visita || null,
      } as any);

      // Create partnership if enabled and we have a pipeline_lead_id
      if (result && isParceria && parceiroId) {
        const leadId = form.pipeline_lead_id || (result as any)?.pipeline_lead_id;
        if (leadId) {
          try {
            const { error } = await supabase.from("pipeline_parcerias").insert({
              pipeline_lead_id: leadId,
              corretor_principal_id: form.corretor_id || user?.id,
              corretor_parceiro_id: parceiroId,
              divisao_principal: 50,
              divisao_parceiro: 50,
              motivo: "Visita em parceria",
              criado_por: user?.id,
            });
            if (error) {
              if (error.code === "23505") {
                toast.info("Parceria já existe com este corretor");
              } else {
                console.error("Erro ao criar parceria:", error);
                toast.error("Erro ao registrar parceria");
              }
            } else {
              toast.success("🤝 Parceria registrada!", { duration: 3000 });
            }
          } catch (err) {
            console.error("Partnership error:", err);
          }
        }
      }

      if (result !== null && result !== undefined) {
        onClose();
      }
    } catch (err) {
      console.error("Erro ao salvar visita:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  // Stage name lookup
  const stageName = (stageId: string) => stages.find(s => s.id === stageId)?.nome || "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarPlus className="h-5 w-5 text-primary" />
            {mode === "create" ? "Nova Visita" : "Editar Visita"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* === CLIENT SEARCH === */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-semibold">Cliente *</Label>
              {!selectedLead && (
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors",
                    showFilters || hasActiveFilters
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Filter className="h-3 w-3" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold">
                      {(filterStage ? 1 : 0) + (filterEmp ? 1 : 0)}
                    </span>
                  )}
                </button>
              )}
            </div>

            {selectedLead ? (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 border">
                <div>
                  <p className="text-sm font-semibold">{selectedLead.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[selectedLead.empreendimento, stageName(selectedLead.stage_id), selectedLead.telefone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => set("pipeline_lead_id", "")}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Filter chips */}
                {showFilters && (
                  <div className="space-y-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 animate-fade-in">
                    {/* Stage filter */}
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Etapa</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {stages.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setFilterStage(filterStage === s.id ? "" : s.id)}
                            className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-medium border transition-all",
                              filterStage === s.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
                            )}
                          >
                            {s.nome}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Empreendimento filter */}
                    {leadEmpreendimentos.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Empreendimento</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {leadEmpreendimentos.slice(0, 10).map(e => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => setFilterEmp(filterEmp === e ? "" : e)}
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-medium border transition-all",
                                filterEmp === e
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
                              )}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => { setFilterStage(""); setFilterEmp(""); }}
                        className="flex items-center gap-1 text-[10px] text-destructive hover:underline"
                      >
                        <X className="h-3 w-3" /> Limpar filtros
                      </button>
                    )}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, empreendimento ou telefone..."
                    value={searchPipeline || form.nome_cliente}
                    onChange={e => {
                      setSearchPipeline(e.target.value);
                      set("nome_cliente", e.target.value);
                    }}
                    className="pl-8 h-9 text-sm"
                  />
                </div>

                {/* Results */}
                {(searchPipeline.trim().length > 1 || hasActiveFilters) && filteredLeads.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-lg border bg-card shadow-md">
                    {filteredLeads.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                        onClick={() => handleSelectPipelineLead(l.id)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold truncate">{l.nome}</p>
                          {l.stage_id && (
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 shrink-0 ml-2">
                              {stageName(l.stage_id)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {[l.empreendimento, l.telefone].filter(Boolean).join(" · ") || "Sem detalhes"}
                        </p>
                      </button>
                    ))}
                    {filteredLeads.length >= 25 && (
                      <p className="text-[9px] text-muted-foreground text-center py-1.5">Refine a busca para ver mais resultados</p>
                    )}
                  </div>
                )}

                {(searchPipeline.trim().length > 1 || hasActiveFilters) && filteredLeads.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-3">
                    Nenhum lead encontrado. O nome digitado será usado como cliente manual.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* === IMÓVEL (Jetimob search + EmpreendimentoCombobox fallback) === */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Imóvel</Label>

            {selectedImovel ? (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 border">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {selectedImovel.descricao_anuncio || selectedImovel.tipo || "Imóvel"}
                    {selectedImovel.codigo && <span className="text-muted-foreground ml-1">({selectedImovel.codigo})</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {[selectedImovel.endereco_bairro, selectedImovel.endereco_logradouro].filter(Boolean).join(" · ")}
                    {selectedImovel.valor ? ` · R$ ${Number(selectedImovel.valor).toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive shrink-0" onClick={() => { setSelectedImovel(null); set("empreendimento", ""); }}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, código Jetimob ou empreendimento..."
                    value={imovelSearch || form.empreendimento}
                    onChange={e => {
                      handleImovelSearch(e.target.value);
                      set("empreendimento", e.target.value);
                    }}
                    className="pl-8 h-9 text-sm"
                  />
                  {imovelLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>

                {/* Jetimob results */}
                {imovelResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border bg-card shadow-md">
                    {imovelResults.map((im: any) => (
                      <button
                        key={im.codigo || im.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                        onClick={() => handleSelectImovel(im)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate">
                            <Home className="h-3 w-3 inline mr-1 text-muted-foreground" />
                            {im.descricao_anuncio || im.tipo || "Imóvel"}
                          </p>
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 shrink-0">{im.codigo}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {[im.endereco_bairro, `${im.dormitorios || 0} dorms`, im.valor ? `R$ ${Number(im.valor).toLocaleString("pt-BR")}` : null].filter(Boolean).join(" · ")}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Empreendimento combobox as fallback for empreendimentos da carteira */}
                {!imovelSearch && !selectedImovel && (
                  <div className="mt-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Ou selecione um empreendimento da carteira:</p>
                    <EmpreendimentoCombobox
                      value={form.empreendimento}
                      onChange={(v) => set("empreendimento", v)}
                      extraOptions={empreendimentos}
                      placeholder="Selecione ou digite o empreendimento"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Local da Visita */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Local da Visita</Label>
            <Select value={form.local_visita} onValueChange={v => set("local_visita", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Onde será a visita?" /></SelectTrigger>
              <SelectContent>
                {LOCAL_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável pela Visita */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Responsável pela Visita</Label>
            <Select value={form.responsavel_visita} onValueChange={v => set("responsavel_visita", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Quem acompanha a visita?" /></SelectTrigger>
              <SelectContent>
                {RESPONSAVEL_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Corretor — only for gestores/admins */}
          {isManager && teamMembers.length > 0 && (
            <div>
              <Label className="text-xs font-semibold mb-1 block">Corretor</Label>
              <Select value={form.corretor_id} onValueChange={v => set("corretor_id", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o corretor" /></SelectTrigger>
                <SelectContent>
                  {parceiroGroups.length > 1 ? (
                    parceiroGroups.map(([equipe, members]) => (
                      <SelectGroup key={equipe}>
                        <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">{equipe}</SelectLabel>
                        {members.map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  ) : (
                    teamMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Partnership toggle */}
          {form.pipeline_lead_id && (
            <div className="rounded-lg border border-border/60 p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-primary" />
                  <Label className="text-xs font-semibold cursor-pointer" htmlFor="parceria-switch">
                    Visita em parceria?
                  </Label>
                </div>
                <Switch
                  id="parceria-switch"
                  checked={isParceria}
                  onCheckedChange={(checked) => {
                    setIsParceria(checked);
                    if (!checked) setParceiroId("");
                  }}
                />
              </div>
              {isParceria && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Corretor parceiro (divisão 50/50)</Label>
                  <Select value={parceiroId} onValueChange={setParceiroId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione o corretor parceiro" />
                    </SelectTrigger>
                    <SelectContent>
                      {parceiroGroups.map(([equipe, members]) => (
                        <SelectGroup key={equipe}>
                          <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {equipe}
                          </SelectLabel>
                          {members.map(m => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    O lead será compartilhado no pipeline com divisão 50/50 da comissão.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Data *</Label>
              <Input type="date" value={form.data_visita} onChange={e => set("data_visita", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Horário</Label>
              <Input type="time" value={form.hora_visita} onChange={e => set("hora_visita", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Quick time buttons */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set("hora_visita", t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  form.hora_visita === t
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Telefone */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Telefone</Label>
            <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(XX) XXXXX-XXXX" className="h-9 text-sm" />
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Notas sobre a visita..." rows={2} className="text-sm" />
          </div>

          {/* Submit */}
          <Button
            className="w-full gap-2 h-10 text-sm font-semibold"
            disabled={!form.nome_cliente.trim() || !form.data_visita || submitting || (isParceria && !parceiroId)}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "📅 Agendar Visita" : "💾 Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
