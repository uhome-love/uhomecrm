import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Sprout, Play, Power, Mail, MessageCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Cadencia {
  id: string;
  stage_tipo: string;
  step_number: number;
  delay_dias: number | null;
  canal: string;
  template_name: string | null;
  descricao: string | null;
  is_active: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  descarte_reengajamento: "Reengajamento de descartados",
  descarte_reengajamento_financeiro: "Reengajamento — descarte financeiro",
  sem_contato: "Sem contato",
};

export default function NutricaoTab() {
  const qc = useQueryClient();
  const [toggling, setToggling] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [savingCadId, setSavingCadId] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [autoOff, setAutoOff] = useState(true);


  // Chave mestra
  const { data: flag, isLoading: loadingFlag } = useQuery({
    queryKey: ["nutricao-flag"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_flags")
        .select("flag_value, reason, updated_at")
        .eq("flag_name", "nutricao_enabled")
        .maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });
  const enabled = !!flag?.flag_value;

  // Cadências
  const { data: cadencias = [], isLoading: loadingCad } = useQuery({
    queryKey: ["nutricao-cadencias"],
    queryFn: async () => {
      const { data } = await supabase
        .from("nurturing_cadencias")
        .select("*")
        .order("stage_tipo")
        .order("step_number");
      return (data || []) as Cadencia[];
    },
  });

  // Fila pendente
  const { data: fila } = useQuery({
    queryKey: ["nutricao-fila"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [pend, prontas, enviadasHoje] = await Promise.all([
        supabase.from("lead_nurturing_sequences").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("lead_nurturing_sequences").select("id", { count: "exact", head: true }).eq("status", "pendente").lte("scheduled_at", nowIso),
        supabase.from("lead_nurturing_sequences").select("id", { count: "exact", head: true }).eq("status", "enviado")
          .gte("sent_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      return {
        pendentes: pend.count || 0,
        prontas: prontas.count || 0,
        enviadasHoje: enviadasHoje.count || 0,
      };
    },
    refetchInterval: enabled ? 10000 : 30000,
  });

  async function toggleMaster(next: boolean) {
    setToggling(true);
    try {
      const { error } = await supabase
        .from("system_flags")
        .update({
          flag_value: next,
          reason: next
            ? "Ligada manualmente na Central de Nutrição."
            : "Desligada manualmente na Central de Nutrição.",
          updated_at: new Date().toISOString(),
        })
        .eq("flag_name", "nutricao_enabled");
      if (error) throw error;
      toast.success(next ? "🌱 Nutrição LIGADA" : "Nutrição desligada");
      qc.invalidateQueries({ queryKey: ["nutricao-flag"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setToggling(false);
    }
  }

  async function toggleCadencia(cad: Cadencia) {
    setSavingCadId(cad.id);
    try {
      const { error } = await supabase
        .from("nurturing_cadencias")
        .update({ is_active: !cad.is_active, updated_at: new Date().toISOString() })
        .eq("id", cad.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["nutricao-cadencias"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSavingCadId(null);
    }
  }

  async function processarAgora() {
    if (!enabled) {
      toast.error("Ligue a chave mestra da nutrição antes de processar.");
      return;
    }
    if (!confirm("Processar a fila de nutrição agora? Isso envia as mensagens agendadas que já venceram.")) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("cron-nurturing-sequencer", { body: { manual: true } });
      if (error) throw error;
      const d = data as any;
      if (d?.paused) {
        toast.error("Nutrição desligada — ligue a chave mestra primeiro.");
      } else {
        toast.success(`✅ Processado: ${d?.enviados ?? 0} enviados, ${d?.erros ?? 0} erros (${d?.processed ?? 0} na fila)`);
      }
      qc.invalidateQueries({ queryKey: ["nutricao-fila"] });
    } catch (e: any) {
      toast.error("Erro ao processar: " + e.message);
    } finally {
      setProcessing(false);
    }
  }

  const grupos = cadencias.reduce<Record<string, Cadencia[]>>((acc, c) => {
    (acc[c.stage_tipo] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Chave mestra */}
      <Card className={enabled ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/10" : "border-muted"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sprout className={enabled ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-muted-foreground"} />
            Chave mestra da Nutrição
            <Badge variant={enabled ? "default" : "outline"} className={`ml-auto text-[10px] ${enabled ? "bg-emerald-600" : ""}`}>
              {enabled ? "LIGADA" : "DESLIGADA"}
            </Badge>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Enquanto desligada, nenhuma mensagem de nutrição é enviada — nada roda sozinho.
            Ligue apenas quando quiser processar o fluxo e desligue ao terminar.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {loadingFlag ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Switch checked={enabled} disabled={toggling} onCheckedChange={toggleMaster} />
            )}
            <Label className="text-sm">{enabled ? "Nutrição ativa" : "Nutrição parada"}</Label>
          </div>

          {enabled && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-2 text-[11px] text-emerald-800 dark:text-emerald-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Nutrição LIGADA. Lembre de desligar após concluir o disparo do fluxo.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border p-2 text-center">
              <div className="text-lg font-semibold">{fila?.pendentes ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground">Na fila</div>
            </div>
            <div className="rounded-md border p-2 text-center">
              <div className="text-lg font-semibold text-indigo-700">{fila?.prontas ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground">Prontas p/ enviar</div>
            </div>
            <div className="rounded-md border p-2 text-center">
              <div className="text-lg font-semibold text-emerald-700">{fila?.enviadasHoje ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground">Enviadas hoje</div>
            </div>
          </div>

          <Button onClick={processarAgora} disabled={processing || !enabled} className="w-full gap-2">
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Processar fila de nutrição agora
          </Button>
        </CardContent>
      </Card>

      {/* Fluxos / cadências */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Power className="h-4 w-4 text-primary" /> Fluxos de nutrição (cadências)
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Escolha manualmente quais passos ficam ativos. Só os passos ativos são considerados no fluxo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCad ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : cadencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cadência cadastrada.</p>
          ) : (
            Object.entries(grupos).map(([stage, steps]) => (
              <div key={stage} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">{STAGE_LABELS[stage] || stage}</h4>
                  <Badge variant="outline" className="text-[10px]">
                    {steps.filter((s) => s.is_active).length}/{steps.length} ativos
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {steps.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-md border p-2">
                      <Badge variant="secondary" className="text-[10px] shrink-0">passo {s.step_number}</Badge>
                      {s.canal === "email" ? (
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono truncate">{s.template_name || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.canal} · {s.delay_dias ?? 0}d de espera{s.descricao ? ` · ${s.descricao}` : ""}
                        </div>
                      </div>
                      {savingCadId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Switch checked={s.is_active} onCheckedChange={() => toggleCadencia(s)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
