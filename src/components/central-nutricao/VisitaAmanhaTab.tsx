import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Calendar, Send, Pause, Play, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

export default function VisitaAmanhaTab() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: cfg, isLoading: cfgLoading } = useQuery({
    queryKey: ["visita-amanha-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_amanha_config" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["visita-amanha-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_amanha_disparos" as any)
        .select("status")
        .limit(10000);
      if (error) throw error;
      const counts = { sent: 0, sim: 0, nao: 0, failed: 0 };
      (data || []).forEach((d: any) => {
        if (d.status in counts) counts[d.status as keyof typeof counts]++;
      });
      return counts;
    },
    refetchInterval: 5000,
  });

  const { data: recentes } = useQuery({
    queryKey: ["visita-amanha-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_amanha_disparos" as any)
        .select("id, status, sent_at, resposta_at, phone, pipeline_leads(nome)")
        .order("sent_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 5000,
  });

  const { data: elegiveis } = useQuery({
    queryKey: ["visita-amanha-elegiveis", cfg?.stages_alvo],
    enabled: !!cfg?.stages_alvo,
    queryFn: async () => {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, nome")
        .in("nome", cfg.stages_alvo);
      const stageIds = (stages || []).map((s: any) => s.id);
      if (stageIds.length === 0) return { total: 0, ja_enviados: 0 };

      const { count: total } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .in("stage_id", stageIds)
        .eq("arquivado", false)
        .not("telefone", "is", null);

      const { count: jaEnviados } = await supabase
        .from("visita_amanha_disparos" as any)
        .select("id", { count: "exact", head: true });

      return { total: total || 0, ja_enviados: jaEnviados || 0 };
    },
  });

  const updateCfg = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("visita_amanha_config" as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", cfg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita-amanha-config"] });
      toast.success("Configuração atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dispatch = async () => {
    if (!confirm(`Disparar para ${(elegiveis?.total || 0) - (elegiveis?.ja_enviados || 0)} leads agora?\n\nO disparo respeita throttle de 60-180s entre envios.`)) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("visita-amanha-enqueue", {
        body: { force: true },
      });
      if (error) throw error;
      const r = data as any;
      if (r.skipped) {
        toast.warning(`Disparo pulado: ${r.reason}`);
      } else if (r.auto_paused) {
        toast.error(`Auto-pausa: ${r.reason}. ${r.sent} enviados antes.`);
      } else if (r.partial) {
        toast.success(`✅ ${r.sent} enviados nesta rodada. Sistema continua disparando automaticamente a cada 2 min — pode fechar a tela.`);
      } else {
        toast.success(`✅ ${r.sent} enviados, ${r.failed} falhas, ${r.skipped} pulados`);
      }
      qc.invalidateQueries({ queryKey: ["visita-amanha-stats"] });
      qc.invalidateQueries({ queryKey: ["visita-amanha-recentes"] });
      qc.invalidateQueries({ queryKey: ["visita-amanha-elegiveis"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao disparar");
    } finally {
      setRunning(false);
    }
  };

  if (cfgLoading) return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!cfg) return <div className="py-8 text-center text-sm text-muted-foreground">Configuração não encontrada.</div>;

  const restantes = (elegiveis?.total || 0) - (elegiveis?.ja_enviados || 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Disparo "Visita Amanhã"
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Convite para visita amanhã via Meta WhatsApp para leads ativos nas etapas: <b>{(cfg.stages_alvo || []).join(", ")}</b>.
            Resposta SIM gera notificação ao corretor; NÃO só registra no histórico. Lead não muda de etapa.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="rounded-md border p-2 text-center">
              <div className="text-xs text-muted-foreground">Elegíveis</div>
              <div className="text-xl font-bold">{elegiveis?.total ?? "—"}</div>
            </div>
            <div className="rounded-md border p-2 text-center">
              <div className="text-xs text-muted-foreground">Já enviados</div>
              <div className="text-xl font-bold">{elegiveis?.ja_enviados ?? "—"}</div>
            </div>
            <div className="rounded-md border p-2 text-center bg-emerald-50 dark:bg-emerald-950/20">
              <div className="text-xs text-muted-foreground">Disparos OK</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-500">{stats?.sent ?? 0}</div>
            </div>
            <div className="rounded-md border p-2 text-center bg-blue-50 dark:bg-blue-950/20">
              <div className="text-xs text-muted-foreground">Responderam SIM</div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-500">{stats?.sim ?? 0}</div>
            </div>
            <div className="rounded-md border p-2 text-center bg-amber-50 dark:bg-amber-950/20">
              <div className="text-xs text-muted-foreground">Responderam NÃO</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-500">{stats?.nao ?? 0}</div>
            </div>
          </div>

          {/* Config */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border p-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Habilitado</span>
              <Switch checked={cfg.enabled} onCheckedChange={(v) => updateCfg.mutate({ enabled: v })} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Pausado</span>
              <Switch checked={cfg.paused} onCheckedChange={(v) => updateCfg.mutate({ paused: v })} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium whitespace-nowrap">Limite/disparo:</span>
              <Input
                type="number"
                defaultValue={cfg.daily_limit}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v && v !== cfg.daily_limit) updateCfg.mutate({ daily_limit: v });
                }}
                className="h-7 text-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground col-span-3">
              Template Meta: <code className="bg-background px-1 rounded">{cfg.meta_template_name}</code> ({cfg.meta_template_language})
              · Janela: {cfg.horario_inicio?.slice(0, 5)}–{cfg.horario_fim?.slice(0, 5)} BRT
              · Delay {cfg.delay_min_seconds}–{cfg.delay_max_seconds}s, pausa longa a cada {cfg.pausa_longa_a_cada}
            </div>
          </div>

          {/* Botão de disparo */}
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              onClick={dispatch}
              disabled={running || restantes <= 0 || !cfg.enabled}
              className="gap-2"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {running ? "Disparando..." : `Disparar agora (${restantes} restantes)`}
            </Button>
            {cfg.paused && (
              <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700">
                <Pause className="h-3 w-3" /> Pausado — clique em Disparar para forçar
              </Badge>
            )}
          </div>

          {/* AVISO Meta template */}
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <b>Antes de disparar:</b> aprove o template <code>{cfg.meta_template_name}</code> no Meta WhatsApp Manager.
                Estrutura: corpo com 1 variável <code>{"{{1}}"}</code> (nome) + 2 botões Quick Reply: <i>"Sim, quero visitar"</i> e <i>"Agora não"</i>.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de envios recentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Últimos disparos</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentes || recentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum disparo ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Lead</th>
                    <th className="text-left py-2 px-2 font-medium">Telefone</th>
                    <th className="text-left py-2 px-2 font-medium">Enviado</th>
                    <th className="text-left py-2 px-2 font-medium">Resposta</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{r.pipeline_leads?.nome || "—"}</td>
                      <td className="py-2 px-2 font-mono">{r.phone}</td>
                      <td className="py-2 px-2">{formatBRT(r.sent_at, "dd/MM HH:mm")}</td>
                      <td className="py-2 px-2">{r.resposta_at ? formatBRT(r.resposta_at, "dd/MM HH:mm") : "—"}</td>
                      <td className="py-2 px-2 text-center">
                        {r.status === "sim" && <Badge className="bg-blue-100 text-blue-800 text-[10px]">✅ SIM</Badge>}
                        {r.status === "nao" && <Badge className="bg-amber-100 text-amber-800 text-[10px]">❌ NÃO</Badge>}
                        {r.status === "sent" && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5 inline" />Enviado</Badge>}
                        {r.status === "failed" && <Badge className="bg-red-100 text-red-800 text-[10px]">Falha</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
