import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Send, RefreshCw, MessageCircle, CheckCircle2, XCircle, Clock, Wifi, WifiOff, QrCode } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

export default function ReengajamentoTab() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["reengajamento-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reengajamento_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState<any>(null);
  const local = draft ?? cfg ?? {};

  const { data: kpis } = useQuery({
    queryKey: ["reengajamento-kpis"],
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const today = new Date(); today.setHours(0,0,0,0);

      const [hoje, sete, trinta, reativados] = await Promise.all([
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
          .eq("reengajamento_status", "enviado").gte("reengajamento_enviado_at", today.toISOString()),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
          .not("reengajamento_enviado_at", "is", null).gte("reengajamento_enviado_at", since7),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
          .not("reengajamento_enviado_at", "is", null).gte("reengajamento_enviado_at", since30),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
          .eq("reativado_por_nutricao", true).gte("reativado_em", since30),
      ]);
      return {
        hoje: hoje.count || 0,
        sete: sete.count || 0,
        trinta: trinta.count || 0,
        reativados: reativados.count || 0,
      };
    },
  });

  const { data: ultimos = [] } = useQuery({
    queryKey: ["reengajamento-ultimos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, reengajamento_enviado_at, reengajamento_status, reativado_por_nutricao, reativado_em")
        .not("reengajamento_enviado_at", "is", null)
        .order("reengajamento_enviado_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  async function save() {
    if (!local?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("reengajamento_config").update({
        enabled: local.enabled,
        daily_limit: local.daily_limit,
        lookback_days: local.lookback_days,
        evolution_instance: local.evolution_instance,
        mensagem_template: local.mensagem_template,
        horario_inicio: local.horario_inicio,
        horario_fim: local.horario_fim,
        updated_at: new Date().toISOString(),
      }).eq("id", local.id);
      if (error) throw error;
      toast.success("Configuração salva");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["reengajamento-config"] });
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function dispararAgora() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: {},
      });
      if (error) throw error;
      toast.success(`Disparo executado: ${data?.sent || 0} enviados, ${data?.failed || 0} falhas`);
      qc.invalidateQueries({ queryKey: ["reengajamento-kpis"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setRunning(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>;
  if (!cfg) return <div className="text-sm text-muted-foreground">Sem configuração</div>;

  const statusBadge = (s: string | null) => {
    if (s === "respondeu_sim") return <Badge className="bg-green-100 text-green-800 text-[10px]">✅ SIM</Badge>;
    if (s === "respondeu_nao") return <Badge className="bg-red-100 text-red-800 text-[10px]">❌ NÃO</Badge>;
    if (s === "respondeu_outro") return <Badge className="bg-blue-100 text-blue-800 text-[10px]">💬 Outro</Badge>;
    if (s === "telefone_invalido") return <Badge className="bg-gray-100 text-gray-800 text-[10px]">📵 Tel inválido</Badge>;
    if (s === "enviado") return <Badge className="bg-amber-100 text-amber-800 text-[10px]">⏳ Aguardando</Badge>;
    return <Badge variant="outline" className="text-[10px]">{s || "—"}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Enviados hoje</div>
          <div className="text-2xl font-bold">{kpis?.hoje ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Últimos 7d</div>
          <div className="text-2xl font-bold">{kpis?.sete ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Últimos 30d</div>
          <div className="text-2xl font-bold">{kpis?.trinta ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">🔄 Reativados (30d)</div>
          <div className="text-2xl font-bold text-orange-600">{kpis?.reativados ?? 0}</div>
        </CardContent></Card>
      </div>

      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Configuração</span>
            <div className="flex items-center gap-2">
              <Label htmlFor="enabled" className="text-xs">Ativo</Label>
              <Switch
                id="enabled"
                checked={!!local.enabled}
                onCheckedChange={(v) => setDraft({ ...local, enabled: v })}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Limite diário</Label>
              <Input type="number" value={local.daily_limit ?? 100}
                onChange={(e) => setDraft({ ...local, daily_limit: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Lookback (dias)</Label>
              <Input type="number" value={local.lookback_days ?? 60}
                onChange={(e) => setDraft({ ...local, lookback_days: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Horário início</Label>
              <Input type="time" value={(local.horario_inicio || "09:00").slice(0, 5)}
                onChange={(e) => setDraft({ ...local, horario_inicio: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Horário fim</Label>
              <Input type="time" value={(local.horario_fim || "18:00").slice(0, 5)}
                onChange={(e) => setDraft({ ...local, horario_fim: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Instância Evolution (dedicada)</Label>
            <Input value={local.evolution_instance || ""}
              onChange={(e) => setDraft({ ...local, evolution_instance: e.target.value })} />
            <p className="text-[10px] text-muted-foreground mt-1">
              Use uma instância separada da equipe (ex: <code>uhome-nutricao</code>) para isolar reputação.
            </p>
          </div>
          <div>
            <Label className="text-xs">Mensagem (use <code>{"{nome}"}</code> para personalizar)</Label>
            <Textarea rows={4} value={local.mensagem_template || ""}
              onChange={(e) => setDraft({ ...local, mensagem_template: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={dispararAgora} disabled={running}>
              {running ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Disparar agora
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !draft}>
              {saving ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : null}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela últimos envios */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Últimos envios</CardTitle>
          <Button size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] })}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {ultimos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum envio ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Lead</th>
                    <th className="text-left py-2 px-2 font-medium">Telefone</th>
                    <th className="text-left py-2 px-2 font-medium">Enviado em</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                    <th className="text-center py-2 px-2 font-medium">Reativado</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimos.map((l: any) => (
                    <tr key={l.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{l.nome}</td>
                      <td className="py-2 px-2">{l.telefone}</td>
                      <td className="py-2 px-2">{l.reengajamento_enviado_at ? formatBRT(l.reengajamento_enviado_at, "dd/MM HH:mm") : "—"}</td>
                      <td className="py-2 px-2 text-center">{statusBadge(l.reengajamento_status)}</td>
                      <td className="py-2 px-2 text-center">
                        {l.reativado_por_nutricao ? (
                          <Badge className="bg-orange-100 text-orange-800 text-[10px]">🔄 SIM</Badge>
                        ) : "—"}
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
