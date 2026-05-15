import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowRight, Plus, X, Sparkles, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: any;
  onSaved: () => void;
}

const TRIGGERS = [
  { value: "lead_arrived", label: "Quando um lead chegar", desc: "Novo lead atribuído ao corretor", emoji: "🆕" },
  { value: "lead_no_contact", label: "Lead sem contato há X horas", desc: "Lead parado sem ação", emoji: "⏰" },
  { value: "lead_moved", label: "Lead movido para etapa", desc: "Quando lead muda de etapa no pipeline", emoji: "➡️" },
  { value: "visit_done", label: "Visita realizada", desc: "Quando uma visita for concluída", emoji: "📍" },
  { value: "deal_lost", label: "Negócio marcou como Caiu", desc: "Quando um negócio cai", emoji: "❌" },
  { value: "cron", label: "Agendamento periódico", desc: "Executar em dias/horários específicos", emoji: "🕐" },
];

const ACTION_TYPES = [
  { value: "whatsapp", label: "Enviar WhatsApp ao cliente", emoji: "💬" },
  { value: "create_activity", label: "Criar atividade para o corretor", emoji: "📋" },
  { value: "move_lead", label: "Mover lead para etapa", emoji: "➡️" },
  { value: "notify_manager", label: "Notificar gerente", emoji: "🔔" },
  { value: "redistribute", label: "Redistribuir lead", emoji: "🔄" },
];

interface ActionConfig {
  type: string;
  message?: string;
  activity_title?: string;
  activity_hours?: number;
  stage_id?: string;
  stage_name?: string;
  notify_text?: string;
  redistribute_hours?: number;
}

