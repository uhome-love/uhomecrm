import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Send, RefreshCw, MessageCircle, XCircle, Wifi, WifiOff, QrCode, Play, Pause, Square, AlertCircle, CheckCircle2, Shield, Zap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";
import CentralInteligenciaPanel from "./CentralInteligenciaPanel";
import type { DispatchRun, BlockedTemplate, DispatchInvokeResult } from "./types";

const STALE_RUNNING_MS = 15 * 60 * 1000;

async function recoverOrTimeoutStaleRun(data: DispatchRun, qc: ReturnType<typeof useQueryClient>) {
  const { count } = await supabase
    .from("reengajamento_dispatch_queue")
    .select("id", { count: "exact", head: true })
    .eq("run_id", data.id)
    .in("status", ["pending", "processing"]);

  if ((count || 0) > 0) {
    await supabase
      .from("reengajamento_dispatch_runs")
      .update({
        started_at: new Date().toISOString(),
        finished_at: null,
        status: "running",
        motivo_parada: `Fila persistente ativa: ${(count || 0)} pendentes. Retomada automática acionada.`,
      })
      .eq("id", data.id);

    supabase.functions.invoke("reengajamento-descartados-enqueue", {
      body: { force: true, run_id: data.id, iniciado_por: "auto_resume_ui" },
    });

    return data;
  }

  await supabase
    .from("reengajamento_dispatch_runs")
    .update({
      status: "timeout",
      finished_at: new Date().toISOString(),
      motivo_parada: "Encerrado automaticamente: execução antiga ficou travada sem fila pendente",
    })
    .eq("id", data.id);
  qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
  return null;
}

