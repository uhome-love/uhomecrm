import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Briefcase, Save, Loader2, CalendarPlus, TrendingUp,
  Handshake, FileText, CheckCircle2, Building2, Home, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { type Negocio, NEGOCIOS_FASES } from "@/hooks/useNegocios";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import { cn } from "@/lib/utils";

interface TeamMember {
  user_id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negocio: Negocio;
  onUpdate: (id: string, updates: Partial<Negocio>) => Promise<void>;
  onMoveFase: (id: string, fase: string) => void;
}

// Extended negocio with new fields
interface NegocioExtended extends Negocio {
  unidade?: string | null;
  imovel_interesse?: string | null;
  proposta_imovel?: string | null;
  proposta_valor?: number | null;
  proposta_situacao?: string | null;
  negociacao_situacao?: string | null;
  negociacao_contra_proposta?: string | null;
  negociacao_pendencia?: string | null;
  documentacao_situacao?: string | null;
}

const PROPOSTA_STATUS = [
  { value: "aguardando_aceite", label: "⏳ Aguardando Aceite", color: "bg-amber-100 text-amber-700" },
  { value: "aprovada", label: "✅ Aprovada", color: "bg-green-100 text-green-700" },
  { value: "reprovada", label: "❌ Reprovada", color: "bg-red-100 text-red-700" },
];

const NEGOCIACAO_STATUS = [
  { value: "contra_proposta", label: "🔄 Contra-proposta" },
  { value: "pendente_cliente", label: "⏳ Pendente Cliente" },
  { value: "pendente_construtora", label: "⏳ Pendente Construtora" },
  { value: "em_analise", label: "🔍 Em Análise" },
  { value: "aprovada", label: "✅ Aprovada" },
];

const DOC_STATUS = [
  { value: "leitura_contrato", label: "📖 Leitura do Contrato" },
  { value: "tiragem_duvidas", label: "❓ Tiragem de Dúvidas" },
  { value: "leitura_presencial", label: "🏢 Leitura Presencial" },
  { value: "contrato_gerado", label: "✅ Contrato Gerado" },
];