export default function AutomationWizard({ open, onOpenChange, automation, onSaved }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [conditions, setConditions] = useState<any[]>([]);
  const [actions, setActions] = useState<ActionConfig[]>([]);
  const [stages, setStages] = useState<{ id: string; nome: string }[]>([]);
  const [segmentos, setSegmentos] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Condition state
  const [condSegmento, setCondSegmento] = useState("");
  const [condOrigem, setCondOrigem] = useState("");
  const [condEmpreendimento, setCondEmpreendimento] = useState("");

  useEffect(() => {
    supabase.from("pipeline_stages").select("id, nome").eq("ativo", true).order("ordem").then(({ data }) => {
      if (data) setStages(data);
    });
    supabase.from("pipeline_segmentos").select("id, nome").eq("ativo", true).order("ordem").then(({ data }) => {
      if (data) setSegmentos(data);
    });
  }, []);

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setTriggerType(automation.trigger_type);
      setTriggerConfig(automation.trigger_config || {});
      setActions(automation.actions || []);
      const conds = automation.conditions || [];
      conds.forEach((c: any) => {
        if (c.field === "segmento") setCondSegmento(c.value);
        if (c.field === "origem") setCondOrigem(c.value);
        if (c.field === "empreendimento") setCondEmpreendimento(c.value);
      });
      setStep(1);
    }
  }, [automation]);

  const addAction = (type: string) => {
    if (actions.find(a => a.type === type)) return;
    setActions([...actions, { type }]);
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, updates: Partial<ActionConfig>) => {
    setActions(actions.map((a, i) => i === idx ? { ...a, ...updates } : a));
  };

  const buildConditions = () => {
    const conds: any[] = [];
    if (condSegmento) conds.push({ field: "segmento", value: condSegmento });
    if (condOrigem.trim()) conds.push({ field: "origem", value: condOrigem.trim() });
    if (condEmpreendimento.trim()) conds.push({ field: "empreendimento", value: condEmpreendimento.trim() });
    return conds;
  };

  const handleSave = async () => {
    if (!user || !name.trim() || !triggerType || actions.length === 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);

    const payload = {
      name: name.trim(),
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      conditions: buildConditions(),
      actions,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (automation?.id) {
      ({ error } = await supabase.from("automations").update(payload as any).eq("id", automation.id));
    } else {
      ({ error } = await supabase.from("automations").insert(payload as any));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar automação");
      console.error(error);
      return;
    }
    toast.success(automation ? "Automação atualizada!" : "Automação criada!");
    onSaved();
  };

  const canNext = () => {
    if (step === 1) return !!triggerType;
    if (step === 2) return true;
    if (step === 3) return actions.length > 0 && !!name.trim();
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {automation ? "Editar Automação" : "Nova Automação"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { n: 1, label: "Gatilho" },
            { n: 2, label: "Condições" },
            { n: 3, label: "Ações" },
          ].map(({ n, label }) => (
            <button
              key={n}
              onClick={() => n <= step && setStep(n)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                step === n
                  ? "bg-primary text-primary-foreground"
                  : step > n
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="font-bold">{n}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Step 1: Trigger */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">Quando isso acontecer...</p>
            <div className="grid gap-2">
              {TRIGGERS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTriggerType(t.value)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    triggerType === t.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-primary/30 hover:bg-accent/50"
                  }`}
                >
                  <span className="text-lg">{t.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Trigger config */}
            {triggerType === "lead_no_contact" && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs">Quantas horas sem contato?</Label>
                <Input
                  type="number"
                  min={1}
                  value={triggerConfig.hours || ""}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, hours: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 24"
                  className="w-32"
                />
              </div>
            )}

            {triggerType === "lead_moved" && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs">Para qual etapa?</Label>
                <Select
                  value={triggerConfig.stage_id || ""}
                  onValueChange={(v) => {
                    const s = stages.find(s => s.id === v);
                    setTriggerConfig({ ...triggerConfig, stage_id: v, stage_name: s?.nome });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {triggerType === "cron" && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs">Expressão cron (ex: 0 8 * * 1 = segunda 8h)</Label>
                <Input
                  value={triggerConfig.cron_expression || ""}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, cron_expression: e.target.value })}
                  placeholder="0 8 * * 1"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Conditions */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-medium">
              Filtrar apenas quando... <span className="text-xs">(opcional)</span>
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Segmento do lead</Label>
                <Select value={condSegmento} onValueChange={setCondSegmento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer segmento</SelectItem>
                    {segmentos.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Origem do lead</Label>
                <Input
                  value={condOrigem}
                  onChange={(e) => setCondOrigem(e.target.value)}
                  placeholder="Ex: TikTok, Facebook, Site..."
                />
              </div>

              <div>
                <Label className="text-xs">Empreendimento</Label>
                <Input
                  value={condEmpreendimento}
                  onChange={(e) => setCondEmpreendimento(e.target.value)}
                  placeholder="Ex: Residencial Aurora"
                />
              </div>
            </div>

            {(condSegmento || condOrigem || condEmpreendimento) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                {condSegmento && condSegmento !== "all" && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setCondSegmento("")}>
                    Segmento ×
                  </Badge>
                )}
                {condOrigem && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setCondOrigem("")}>
                    Origem: {condOrigem} ×
                  </Badge>
                )}
                {condEmpreendimento && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setCondEmpreendimento("")}>
                    {condEmpreendimento} ×
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Actions */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium">Nome da automação</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: WhatsApp de boas-vindas"
                className="mt-1"
              />
            </div>

            <p className="text-sm text-muted-foreground font-medium">Então faça...</p>

            {/* Selected actions */}
            {actions.map((action, idx) => {
              const config = ACTION_TYPES.find(a => a.value === action.type);
              return (
                <Card key={idx} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span>{config?.emoji}</span> {config?.label}
                    </span>
                    <button onClick={() => removeAction(idx)}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>

                  {action.type === "whatsapp" && (
                    <div>
                      <Label className="text-xs">Mensagem</Label>
                      <Textarea
                        value={action.message || ""}
                        onChange={(e) => updateAction(idx, { message: e.target.value })}
                        placeholder="Olá {{nome}}! Sou {{corretor}} da Uhome. Vi seu interesse no {{empreendimento}}..."
                        rows={3}
                        className="text-xs mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Variáveis: {"{{nome}}"}, {"{{corretor}}"}, {"{{empreendimento}}"}, {"{{telefone}}"}
                      </p>
                    </div>
                  )}

                  {action.type === "create_activity" && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Título da atividade</Label>
                        <Input
                          value={action.activity_title || ""}
                          onChange={(e) => updateAction(idx, { activity_title: e.target.value })}
                          placeholder="Ex: Ligar para o lead"
                          className="text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Prazo em horas</Label>
                        <Input
                          type="number"
                          min={1}
                          value={action.activity_hours || ""}
                          onChange={(e) => updateAction(idx, { activity_hours: parseInt(e.target.value) || 0 })}
                          placeholder="Ex: 2"
                          className="w-24 text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {action.type === "move_lead" && (
                    <div>
                      <Label className="text-xs">Mover para etapa</Label>
                      <Select
                        value={action.stage_id || ""}
                        onValueChange={(v) => {
                          const s = stages.find(s => s.id === v);
                          updateAction(idx, { stage_id: v, stage_name: s?.nome });
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecionar etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {action.type === "notify_manager" && (
                    <div>
                      <Label className="text-xs">Texto da notificação</Label>
                      <Input
                        value={action.notify_text || ""}
                        onChange={(e) => updateAction(idx, { notify_text: e.target.value })}
                        placeholder="Ex: Lead precisa de atenção"
                        className="text-xs mt-1"
                      />
                    </div>
                  )}

                  {action.type === "redistribute" && (
                    <div>
                      <Label className="text-xs">Redistribuir se corretor não agir em X horas</Label>
                      <Input
                        type="number"
                        min={1}
                        value={action.redistribute_hours || ""}
                        onChange={(e) => updateAction(idx, { redistribute_hours: parseInt(e.target.value) || 0 })}
                        placeholder="Ex: 4"
                        className="w-24 text-xs mt-1"
                      />
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Add action buttons */}
            <div className="flex flex-wrap gap-2">
              {ACTION_TYPES.filter(a => !actions.find(act => act.type === a.value)).map(a => (
                <Button
                  key={a.value}
                  variant="outline"
                  size="sm"
                  onClick={() => addAction(a.value)}
                  className="text-xs gap-1.5 h-8"
                >
                  <Plus className="h-3 w-3" />
                  {a.emoji} {a.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="gap-1.5">
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !canNext()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {automation ? "Salvar alterações" : "Criar automação"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