export default function ReengajamentoTab() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["reengajamento-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reengajamento_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const [draft, setDraft] = useState<any>(null);
  const local = draft ?? cfg ?? {};

  // Execução ativa (running) — polling rápido só quando há disparo em andamento,
  // lento (15s) quando ocioso para detectar o início de um novo disparo.
  const { data: activeRun } = useQuery({
    queryKey: ["reengajamento-active-run"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reengajamento_dispatch_runs")
        .select("*")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.started_at && Date.now() - new Date(data.started_at).getTime() > STALE_RUNNING_MS) {
        return recoverOrTimeoutStaleRun(data, qc);
      }
      return data;
    },
    refetchInterval: (query) => (query.state.data ? 3000 : 15000),
  });
  const dispatchActive = !!activeRun;

  // Blacklist de templates (FIX B)
  const { data: blockedTemplates } = useQuery({
    queryKey: ["blocked-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_templates")
        .select("template_name, reason");
      return (data as BlockedTemplate[]) || [];
    },
    refetchInterval: 30000,
  });
  const isBlocked = (name?: string | null) =>
    !!name && (blockedTemplates || []).some((b) => b.template_name === name);
  const blockedReason = (name?: string | null) =>
    (blockedTemplates || []).find((b) => b.template_name === name)?.reason ?? undefined;

  // Histórico das últimas 10 execuções
  const { data: runs = [] } = useQuery({
    queryKey: ["reengajamento-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reengajamento_dispatch_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);
      return (data || []) as DispatchRun[];
    },
    refetchInterval: dispatchActive ? 8000 : 30000,
  });

  const { data: kpis } = useQuery({
    queryKey: ["reengajamento-kpis"],
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const today = new Date(); today.setHours(0,0,0,0);

      const [hoje, sete, trinta, reativadosSim] = await Promise.all([
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
          .eq("reengajamento_status", "enviado").gte("reengajamento_enviado_at", today.toISOString()),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
          .not("reengajamento_enviado_at", "is", null).gte("reengajamento_enviado_at", since7),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
          .not("reengajamento_enviado_at", "is", null).gte("reengajamento_enviado_at", since30),
        supabase.from("reengajamento_eventos").select("lead_id")
          .eq("tipo", "classificado_sim").gte("created_at", since30),
      ]);

      const reativadosCount = new Set((reativadosSim.data || []).map((item: any) => item.lead_id).filter(Boolean)).size;
      return {
        hoje: hoje.count || 0,
        sete: sete.count || 0,
        trinta: trinta.count || 0,
        reativados: reativadosCount,
      };
    },
    refetchInterval: dispatchActive ? 10000 : 60000,
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
      const leads = data || [];
      const ids = leads.map((l: any) => l.id);
      const respostasMap: Record<string, { body: string; timestamp: string }> = {};
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from("whatsapp_mensagens")
          .select("lead_id, body, timestamp")
          .in("lead_id", ids)
          .eq("direction", "received")
          .order("timestamp", { ascending: false })
          .limit(500);
        for (const m of (msgs || []) as any[]) {
          if (!respostasMap[m.lead_id]) {
            respostasMap[m.lead_id] = { body: m.body, timestamp: m.timestamp };
          }
        }
      }
      return leads.map((l: any) => ({ ...l, ultimaResposta: respostasMap[l.id] || null }));
    },
    refetchInterval: dispatchActive ? 10000 : 30000,
  });

  // 🛡️ Saúde do template Meta — detecta bloqueios sistemáticos
  const { data: metaHealth } = useQuery({
    queryKey: ["reengajamento-meta-health"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("reengajamento_meta_disparos")
        .select("status, error_text, created_at, template_name")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = (data || []) as any[];
      if (rows.length === 0) return null;
      const total = rows.length;
      const failed = rows.filter((r) => r.status === "failed").length;
      const qualityHits = rows.filter((r) => {
        const m = String(r.error_text || "").toLowerCase();
        return r.status === "failed" && (
          m.includes("ecosystem engagement") ||
          m.includes("template is paused") ||
          m.includes("template paused") ||
          m.includes("part of an experiment") ||
          m.includes("131049") || m.includes("131050")
        );
      }).length;
      const lastFail = rows.find((r) => r.status === "failed");
      return { total, failed, qualityHits, failRate: failed / total, lastError: lastFail?.error_text || null, template: lastFail?.template_name || null };
    },
    refetchInterval: dispatchActive ? 15000 : 60000,
  });

  async function reativarManual(leadId: string, nome: string) {
    if (!confirm(`Reativar "${nome}" e mandar de volta para a roleta?`)) return;
    try {
      const { data, error } = await supabase.rpc("reativar_lead_nutricao_manual" as any, { p_lead_id: leadId });
      if (error) throw error;
      const dist = (data as any)?.distribuicao;
      toast.success(dist?.success ? `🔄 ${nome} reativada e distribuída` : `🔄 ${nome} reativada (fila CEO)`);
      qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-kpis"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  async function save() {
    if (!local?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("reengajamento_config").update({
        enabled: local.enabled,
        canal: local.canal || "evolution",
        meta_template_name: local.meta_template_name || null,
        meta_template_language: local.meta_template_language || "pt_BR",
        mensagens_variantes: local.mensagens_variantes || [],
        pausa_longa_a_cada: local.pausa_longa_a_cada ?? 6,
        pausa_longa_min_seconds: local.pausa_longa_min_seconds ?? 180,
        pausa_longa_max_seconds: local.pausa_longa_max_seconds ?? 480,
        validar_numero: local.validar_numero ?? true,
        daily_limit: local.daily_limit,
        lookback_days: local.lookback_days,
        evolution_instance: local.evolution_instance,
        mensagem_template: local.mensagem_template,
        horario_inicio: local.horario_inicio,
        horario_fim: local.horario_fim,
        delay_min_seconds: local.delay_min_seconds,
        delay_max_seconds: local.delay_max_seconds,
        // 2ª onda
        mensagem_template_2: local.mensagem_template_2 || null,
        meta_template_name_2: local.meta_template_name_2 || null,
        mensagens_variantes_2: local.mensagens_variantes_2 || [],
        wave2_min_dias_apos_wave1: local.wave2_min_dias_apos_wave1 ?? 5,
        meta_header_image_url: local.meta_header_image_url || null,
        meta_header_image_url_2: local.meta_header_image_url_2 || null,
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
    // FIX A: pausa travada
    if ((cfg as any)?.paused_until_release) {
      toast.error("⛔ Central travada: " + ((cfg as any)?.paused_reason || "liberação manual via SQL admin necessária"));
      return;
    }
    // FIX B: template em blacklist
    const tpl1 = (local?.meta_template_name || "") as string;
    if (isBlocked(tpl1)) {
      toast.error(`⛔ Template "${tpl1}" está bloqueado: ${blockedReason(tpl1)}. Verifique no Business Manager antes de remover da blacklist.`);
      return;
    }
    setStarting(true);
    try {
      if (cfg?.id) {
        await supabase.from("reengajamento_config").update({ paused: false }).eq("id", cfg.id);
        qc.invalidateQueries({ queryKey: ["reengajamento-config"] });
      }
      // Fire-and-forget: não bloqueia a UI; o polling do activeRun mostra o progresso
      supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: { force: true, iniciado_por: "manual" },
      }).then(({ data, error }) => {
        if (error) toast.error("Erro no disparo: " + error.message);
        else if ((data as any)?.reason === "no_leads") toast.info("Nenhum lead elegível encontrado");
        else if (["meta_quality_cooldown", "locked_quality_pause"].includes(String((data as any)?.reason || ""))) {
          toast.error("⛔ Meta pausou por qualidade: " + String((data as any)?.motivo || "aguarde a recuperação antes de retomar"));
        }
        qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
        qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
        qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] });
        qc.invalidateQueries({ queryKey: ["reengajamento-kpis"] });
      });
      toast.success("🚀 Disparo iniciado — acompanhe o progresso ao vivo");
      // Pequeno delay para o run aparecer
      setTimeout(() => qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] }), 1500);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setStarting(false);
    }
  }

  async function dispararWave2() {
    if ((cfg as any)?.paused_until_release) {
      toast.error("⛔ Central travada: " + ((cfg as any)?.paused_reason || "liberação manual via SQL admin necessária"));
      return;
    }
    const hasMsg = !!(local?.mensagem_template_2 || (local?.mensagens_variantes_2 && local.mensagens_variantes_2.length > 0));
    const hasMeta = !!local?.meta_template_name_2;
    const isMeta = (local?.canal || cfg?.canal) === "meta";
    if (isMeta && !hasMeta) {
      toast.error("Configure o nome do template Meta da 2ª onda antes de disparar");
      return;
    }
    if (!isMeta && !hasMsg) {
      toast.error("Preencha a mensagem da 2ª onda antes de disparar");
      return;
    }
    const tpl2 = (local?.meta_template_name_2 || "") as string;
    if (isMeta && isBlocked(tpl2)) {
      toast.error(`⛔ Template "${tpl2}" está bloqueado: ${blockedReason(tpl2)}. Verifique no Business Manager antes de remover da blacklist.`);
      return;
    }
    setStarting(true);
    try {
      if (cfg?.id) {
        await supabase.from("reengajamento_config").update({ paused: false }).eq("id", cfg.id);
        qc.invalidateQueries({ queryKey: ["reengajamento-config"] });
      }
      supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: { force: true, wave: 2, iniciado_por: "manual_wave2" },
      }).then(({ data, error }) => {
        if (error) toast.error("Erro no disparo wave 2: " + error.message);
        else if ((data as any)?.reason === "no_leads") toast.info("Nenhum lead elegível para 2ª onda ainda");
        else if (["meta_quality_cooldown", "locked_quality_pause"].includes(String((data as any)?.reason || ""))) {
          toast.error("⛔ Meta pausou por qualidade: " + String((data as any)?.motivo || "aguarde a recuperação antes de retomar"));
        }
        qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
        qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
        qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] });
        qc.invalidateQueries({ queryKey: ["reengajamento-kpis"] });
      });
      toast.success("🚀 2ª onda iniciada — acompanhe o progresso");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] }), 1500);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setStarting(false);
    }
  }

  async function pausarDisparo() {
    if (!cfg?.id) return;
    try {
      await supabase.from("reengajamento_config").update({ paused: true }).eq("id", cfg.id);
      if (activeRun?.id) {
        await supabase
          .from("reengajamento_dispatch_runs" as any)
          .update({
            status: "paused",
            finished_at: new Date().toISOString(),
            motivo_parada: "Pausado pelo usuário",
            enviados: activeRun.enviados || 0,
            falhas: activeRun.falhas || 0,
            ignorados: activeRun.ignorados || 0,
          })
          .eq("id", activeRun.id);
      }
      toast.info("⏸️ Pausa solicitada — para após a mensagem atual");
      qc.invalidateQueries({ queryKey: ["reengajamento-config"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    } catch (e: any) {
      toast.error("Erro ao pausar: " + e.message);
    }
  }

  async function pararDisparo() {
    if (!cfg?.id) return;
    if (!confirm("Parar definitivamente o disparo em andamento? Ele encerra após a mensagem atual e não retoma automaticamente.")) return;
    try {
      await supabase.from("reengajamento_config").update({ paused: true }).eq("id", cfg.id);
      if (activeRun?.id) {
        await supabase
          .from("reengajamento_dispatch_runs" as any)
          .update({
            cancel_requested: true,
            status: "cancelled",
            finished_at: new Date().toISOString(),
            motivo_parada: "Parado pelo usuário",
            enviados: activeRun.enviados || 0,
            falhas: activeRun.falhas || 0,
            ignorados: activeRun.ignorados || 0,
          })
          .eq("id", activeRun.id);
      }
      toast.info("⏹️ Parada solicitada — encerra após a mensagem atual");
      qc.invalidateQueries({ queryKey: ["reengajamento-config"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    } catch (e: any) {
      toast.error("Erro ao parar: " + e.message);
    }
  }


  // ===== Conexão da instância de nutrição =====
  const instanceName = (draft?.evolution_instance ?? cfg?.evolution_instance) || "uhome-nutricao";
  const [waStatus, setWaStatus] = useState<"open" | "close" | "connecting" | "loading">("loading");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrTimer, setQrTimer] = useState(60);
  const [waBusy, setWaBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function invokeWa(action: string) {
    const { data, error } = await supabase.functions.invoke("nutricao-instance-connect", {
      body: { action, instance_name: instanceName },
    });
    if (error) throw error;
    return data;
  }

  useEffect(() => {
    if (!cfg) return;
    (async () => {
      try {
        const r = await invokeWa("status");
        setWaStatus(r?.status ?? "close");
      } catch {
        setWaStatus("close");
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, instanceName]);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await invokeWa("status");
        if (r?.status === "open") {
          setWaStatus("open");
          setQrOpen(false);
          if (pollRef.current) clearInterval(pollRef.current);
          if (tickRef.current) clearInterval(tickRef.current);
          toast.success("Instância de nutrição conectada!");
        }
      } catch {}
    }, 3000);
    setQrTimer(60);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setQrTimer((t) => {
        if (t <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          setQrBase64(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  async function handleConnectInstance() {
    setWaBusy(true);
    try {
      await invokeWa("create");
      const qr = await invokeWa("qrcode");
      const code = qr?.qrcode;
      if (!code) throw new Error("QR Code não disponível");
      setQrBase64(typeof code === "string" ? code : JSON.stringify(code));
      setQrOpen(true);
      startPolling();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setWaBusy(false);
    }
  }

  async function handleNewQr() {
    setWaBusy(true);
    try {
      const qr = await invokeWa("qrcode");
      const code = qr?.qrcode;
      if (!code) throw new Error("QR Code não disponível");
      setQrBase64(typeof code === "string" ? code : JSON.stringify(code));
      startPolling();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setWaBusy(false);
    }
  }

  async function handleDisconnectInstance() {
    if (!confirm("Desconectar a instância de nutrição? O reengajamento automático parará.")) return;
    setWaBusy(true);
    try {
      await invokeWa("disconnect");
      setWaStatus("close");
      toast.success("Instância desconectada");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setWaBusy(false);
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

  const runStatusBadge = (s: string) => {
    const map: Record<string, { lbl: string; cls: string }> = {
      running:   { lbl: "▶️ Em andamento", cls: "bg-blue-100 text-blue-800" },
      completed: { lbl: "✅ Concluído",    cls: "bg-green-100 text-green-800" },
      paused:    { lbl: "⏸️ Pausado",     cls: "bg-amber-100 text-amber-800" },
      cancelled: { lbl: "⏹️ Parado",      cls: "bg-rose-100 text-rose-800" },
      timeout:   { lbl: "⏱️ Tempo limite",cls: "bg-orange-100 text-orange-800" },
      error:     { lbl: "❌ Erro",         cls: "bg-red-100 text-red-800" },
    };
    const m = map[s] || { lbl: s, cls: "bg-gray-100 text-gray-800" };
    return <Badge className={`${m.cls} text-[10px]`}>{m.lbl}</Badge>;
  };

  const waBadge =
    waStatus === "open"
      ? { label: "Conectada", cls: "bg-green-500/15 text-green-700 border-green-300" }
      : waStatus === "connecting"
      ? { label: "Conectando", cls: "bg-yellow-500/15 text-yellow-700 border-yellow-300 animate-pulse" }
      : waStatus === "loading"
      ? { label: "Carregando…", cls: "bg-muted text-muted-foreground border-border animate-pulse" }
      : { label: "Desconectada", cls: "bg-muted text-muted-foreground border-border" };

  const isPausing = !!(cfg as any)?.paused && !!activeRun;
  const isRunning = !!activeRun;
  const progressPct = activeRun?.total_alvo > 0
    ? Math.round(((activeRun.enviados || 0) + (activeRun.falhas || 0) + (activeRun.ignorados || 0)) / activeRun.total_alvo * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* 🧠 Painel inteligente: saúde do número + melhor lista */}
      <CentralInteligenciaPanel />

      {/* 🚨 Banner de saúde do template Meta */}
      {metaHealth && metaHealth.qualityHits >= 3 && (
        <Card className="border-red-400 bg-red-50 dark:bg-red-950/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1 flex-1">
              <div className="font-semibold text-red-700 dark:text-red-300">
                Template Meta provavelmente pausado / com baixa qualidade
              </div>
              <div className="text-red-700/90 dark:text-red-300/90">
                Detectamos <strong>{metaHealth.qualityHits} bloqueios</strong> da Meta nas últimas 24h
                {metaHealth.template ? <> no template <code className="text-[11px]">{metaHealth.template}</code></> : null}
                {" "}({metaHealth.failed}/{metaHealth.total} falharam = {Math.round(metaHealth.failRate * 100)}%).
                {" "}Os disparos foram <strong>auto-pausados</strong> para preservar a saúde do número.
              </div>
              {metaHealth.lastError && (
                <div className="text-[11px] text-red-700/70 dark:text-red-300/70 mt-1">
                  Último erro Meta: <em>"{String(metaHealth.lastError).slice(0, 180)}"</em>
                </div>
              )}
              <div className="text-[12px] text-muted-foreground mt-1.5">
                ➜ Acesse o <strong>WhatsApp Manager (Meta Business Suite)</strong>, crie/aprove um novo template marketing,
                atualize o nome em "Configurações Meta" abaixo e despause os disparos.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conexão WhatsApp */}
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
          {waStatus === "open" ? (
            <Wifi className="h-6 w-6 text-green-600" />
          ) : (
            <WifiOff className="h-6 w-6 text-muted-foreground" />
          )}
          <div className="flex-1">
            <CardTitle className="text-base">WhatsApp de Nutrição</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instância: <code className="text-[11px]">{instanceName}</code>
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${waBadge.cls}`}>
            {waBadge.label}
          </span>
        </CardHeader>
        <CardContent className="pt-0 flex gap-2">
          {waStatus !== "open" ? (
            <Button onClick={handleConnectInstance} disabled={waBusy} size="sm">
              {waBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <QrCode className="h-4 w-4 mr-1" />}
              Conectar instância (escanear QR)
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={handleDisconnectInstance} disabled={waBusy}>
              Desconectar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={async () => {
            const r = await invokeWa("status").catch(() => null);
            setWaStatus(r?.status ?? "close");
          }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </CardContent>
      </Card>

      {/* PAINEL AO VIVO — execução em andamento */}
      {isRunning && (
        <Card className="border-blue-300 bg-blue-50/40 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Disparo em andamento
                {isPausing && <Badge className="bg-amber-200 text-amber-900">Pausando…</Badge>}
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={pausarDisparo} disabled={isPausing}>
                  <Pause className="h-3.5 w-3.5 mr-1" />
                  {isPausing ? "Pausando…" : "Pausar"}
                </Button>
                <Button size="sm" variant="destructive" onClick={pararDisparo}>
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Parar
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>
                <strong>{(activeRun.enviados || 0) + (activeRun.falhas || 0) + (activeRun.ignorados || 0)}</strong>
                {" / "}{activeRun.total_alvo || 0} processados
              </span>
              <span className="text-muted-foreground">
                ✉️ {activeRun.enviados || 0} enviados · ⚠️ {activeRun.falhas || 0} falhas · ⏭️ {activeRun.ignorados || 0} ignorados
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
            {activeRun.ultimo_lead_nome && (
              <p className="text-[11px] text-muted-foreground">
                Último: <strong>{activeRun.ultimo_lead_nome}</strong>
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Iniciado {formatBRT(activeRun.started_at, "HH:mm:ss")} · pode levar alguns minutos
            </p>
          </CardContent>
        </Card>
      )}

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

      {/* Configuração com abas por canal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Configuração de Reengajamento</span>
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
          <div className="rounded-md bg-muted/60 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">Modo 100% manual.</strong> Nada dispara sozinho — estes campos
              (janelas de horário, limites, lookback e templates) só valem quando <strong className="text-foreground">você</strong> aciona
              um disparo em <strong className="text-foreground">Disparo manual</strong> ou ativa uma cadência em <strong className="text-foreground">Nutrição</strong>.
              Aqui é só configuração.
            </span>
          </div>
          <Tabs
            value={local.canal || "evolution"}
            onValueChange={(v) => setDraft({ ...local, canal: v })}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="meta" className="gap-2">
                <Shield className="h-3.5 w-3.5" /> Meta Oficial
                <Badge variant="outline" className="text-[9px] ml-1">recomendado</Badge>
              </TabsTrigger>
              <TabsTrigger value="evolution" className="gap-2">
                <Zap className="h-3.5 w-3.5" /> Evolution (Guerrilha)
              </TabsTrigger>
            </TabsList>

            {/* === META OFICIAL === */}
            <TabsContent value="meta" className="space-y-3 pt-3">
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 p-3 text-[11px] space-y-1">
                <p className="font-semibold text-blue-900 dark:text-blue-200">✅ Canal oficial — sem risco de banimento</p>
                <p className="text-muted-foreground">
                  Usa templates pré-aprovados pela Meta com <strong>botões SIM/NÃO</strong>. As respostas voltam pelo webhook
                  e classificam automaticamente o lead. Custo aproximado: <strong>R$ 0,11 por mensagem</strong>.
                </p>
                <p className="text-muted-foreground mt-1">
                  📋 <strong>Pré-requisito:</strong> criar template marketing no Meta Business Suite com 1 variável <code>{"{{1}}"}</code> e
                  2 botões de Resposta Rápida (ex: "✅ Sim, quero ver" / "❌ Não, obrigado").
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Nome do template aprovado</Label>
                  <Input
                    placeholder="reengajamento_imovel_v1"
                    value={local.meta_template_name || ""}
                    onChange={(e) => setDraft({ ...local, meta_template_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Idioma</Label>
                  <Input
                    placeholder="pt_BR"
                    value={local.meta_template_language || "pt_BR"}
                    onChange={(e) => setDraft({ ...local, meta_template_language: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Limite diário</Label>
                  <Input type="number" value={local.daily_limit ?? 200}
                    onChange={(e) => setDraft({ ...local, daily_limit: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label className="text-xs">URL da imagem do header (opcional)</Label>
                <Input
                  placeholder="https://… (preencha apenas se o template tem header de IMAGEM)"
                  value={local.meta_header_image_url || ""}
                  onChange={(e) => setDraft({ ...local, meta_header_image_url: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Use o mesmo URL da imagem aprovada no template Meta. Deixe vazio se o template não tem header de imagem.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <div>
                  <Label className="text-xs">Delay entre msgs (seg)</Label>
                  <Input type="number" value={local.delay_min_seconds ?? 4}
                    onChange={(e) => setDraft({ ...local, delay_min_seconds: Number(e.target.value), delay_max_seconds: Number(e.target.value) + 2 })} />
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground border-t pt-2">
                💡 A variável <code>{"{{1}}"}</code> do template será preenchida com o <strong>primeiro nome</strong> do lead.
              </div>
            </TabsContent>

            {/* === EVOLUTION GUERRILHA === */}
            <TabsContent value="evolution" className="space-y-3 pt-3">
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 p-3 text-[11px] space-y-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">⚠️ Canal não-oficial — risco de bloqueio</p>
                <p className="text-muted-foreground">
                  Usa instância Evolution dedicada com <strong>Spintax (variantes)</strong>, delays humanos (60–180s) e pausas longas
                  para parecer comportamento natural. <strong>Limite recomendado: 30–40 msgs/dia/número.</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Limite diário</Label>
                  <Input type="number" value={local.daily_limit ?? 30}
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs">Delay mín (seg)</Label>
                  <Input type="number" min={30} value={local.delay_min_seconds ?? 60}
                    onChange={(e) => setDraft({ ...local, delay_min_seconds: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Delay máx (seg)</Label>
                  <Input type="number" min={30} value={local.delay_max_seconds ?? 180}
                    onChange={(e) => setDraft({ ...local, delay_max_seconds: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Pausa longa a cada N msgs</Label>
                  <Input type="number" min={3} value={local.pausa_longa_a_cada ?? 6}
                    onChange={(e) => setDraft({ ...local, pausa_longa_a_cada: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Pausa longa (seg, mín–máx)</Label>
                  <div className="flex gap-1">
                    <Input type="number" min={60} value={local.pausa_longa_min_seconds ?? 180}
                      onChange={(e) => setDraft({ ...local, pausa_longa_min_seconds: Number(e.target.value) })} />
                    <Input type="number" min={60} value={local.pausa_longa_max_seconds ?? 480}
                      onChange={(e) => setDraft({ ...local, pausa_longa_max_seconds: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="validar"
                  checked={local.validar_numero ?? true}
                  onCheckedChange={(v) => setDraft({ ...local, validar_numero: v })}
                />
                <Label htmlFor="validar" className="text-xs cursor-pointer">
                  Validar se número tem WhatsApp antes de enviar (reduz falhas e marcações de spam)
                </Label>
              </div>

              <div>
                <Label className="text-xs">Instância Evolution (dedicada)</Label>
                <Input value={local.evolution_instance || ""}
                  onChange={(e) => setDraft({ ...local, evolution_instance: e.target.value })} />
              </div>

              <div>
                <Label className="text-xs">Mensagem padrão (use <code>{"{nome}"}</code>)</Label>
                <Textarea rows={3} value={local.mensagem_template || ""}
                  onChange={(e) => setDraft({ ...local, mensagem_template: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Usada como fallback se nenhuma variante estiver cadastrada.
                </p>
              </div>

              {/* Spintax — variantes */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold">
                    Variantes da mensagem (Spintax){" "}
                    <span className="text-muted-foreground font-normal">— recomendado: 5 a 8</span>
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      const arr = Array.isArray(local.mensagens_variantes) ? [...local.mensagens_variantes] : [];
                      arr.push("");
                      setDraft({ ...local, mensagens_variantes: arr });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar variante
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  💡 O sistema escolhe uma variante aleatória a cada disparo para evitar detecção por assinatura. Use <code>{"{nome}"}</code> em cada uma.
                </p>
                <div className="space-y-2">
                  {(Array.isArray(local.mensagens_variantes) ? local.mensagens_variantes : []).map((v: string, i: number) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-[10px] text-muted-foreground pt-2 w-8">#{i + 1}</span>
                      <Textarea
                        rows={2}
                        value={v}
                        placeholder="Oi {nome}, tudo bem? Ainda tem interesse em..."
                        onChange={(e) => {
                          const arr = [...local.mensagens_variantes];
                          arr[i] = e.target.value;
                          setDraft({ ...local, mensagens_variantes: arr });
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          const arr = [...local.mensagens_variantes];
                          arr.splice(i, 1);
                          setDraft({ ...local, mensagens_variantes: arr });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {(!local.mensagens_variantes || local.mensagens_variantes.length === 0) && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Nenhuma variante cadastrada — será usada a mensagem padrão acima.
                    </p>
                  )}
                </div>
              </div>

              {/* ===== 2ª Onda de reengajamento ===== */}
              <div className="border-t pt-3 mt-4 space-y-3 bg-indigo-50/40 dark:bg-indigo-950/10 -mx-3 px-3 py-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    🌊 2ª Onda de Reengajamento
                    <Badge variant="outline" className="text-[10px]">Follow-up</Badge>
                  </Label>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs"
                    onClick={dispararWave2}
                    disabled={starting || isRunning}
                  >
                    {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Disparar 2ª onda agora
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Envia uma segunda mensagem para leads que receberam a 1ª e <strong>não responderam nada</strong>.
                  Quem disse SIM, NÃO ou número inválido é automaticamente excluído.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Dias mínimos após a 1ª mensagem</Label>
                    <Input
                      type="number"
                      min={1}
                      value={local.wave2_min_dias_apos_wave1 ?? 5}
                      onChange={(e) => setDraft({ ...local, wave2_min_dias_apos_wave1: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Template Meta da 2ª onda (nome aprovado)</Label>
                    <Input
                      placeholder="ex: reengajamento_v2"
                      value={local.meta_template_name_2 || ""}
                      onChange={(e) => setDraft({ ...local, meta_template_name_2: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">URL da imagem do header da 2ª onda (opcional)</Label>
                  <Input
                    placeholder="https://… (preencha apenas se o template tem header de IMAGEM)"
                    value={local.meta_header_image_url_2 || ""}
                    onChange={(e) => setDraft({ ...local, meta_header_image_url_2: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Use a mesma URL da imagem aprovada no template Meta da 2ª onda.</p>
                </div>
                <div>
                  <Label className="text-xs">Mensagem 2 — fallback Evolution (use <code>{"{nome}"}</code>)</Label>
                  <Textarea
                    rows={3}
                    placeholder="Oi {nome}! Voltamos rapidinho aqui — surgiu algo novo que pode te interessar..."
                    value={local.mensagem_template_2 || ""}
                    onChange={(e) => setDraft({ ...local, mensagem_template_2: e.target.value })}
                  />
                  {!local.mensagem_template_2 && !local.meta_template_name_2 && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                      ⚠️ Preencha a mensagem (Evolution) ou o template Meta antes de disparar a 2ª onda.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold">Variantes da 2ª mensagem (Spintax)</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => {
                        const arr = Array.isArray(local.mensagens_variantes_2) ? [...local.mensagens_variantes_2] : [];
                        arr.push("");
                        setDraft({ ...local, mensagens_variantes_2: arr });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar variante
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(Array.isArray(local.mensagens_variantes_2) ? local.mensagens_variantes_2 : []).map((v: string, i: number) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-[10px] text-muted-foreground pt-2 w-8">#{i + 1}</span>
                        <Textarea
                          rows={2}
                          value={v}
                          placeholder="Oi {nome}, voltei rapidinho aqui..."
                          onChange={(e) => {
                            const arr = [...local.mensagens_variantes_2];
                            arr[i] = e.target.value;
                            setDraft({ ...local, mensagens_variantes_2: arr });
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            const arr = [...local.mensagens_variantes_2];
                            arr.splice(i, 1);
                            setDraft({ ...local, mensagens_variantes_2: arr });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 justify-end items-center pt-3 border-t">
            {(cfg as any)?.paused_until_release && (
              <Badge className="bg-red-100 text-red-800 mr-auto" title={(cfg as any)?.paused_reason || ""}>
                🔒 Travado — liberação manual via SQL
              </Badge>
            )}
            {!(cfg as any)?.paused_until_release && (cfg as any)?.paused && !isRunning && (
              <Badge className="bg-amber-100 text-amber-800 mr-auto">⏸️ Pausado</Badge>
            )}
            {isRunning ? (
              <>
                <Button variant="outline" size="sm" onClick={pausarDisparo} disabled={isPausing}>
                  <Pause className="h-3.5 w-3.5 mr-1" />
                  {isPausing ? "Pausando…" : "Pausar"}
                </Button>
                <Button variant="destructive" size="sm" onClick={pararDisparo}>
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Parar
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={dispararAgora}
                disabled={starting || !!(cfg as any)?.paused_until_release}
                title={(cfg as any)?.paused_until_release ? ((cfg as any)?.paused_reason || "Central travada — destravar via SQL admin") : undefined}
              >
                {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                {(cfg as any)?.paused ? "Retomar disparo" : "Disparar agora"}
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saving || !draft}>
              {saving ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : null}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de execuções */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Histórico de disparos</CardTitle>
          <Button size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: ["reengajamento-runs"] })}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum disparo ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Início</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                    <th className="text-center py-2 px-2 font-medium">Enviados</th>
                    <th className="text-center py-2 px-2 font-medium">Falhas</th>
                    <th className="text-center py-2 px-2 font-medium">Ignorados</th>
                    <th className="text-left py-2 px-2 font-medium">Motivo da parada</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 align-top">
                      <td className="py-2 px-2 whitespace-nowrap">{formatBRT(r.started_at, "dd/MM HH:mm:ss")}</td>
                      <td className="py-2 px-2">{runStatusBadge(r.status)}</td>
                      <td className="py-2 px-2 text-center font-semibold text-green-700">{r.enviados || 0}/{r.total_alvo || 0}</td>
                      <td className="py-2 px-2 text-center text-red-600">{r.falhas || 0}</td>
                      <td className="py-2 px-2 text-center text-amber-600">{r.ignorados || 0}</td>
                      <td className="py-2 px-2 max-w-[320px]">
                        <span className="text-[11px] text-muted-foreground line-clamp-2">{r.motivo_parada || "—"}</span>
                        {Array.isArray(r.erros) && r.erros.length > 0 && (
                          <details className="text-[10px] mt-1">
                            <summary className="cursor-pointer text-red-600">Ver {r.erros.length} erro(s)</summary>
                            <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                              {r.erros.map((e: string, i: number) => (
                                <li key={i} className="text-muted-foreground"><AlertCircle className="inline h-3 w-3 mr-1" />{e}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela últimos envios */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Últimos leads contatados</CardTitle>
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
                    <th className="text-left py-2 px-2 font-medium">Enviado</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                    <th className="text-left py-2 px-2 font-medium">Última resposta</th>
                    <th className="text-center py-2 px-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimos.map((l: any) => {
                    const podeReativar = !l.reativado_por_nutricao && (l.reengajamento_status === "respondeu_outro" || l.reengajamento_status === "respondeu_nao" || l.reengajamento_status === "enviado");
                    return (
                      <tr key={l.id} className="border-b hover:bg-muted/30 align-top">
                        <td className="py-2 px-2 font-medium">
                          {l.nome}
                          {l.reativado_por_nutricao && (
                            <Badge className="bg-orange-100 text-orange-800 text-[9px] ml-1">🔄 REATIVADO</Badge>
                          )}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">{l.telefone}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{l.reengajamento_enviado_at ? formatBRT(l.reengajamento_enviado_at, "dd/MM HH:mm") : "—"}</td>
                        <td className="py-2 px-2 text-center">{statusBadge(l.reengajamento_status)}</td>
                        <td className="py-2 px-2 max-w-[280px]">
                          {l.ultimaResposta ? (
                            <div className="text-[11px]">
                              <div className="text-foreground line-clamp-2">"{l.ultimaResposta.body}"</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{formatBRT(l.ultimaResposta.timestamp, "dd/MM HH:mm")}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {podeReativar ? (
                            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => reativarManual(l.id, l.nome)}>
                              🔄 Reativar
                            </Button>
                          ) : l.reativado_por_nutricao ? (
                            <span className="text-[10px] text-green-700"><CheckCircle2 className="inline h-3 w-3 mr-0.5" />Na roleta</span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal QR Code */}
      <Dialog open={qrOpen} onOpenChange={(o) => {
        if (!o) {
          setQrOpen(false);
          if (pollRef.current) clearInterval(pollRef.current);
          if (tickRef.current) clearInterval(tickRef.current);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie com o WhatsApp da nutrição</DialogTitle>
            <DialogDescription>
              No celular dedicado: WhatsApp → Dispositivos conectados → Conectar dispositivo → escaneie o QR.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrBase64 ? (
              <>
                <img
                  src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                  alt="QR Code"
                  className="w-56 h-56 rounded-lg border"
                />
                <span className="text-xs text-muted-foreground">Expira em <strong>{qrTimer}s</strong></span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-muted-foreground">QR Code expirado</p>
                <Button size="sm" onClick={handleNewQr} disabled={waBusy}>
                  {waBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Gerar novo QR
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