export default function NegocioDetailModal({ open, onOpenChange, negocio, onUpdate, onMoveFase }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullNeg, setFullNeg] = useState<NegocioExtended>(negocio as NegocioExtended);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isParceria, setIsParceria] = useState(false);
  const [parceiroId, setParceiroId] = useState("");
  const [existingParceria, setExistingParceria] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState("geral");

  const faseInfo = NEGOCIOS_FASES.find(f => f.key === fullNeg.fase);

  // Load full negocio data + team + tasks + parceria
  useEffect(() => {
    if (!open || !negocio.id) return;

    const load = async () => {
      setLoading(true);
      const [negRes, teamRes, tasksRes] = await Promise.all([
        supabase.from("negocios").select("*").eq("id", negocio.id).single(),
        supabase.from("team_members").select("user_id, nome").eq("status", "ativo"),
        negocio.pipeline_lead_id
          ? supabase.from("lead_tasks").select("*").eq("lead_id", negocio.pipeline_lead_id).order("created_at", { ascending: false }).limit(20)
          : Promise.resolve({ data: [] }),
      ]);

      if (negRes.data) setFullNeg(negRes.data as NegocioExtended);
      setTeamMembers((teamRes.data || []).filter(m => m.user_id) as TeamMember[]);
      setTasks((tasksRes as any).data || []);

      // Check existing partnership
      if (negocio.pipeline_lead_id) {
        const { data: parceria } = await supabase
          .from("pipeline_parcerias")
          .select("*")
          .eq("pipeline_lead_id", negocio.pipeline_lead_id)
          .eq("status", "ativa")
          .maybeSingle();
        if (parceria) {
          setExistingParceria(parceria);
          setIsParceria(true);
          setParceiroId(parceria.corretor_parceiro_id || "");
        }
      }

      setLoading(false);
    };
    load();
  }, [open, negocio.id, negocio.pipeline_lead_id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updates: any = {
        empreendimento: fullNeg.empreendimento || null,
        vgv_estimado: fullNeg.vgv_estimado || null,
        vgv_final: fullNeg.vgv_final || null,
        unidade: fullNeg.unidade || null,
        imovel_interesse: fullNeg.imovel_interesse || null,
        proposta_imovel: fullNeg.proposta_imovel || null,
        proposta_valor: fullNeg.proposta_valor || null,
        proposta_situacao: fullNeg.proposta_situacao || null,
        negociacao_situacao: fullNeg.negociacao_situacao || null,
        negociacao_contra_proposta: fullNeg.negociacao_contra_proposta || null,
        negociacao_pendencia: fullNeg.negociacao_pendencia || null,
        documentacao_situacao: fullNeg.documentacao_situacao || null,
        observacoes: fullNeg.observacoes || null,
      };

      await onUpdate(negocio.id, updates);

      // Create partnership if enabled
      if (isParceria && parceiroId && !existingParceria && negocio.pipeline_lead_id) {
        const { error } = await supabase.from("pipeline_parcerias").insert({
          pipeline_lead_id: negocio.pipeline_lead_id,
          corretor_principal_id: negocio.corretor_id || user?.id,
          corretor_parceiro_id: parceiroId,
          divisao_principal: 50,
          divisao_parceiro: 50,
          motivo: "Parceria via negócio",
          criado_por: user?.id,
        });
        if (!error) toast.success("🤝 Parceria registrada!");
      }

      toast.success("💾 Negócio atualizado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [fullNeg, isParceria, parceiroId, existingParceria, negocio, onUpdate, user]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !negocio.pipeline_lead_id || !user) return;
    const { data, error } = await supabase.from("lead_tasks").insert({
      lead_id: negocio.pipeline_lead_id,
      user_id: user.id,
      titulo: newTaskTitle.trim(),
      status: "pendente",
      prioridade: "media",
    } as any).select().single();
    if (!error && data) {
      setTasks(prev => [data, ...prev]);
      setNewTaskTitle("");
      toast.success("📋 Tarefa criada!");
    }
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluida";
    await supabase.from("lead_tasks").update({
      status: newStatus,
      concluida_em: newStatus === "concluida" ? new Date().toISOString() : null,
    } as any).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const set = (field: string, value: any) => setFullNeg(prev => ({ ...prev, [field]: value }));

  const parceiroOptions = useMemo(() => {
    return teamMembers.filter(m => m.user_id !== negocio.corretor_id && m.user_id !== user?.id);
  }, [teamMembers, negocio.corretor_id, user?.id]);

  const parceiroNome = useMemo(() => {
    if (!parceiroId) return null;
    return teamMembers.find(m => m.user_id === parceiroId)?.nome || null;
  }, [parceiroId, teamMembers]);

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-primary" />
              {fullNeg.nome_cliente}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge
              className="text-xs px-2 py-0.5 font-bold border"
              style={{ backgroundColor: faseInfo?.cor + "20", color: faseInfo?.cor, borderColor: faseInfo?.cor + "40" }}
            >
              {faseInfo?.icon} {faseInfo?.label}
            </Badge>
            {fullNeg.vgv_estimado && (
              <Badge variant="outline" className="text-xs gap-1">
                <TrendingUp className="h-3 w-3" />
                R$ {fullNeg.vgv_estimado.toLocaleString("pt-BR")}
              </Badge>
            )}
            {existingParceria && (
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">
                <Handshake className="h-3 w-3" /> Parceria
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="grid w-full grid-cols-4 h-9">
              <TabsTrigger value="geral" className="text-xs">📋 Geral</TabsTrigger>
              <TabsTrigger value="proposta" className="text-xs">💰 Proposta</TabsTrigger>
              <TabsTrigger value="negociacao" className="text-xs">🤝 Negociação</TabsTrigger>
              <TabsTrigger value="tarefas" className="text-xs">✅ Tarefas</TabsTrigger>
            </TabsList>

            {/* === TAB GERAL === */}
            <TabsContent value="geral" className="space-y-4 mt-4">
              {/* Imóvel de Interesse */}
              <div>
                <Label className="text-xs font-semibold mb-1 flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Imóvel de Interesse</Label>
                <Input
                  value={fullNeg.imovel_interesse || ""}
                  onChange={e => set("imovel_interesse", e.target.value)}
                  placeholder="Ex: Apto 3 dorms, 90m², vista norte"
                  className="h-9 text-sm"
                />
              </div>

              {/* Empreendimento */}
              <div>
                <Label className="text-xs font-semibold mb-1 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Empreendimento</Label>
                <EmpreendimentoCombobox
                  value={fullNeg.empreendimento || ""}
                  onChange={v => set("empreendimento", v)}
                  placeholder="Selecione o empreendimento"
                />
              </div>

              {/* Unidade */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Unidade Escolhida</Label>
                <Input
                  value={fullNeg.unidade || ""}
                  onChange={e => set("unidade", e.target.value)}
                  placeholder="Ex: Torre A - Apto 1204"
                  className="h-9 text-sm"
                />
              </div>

              {/* VGV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">VGV Estimado</Label>
                  <Input
                    type="number"
                    value={fullNeg.vgv_estimado || ""}
                    onChange={e => set("vgv_estimado", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="500000"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">VGV Final (assinado)</Label>
                  <Input
                    type="number"
                    value={fullNeg.vgv_final || ""}
                    onChange={e => set("vgv_final", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="480000"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Parceria */}
              <div className="rounded-lg border border-border/60 p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Handshake className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-semibold cursor-pointer" htmlFor="neg-parceria">
                      {existingParceria ? "Parceria ativa" : "Negócio em parceria?"}
                    </Label>
                  </div>
                  <Switch
                    id="neg-parceria"
                    checked={isParceria}
                    onCheckedChange={checked => {
                      setIsParceria(checked);
                      if (!checked) setParceiroId("");
                    }}
                    disabled={!!existingParceria}
                  />
                </div>
                {isParceria && (
                  <div>
                    {existingParceria ? (
                      <div className="text-xs text-muted-foreground">
                        🤝 Parceiro: <span className="font-semibold text-foreground">{parceiroNome || "Carregando..."}</span> (50/50)
                      </div>
                    ) : (
                      <>
                        <Label className="text-xs text-muted-foreground mb-1 block">Corretor parceiro (divisão 50/50)</Label>
                        <Select value={parceiroId} onValueChange={setParceiroId}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione o parceiro" />
                          </SelectTrigger>
                          <SelectContent>
                            {parceiroOptions.map(m => (
                              <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Observações</Label>
                <Textarea
                  value={fullNeg.observacoes || ""}
                  onChange={e => set("observacoes", e.target.value)}
                  placeholder="Notas sobre o negócio..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            </TabsContent>

            {/* === TAB PROPOSTA === */}
            <TabsContent value="proposta" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4 space-y-4 bg-card">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" /> Dados da Proposta
                </h3>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Imóvel da proposta</Label>
                  <Input
                    value={fullNeg.proposta_imovel || ""}
                    onChange={e => set("proposta_imovel", e.target.value)}
                    placeholder="Ex: Torre B - Apto 804"
                    className="h-9 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Valor da proposta (R$)</Label>
                  <Input
                    type="number"
                    value={fullNeg.proposta_valor || ""}
                    onChange={e => set("proposta_valor", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="450000"
                    className="h-9 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Situação da Proposta</Label>
                  <div className="flex flex-wrap gap-2">
                    {PROPOSTA_STATUS.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => set("proposta_situacao", s.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                          fullNeg.proposta_situacao === s.value
                            ? s.color + " ring-2 ring-offset-1 ring-primary/30"
                            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick: move to proposta phase */}
              {fullNeg.fase !== "proposta" && fullNeg.fase !== "negociacao" && fullNeg.fase !== "documentacao" && fullNeg.fase !== "assinado" && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-sm border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => { onMoveFase(negocio.id, "proposta"); set("fase", "proposta"); }}
                >
                  📋 Mover para Proposta
                </Button>
              )}
            </TabsContent>

            {/* === TAB NEGOCIAÇÃO === */}
            <TabsContent value="negociacao" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4 space-y-4 bg-card">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-amber-600" /> Negociação
                </h3>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Situação</Label>
                  <Select value={fullNeg.negociacao_situacao || ""} onValueChange={v => set("negociacao_situacao", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {NEGOCIACAO_STATUS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {fullNeg.negociacao_situacao === "contra_proposta" && (
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Detalhes da contra-proposta</Label>
                    <Textarea
                      value={fullNeg.negociacao_contra_proposta || ""}
                      onChange={e => set("negociacao_contra_proposta", e.target.value)}
                      placeholder="Descreva a contra-proposta..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs font-semibold mb-1 block">O que está pendente para evoluir?</Label>
                  <Textarea
                    value={fullNeg.negociacao_pendencia || ""}
                    onChange={e => set("negociacao_pendencia", e.target.value)}
                    placeholder="Ex: Aguardando aprovação do financiamento..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Documentação / Contrato */}
              <div className="rounded-lg border p-4 space-y-4 bg-card">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-purple-600" /> Contrato Gerado
                </h3>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Situação do contrato</Label>
                  <div className="flex flex-wrap gap-2">
                    {DOC_STATUS.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => set("documentacao_situacao", s.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                          fullNeg.documentacao_situacao === s.value
                            ? "bg-purple-100 text-purple-700 ring-2 ring-offset-1 ring-primary/30"
                            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* === TAB TAREFAS === */}
            <TabsContent value="tarefas" className="space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="Nova tarefa para este negócio..."
                  className="h-9 text-sm flex-1"
                  onKeyDown={e => e.key === "Enter" && handleCreateTask()}
                />
                <Button size="sm" className="h-9 gap-1" onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
                  <CalendarPlus className="h-3.5 w-3.5" /> Criar
                </Button>
              </div>

              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa vinculada a este negócio.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {tasks.map(t => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer",
                        t.status === "concluida" ? "bg-muted/30 border-border/30" : "bg-card hover:bg-accent/30"
                      )}
                      onClick={() => toggleTask(t.id, t.status)}
                    >
                      <CheckCircle2 className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        t.status === "concluida" ? "text-green-500" : "text-muted-foreground/40"
                      )} />
                      <span className={cn(
                        "text-xs flex-1",
                        t.status === "concluida" && "line-through text-muted-foreground"
                      )}>
                        {t.titulo}
                      </span>
                      {t.prioridade === "alta" || t.prioridade === "urgente" ? (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">!</Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/50 px-6 py-3 flex items-center gap-2">
          {/* Phase quick actions */}
          {fullNeg.fase === "documentacao" && (
            <Button
              variant="default"
              className="gap-2 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => { onMoveFase(negocio.id, "assinado"); onOpenChange(false); }}
            >
              🏆 Marcar como ASSINADO
            </Button>
          )}
          {fullNeg.fase === "proposta" && (
            <Button
              variant="outline"
              className="gap-1 text-xs border-amber-300 text-amber-700"
              onClick={() => { onMoveFase(negocio.id, "negociacao"); set("fase", "negociacao"); }}
            >
              🤝 → Negociação
            </Button>
          )}
          {fullNeg.fase === "negociacao" && (
            <Button
              variant="outline"
              className="gap-1 text-xs border-purple-300 text-purple-700"
              onClick={() => { onMoveFase(negocio.id, "documentacao"); set("fase", "documentacao"); }}
            >
              📄 → Contrato Gerado
            </Button>
          )}

          <div className="flex-1" />

          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
