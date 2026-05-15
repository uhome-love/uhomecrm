import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Plus, Zap, Clock, Play, Pause, History, Loader2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import AutomationWizard from "@/components/automations/AutomationWizard";
import AutomationLogsDialog from "@/components/automations/AutomationLogsDialog";
import SequenceTemplates from "@/components/automations/SequenceTemplates";
import NurturingDashboard from "@/components/automations/NurturingDashboard";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: any;
  conditions: any[];
  actions: any[];
  is_active: boolean;
  created_by: string;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_arrived: "Quando um lead chegar",
  lead_no_contact: "Lead sem contato",
  lead_moved: "Lead movido de etapa",
  visit_done: "Visita realizada",
  deal_lost: "Negócio marcado como Caiu",
  cron: "Agendamento periódico",
};

const TRIGGER_ICONS: Record<string, string> = {
  lead_arrived: "🆕",
  lead_no_contact: "⏰",
  lead_moved: "➡️",
  visit_done: "📍",
  deal_lost: "❌",
  cron: "🕐",
};

export default function AutomacoesPage() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [logsAutomationId, setLogsAutomationId] = useState<string | null>(null);

  const loadAutomations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading automations:", error);
      return;
    }
    setAutomations((data || []) as Automation[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from("automations")
      .update({ is_active: !currentState, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar automação");
      return;
    }
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a));
    toast.success(!currentState ? "Automação ativada" : "Automação pausada");
  };

  const deleteAutomation = async (id: string) => {
    const { error } = await supabase.from("automations").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir automação");
      return;
    }
    setAutomations(prev => prev.filter(a => a.id !== id));
    toast.success("Automação excluída");
  };

  const handleSaved = () => {
    setWizardOpen(false);
    setEditingAutomation(null);
    loadAutomations();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Automações</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Crie regras automáticas para agilizar sua operação
          </p>
        </div>
        <Button onClick={() => { setEditingAutomation(null); setWizardOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {/* Sequence Templates */}
      <SequenceTemplates onCreated={loadAutomations} />

      {/* Nurturing Dashboard — CEO control */}
      <NurturingDashboard />

      {automations.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma automação criada</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Automações executam ações automaticamente quando algo acontece. 
            Use um template acima ou crie do zero.
          </p>
          <Button onClick={() => setWizardOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar automação personalizada
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((auto) => (
            <Card key={auto.id} className={`p-4 transition-all ${!auto.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-lg shrink-0">
                  {TRIGGER_ICONS[auto.trigger_type] || "⚡"}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate">{auto.name}</h3>
                    <Badge variant={auto.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {auto.is_active ? "Ativa" : "Pausada"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}
                    {auto.trigger_config?.hours && ` (${auto.trigger_config.hours}h)`}
                    {auto.trigger_config?.stage_name && ` → ${auto.trigger_config.stage_name}`}
                    {" · "}
                    {auto.actions?.length || 0} {(auto.actions?.length || 0) === 1 ? "ação" : "ações"}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {auto.last_run_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Última: {formatDistanceToNow(new Date(auto.last_run_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {auto.run_count} execuções
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLogsAutomationId(auto.id)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={auto.is_active}
                    onCheckedChange={() => toggleActive(auto.id, auto.is_active)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(wizardOpen || editingAutomation) && (
        <AutomationWizard
          open={wizardOpen || !!editingAutomation}
          onOpenChange={(open) => { if (!open) { setWizardOpen(false); setEditingAutomation(null); } }}
          automation={editingAutomation}
          onSaved={handleSaved}
        />
      )}

      {logsAutomationId && (
        <AutomationLogsDialog
          automationId={logsAutomationId}
          open={!!logsAutomationId}
          onOpenChange={(open) => { if (!open) setLogsAutomationId(null); }}
        />
      )}
    </div>
  );
}
