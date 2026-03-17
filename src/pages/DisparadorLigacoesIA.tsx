/**
 * DisparadorLigacoesIA — CEO-only page for sequential AI calling via Twilio + ElevenLabs
 * Sessions persist in ai_call_sessions so progress survives navigation.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Bot, Phone, PhoneOff, Play, Pause, Square, Loader2, CheckCircle, XCircle,
  Clock, User, Filter, List, BarChart3, RefreshCw, ChevronLeft, RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOAListas, type OALead } from "@/hooks/useOfertaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ── Types ──
interface CallResult {
  lead: { id: string; nome: string; telefone: string | null; empreendimento: string | null };
  status: string;
  duration: number | null;
  callSid: string | null;
  error?: string;
  resultado?: string | null;
  resumo_ia?: string | null;
}

interface SessionRow {
  id: string;
  status: string;
  lista_ids: string[];
  result_filter: string;
  delay_seconds: number;
  queue_lead_ids: string[];
  current_index: number;
  total_leads: number;
  created_at: string;
}

const RESULT_FILTERS = [
  { value: "all", label: "Todos os leads" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "numero_errado", label: "Número errado" },
  { value: "never_called", label: "Nunca ligados" },
];

const CALL_STATUS: Record<string, { label: string; color: string; icon: typeof Phone }> = {
  waiting: { label: "Aguardando", color: "text-muted-foreground", icon: Clock },
  initiated: { label: "Iniciada", color: "text-blue-500", icon: Phone },
  calling: { label: "Ligando...", color: "text-blue-500", icon: Phone },
  ringing: { label: "Chamando", color: "text-amber-500", icon: Phone },
  "in-progress": { label: "Em andamento", color: "text-emerald-500", icon: Bot },
  completed: { label: "Concluída", color: "text-emerald-600", icon: CheckCircle },
  completed_positive: { label: "✅ Positiva", color: "text-emerald-600", icon: CheckCircle },
  nao_atendeu: { label: "Não atendeu", color: "text-amber-600", icon: PhoneOff },
  erro: { label: "Erro", color: "text-destructive", icon: XCircle },
  busy: { label: "Ocupado", color: "text-amber-600", icon: PhoneOff },
  "no-answer": { label: "Sem resposta", color: "text-destructive", icon: XCircle },
  failed: { label: "Falhou", color: "text-destructive", icon: XCircle },
  canceled: { label: "Cancelada", color: "text-muted-foreground", icon: XCircle },
  skipped: { label: "Sem telefone", color: "text-muted-foreground", icon: XCircle },
};

export default function DisparadorLigacoesIA() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listas, isLoading: listasLoading } = useOAListas();
  const activeListas = useMemo(() => listas.filter(l => l.status === "ativa" || l.status === "liberada"), [listas]);

  // ── Config ──
  const [selectedListaIds, setSelectedListaIds] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState("all");
  const [delayBetweenCalls, setDelayBetweenCalls] = useState(5);

  // ── Session state ──
  const [step, setStep] = useState<"config" | "preview" | "running" | "done">("config");
  const [queue, setQueue] = useState<{ id: string; nome: string; telefone: string | null; empreendimento: string | null }[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<CallResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [pendingSession, setPendingSession] = useState<SessionRow | null>(null);
  const abortRef = useRef(false);
  const pauseRef = useRef(false);

  // ── Restore active session on mount ──
  useEffect(() => {
    if (!user) { setRestoringSession(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("ai_call_sessions" as any)
          .select("*")
          .eq("created_by", user.id)
          .in("status", ["running", "paused"])
          .order("created_at", { ascending: false })
          .limit(1);
        const session = (data as any)?.[0] as SessionRow | undefined;
        if (session && session.queue_lead_ids.length > 0) {
          setPendingSession(session);
        }
      } catch (e) {
        console.error("Failed to check active session:", e);
      } finally {
        setRestoringSession(false);
      }
    })();
  }, [user]);

  const restoreSession = useCallback(async (session: SessionRow) => {
    // Load lead info for the remaining queue
    const remainingIds = session.queue_lead_ids.slice(session.current_index);
    if (remainingIds.length === 0) {
      setPendingSession(null);
      return;
    }

    const { data: leads } = await supabase
      .from("oferta_ativa_leads")
      .select("id, nome, telefone, empreendimento")
      .in("id", remainingIds);

    // Also load already-processed calls from ai_calls for this session
    const processedIds = session.queue_lead_ids.slice(0, session.current_index);
    let pastResults: CallResult[] = [];
    if (processedIds.length > 0) {
      const { data: pastLeads } = await supabase
        .from("oferta_ativa_leads")
        .select("id, nome, telefone, empreendimento")
        .in("id", processedIds);
      
      const { data: pastCalls } = await supabase
        .from("ai_calls")
        .select("lead_id, status, duracao_segundos, twilio_call_sid, resultado, resumo_ia")
        .in("lead_id", processedIds)
        .order("created_at", { ascending: false });

      const callMap = new Map<string, any>();
      for (const c of pastCalls || []) {
        if (c.lead_id && !callMap.has(c.lead_id)) callMap.set(c.lead_id, c);
      }

      pastResults = (pastLeads || []).map(l => {
        const call = callMap.get(l.id);
        return {
          lead: l,
          status: call?.status || "completed",
          duration: call?.duracao_segundos ?? null,
          callSid: call?.twilio_call_sid ?? null,
          resultado: call?.resultado ?? null,
          resumo_ia: call?.resumo_ia ?? null,
        };
      });
    }

    // Maintain original queue order
    const leadMap = new Map((leads || []).map(l => [l.id, l]));
    const orderedQueue = remainingIds
      .map(id => leadMap.get(id))
      .filter(Boolean) as typeof queue;

    setSessionId(session.id);
    setSelectedListaIds(session.lista_ids);
    setResultFilter(session.result_filter || "all");
    setDelayBetweenCalls(session.delay_seconds || 5);
    setQueue(orderedQueue);
    setCurrentIndex(0); // reset to 0 since queue is already sliced
    setResults(pastResults);
    setStep("running");
    setIsPaused(true);
    pauseRef.current = true;
    setPendingSession(null);

    // Update session status to paused
    await supabase
      .from("ai_call_sessions" as any)
      .update({ status: "paused", updated_at: new Date().toISOString() } as any)
      .eq("id", session.id);

    toast.success(`Sessão restaurada — ${orderedQueue.length} leads restantes`);
  }, []);

  const dismissSession = useCallback(async (session: SessionRow) => {
    await supabase
      .from("ai_call_sessions" as any)
      .update({ status: "done", updated_at: new Date().toISOString() } as any)
      .eq("id", session.id);
    setPendingSession(null);
  }, []);

  // ── Realtime subscription + polling for ai_calls status updates ──
  const refreshCallResults = useCallback(async () => {
    setResults(prev => {
      const sids = prev.filter(r => r.callSid).map(r => r.callSid!);
      if (sids.length === 0) return prev;
      
      // Fire async query and update state when done
      supabase
        .from("ai_calls")
        .select("twilio_call_sid, status, duracao_segundos, resultado, resumo_ia")
        .in("twilio_call_sid", sids)
        .then(({ data }) => {
          if (!data || data.length === 0) return;
          const callMap = new Map(data.map(c => [c.twilio_call_sid, c]));
          setResults(current => current.map(r => {
            if (!r.callSid) return r;
            const updated = callMap.get(r.callSid);
            if (!updated) return r;
            return {
              ...r,
              status: updated.status || r.status,
              duration: updated.duracao_segundos ?? r.duration,
              resultado: updated.resultado ?? r.resultado,
              resumo_ia: updated.resumo_ia ?? r.resumo_ia,
            };
          }));
        });
      
      return prev;
    });
  }, []);

  // Auto-poll every 10s while running or recently done
  useEffect(() => {
    if (step !== "running" && step !== "done") return;
    if (results.length === 0) return;
    
    // Initial refresh
    refreshCallResults();
    
    const interval = setInterval(refreshCallResults, 10000);
    return () => clearInterval(interval);
  }, [step, results.length, refreshCallResults]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('ai-calls-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_calls' },
        (payload) => {
          const updated = payload.new as any;
          const sid = updated.twilio_call_sid;
          if (!sid) return;
          setResults(prev => prev.map(r => {
            if (r.callSid === sid) {
              return {
                ...r,
                status: updated.status || r.status,
                duration: updated.duracao_segundos ?? r.duration,
                resultado: updated.resultado ?? r.resultado,
                resumo_ia: updated.resumo_ia ?? r.resumo_ia,
              };
            }
            return r;
          }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleLista = (id: string) => {
    setSelectedListaIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Persist session helper ──
  const saveSession = useCallback(async (
    sid: string,
    updates: Partial<{ status: string; current_index: number }>
  ) => {
    await supabase
      .from("ai_call_sessions" as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", sid);
  }, []);

  // ── Load leads from selected lists ──
  const loadQueue = async () => {
    if (selectedListaIds.length === 0) {
      toast.error("Selecione pelo menos uma lista");
      return;
    }
    setLoadingQueue(true);
    try {
      let query = supabase
        .from("oferta_ativa_leads")
        .select("id, nome, telefone, empreendimento, tentativas_count")
        .in("lista_id", selectedListaIds)
        .in("status", ["na_fila", "em_cooldown"])
        .not("telefone", "is", null)
        .order("tentativas_count", { ascending: true });

      const { data: leads, error } = await query;
      if (error) throw error;

      let filtered = (leads || []) as (typeof queue[0] & { tentativas_count: number })[];

      if (resultFilter === "never_called") {
        filtered = filtered.filter(l => l.tentativas_count === 0);
      } else if (resultFilter !== "all") {
        const leadIds = filtered.map(l => l.id);
        if (leadIds.length > 0) {
          const { data: tentativas } = await supabase
            .from("oferta_ativa_tentativas")
            .select("lead_id, resultado, created_at")
            .in("lead_id", leadIds)
            .order("created_at", { ascending: false });
          const lastResult = new Map<string, string>();
          for (const t of tentativas || []) {
            if (!lastResult.has(t.lead_id)) lastResult.set(t.lead_id, t.resultado);
          }
          filtered = filtered.filter(l => lastResult.get(l.id) === resultFilter);
        }
      }

      filtered = filtered.filter(l => l.telefone && l.telefone.replace(/\D/g, "").length >= 8);

      setQueue(filtered);
      setStep("preview");
      toast.success(`${filtered.length} leads carregados na fila`);
    } catch (err: any) {
      toast.error(`Erro ao carregar leads: ${err.message}`);
    } finally {
      setLoadingQueue(false);
    }
  };

  // ── Execute sequential calls ──
  const startCalling = async () => {
    if (!user) return;
    setStep("running");
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pauseRef.current = false;

    // Create or reuse session
    let sid = sessionId;
    if (!sid) {
      const { data: newSession } = await supabase
        .from("ai_call_sessions" as any)
        .insert({
          created_by: user.id,
          status: "running",
          lista_ids: selectedListaIds,
          result_filter: resultFilter,
          delay_seconds: delayBetweenCalls,
          queue_lead_ids: queue.map(l => l.id),
          current_index: 0,
          total_leads: queue.length,
        } as any)
        .select("id")
        .single();
      sid = (newSession as any)?.id;
      setSessionId(sid);
    } else {
      await saveSession(sid, { status: "running" });
    }

    for (let i = currentIndex; i < queue.length; i++) {
      if (abortRef.current) break;
      while (pauseRef.current && !abortRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (abortRef.current) break;

      const lead = queue[i];
      setCurrentIndex(i);

      // Persist progress
      if (sid) {
        // Calculate the absolute index for the session
        const absoluteIndex = results.length + i;
        saveSession(sid, { current_index: absoluteIndex });
      }

      if (!lead.telefone) {
        setResults(prev => [...prev, { lead, status: "skipped", duration: null, callSid: null }]);
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke("twilio-ai-call", {
          body: {
            lead_id: lead.id,
            telefone: lead.telefone,
            nome: lead.nome,
            empreendimento: lead.empreendimento || "",
          },
        });

        if (error || data?.error) {
          setResults(prev => [...prev, {
            lead,
            status: "failed",
            duration: null,
            callSid: null,
            error: data?.error || error?.message,
          }]);
        } else {
          setResults(prev => [...prev, {
            lead,
            status: "initiated",
            duration: null,
            callSid: data.call_sid,
          }]);
        }
      } catch (err: any) {
        setResults(prev => [...prev, {
          lead,
          status: "failed",
          duration: null,
          callSid: null,
          error: err.message,
        }]);
      }

      if (i < queue.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, delayBetweenCalls * 1000));
      }
    }

    setIsRunning(false);
    setStep("done");
    if (sid) saveSession(sid, { status: "done", current_index: queue.length + results.length });
    toast.success("🏁 Sessão de ligações concluída!");
  };

  const handlePause = () => {
    const newPaused = !pauseRef.current;
    pauseRef.current = newPaused;
    setIsPaused(newPaused);
    if (sessionId) saveSession(sessionId, { status: newPaused ? "paused" : "running" });
  };

  const handleStop = () => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
    setIsRunning(false);
    setStep("done");
    if (sessionId) saveSession(sessionId, { status: "done" });
  };

  const handleReset = () => {
    setStep("config");
    setQueue([]);
    setResults([]);
    setCurrentIndex(0);
    setIsRunning(false);
    setIsPaused(false);
    setSessionId(null);
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const total = results.length;
    const initiated = results.filter(r => ["initiated", "ringing", "in-progress", "completed", "completed_positive"].includes(r.status)).length;
    const failed = results.filter(r => ["failed", "busy", "no-answer", "nao_atendeu", "erro"].includes(r.status)).length;
    const skipped = results.filter(r => r.status === "skipped").length;
    return { total, initiated, failed, skipped };
  }, [results]);

  if (restoringSession) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ceo")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Disparador de Ligações IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Twilio + ElevenLabs · Discagem sequencial automática
          </p>
        </div>
      </div>

      {/* ─── PENDING SESSION BANNER ─── */}
      {pendingSession && step === "config" && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Sessão anterior encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingSession.total_leads} leads no total ·{" "}
                  {pendingSession.total_leads - pendingSession.current_index} restantes ·{" "}
                  Criada em {new Date(pendingSession.created_at).toLocaleString("pt-BR")}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => restoreSession(pendingSession)} className="gap-1.5">
                    <Play className="h-3.5 w-3.5" /> Retomar Sessão
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => dismissSession(pendingSession)}>
                    Descartar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 1: CONFIG ─── */}
      {step === "config" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <List className="h-4 w-4" /> Selecionar Listas de Oferta Ativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listasLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : activeListas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma lista ativa encontrada
                </p>
              ) : (
                <div className="space-y-2">
                  {activeListas.map(lista => (
                    <label
                      key={lista.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedListaIds.includes(lista.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <Checkbox
                        checked={selectedListaIds.includes(lista.id)}
                        onCheckedChange={() => toggleLista(lista.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{lista.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {lista.empreendimento} · {lista.total_leads} leads
                          {lista.campanha && ` · ${lista.campanha}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {lista.total_leads}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Filtrar por último resultado</label>
                <Select value={resultFilter} onValueChange={setResultFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_FILTERS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Intervalo entre ligações: {delayBetweenCalls}s
                </label>
                <input
                  type="range"
                  min={3}
                  max={60}
                  value={delayBetweenCalls}
                  onChange={e => setDelayBetweenCalls(Number(e.target.value))}
                  className="w-full mt-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>3s</span><span>30s</span><span>60s</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={loadQueue}
            disabled={selectedListaIds.length === 0 || loadingQueue}
            className="w-full gap-2"
            size="lg"
          >
            {loadingQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {loadingQueue ? "Carregando leads..." : "Carregar Fila de Ligações"}
          </Button>
        </div>
      )}

      {/* ─── STEP 2: PREVIEW ─── */}
      {step === "preview" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                {queue.length} leads na fila
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto space-y-1">
                {queue.slice(0, 50).map((lead, i) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                      <span className="font-medium">{lead.nome}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{lead.telefone}</span>
                  </div>
                ))}
                {queue.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ... e mais {queue.length - 50} leads
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button
              onClick={startCalling}
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
              size="lg"
            >
              <Play className="h-4 w-4" />
              Iniciar Discagem ({queue.length} leads)
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: RUNNING / DONE ─── */}
      {(step === "running" || step === "done") && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {step === "done" ? "Concluído" : isPaused ? "⏸ Pausado" : "🔄 Em execução"}
                </span>
                <span className="font-semibold">
                  {currentIndex + (isRunning ? 0 : 0)} / {queue.length}
                  {results.length > queue.length && ` (${results.length} total)`}
                </span>
              </div>
              <Progress value={((currentIndex) / Math.max(queue.length, 1)) * 100} />

              {step === "running" && currentIndex < queue.length && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                  </span>
                  <div>
                    <p className="font-medium text-sm">{queue[currentIndex]?.nome}</p>
                    <p className="text-xs text-muted-foreground">{queue[currentIndex]?.telefone}</p>
                  </div>
                </div>
              )}

              {step === "running" && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePause} className="flex-1 gap-1.5">
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? "Retomar" : "Pausar"}
                  </Button>
                  <Button variant="destructive" onClick={handleStop} className="flex-1 gap-1.5">
                    <Square className="h-4 w-4" /> Parar
                  </Button>
                </div>
              )}

              {step === "done" && (
                <Button onClick={handleReset} className="w-full gap-1.5">
                  <RefreshCw className="h-4 w-4" /> Nova Sessão
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats.initiated}</p>
                <p className="text-xs text-muted-foreground">Ligações</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{stats.skipped}</p>
                <p className="text-xs text-muted-foreground">Pulados</p>
              </CardContent>
            </Card>
          </div>

          {/* Results log */}
          {results.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Log de Ligações ({results.length})
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={refreshCallResults} className="gap-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {[...results].reverse().map((r, i) => {
                    const st = CALL_STATUS[r.status] || CALL_STATUS.waiting;
                    const StIcon = st.icon;
                    return (
                      <div
                        key={`${r.lead.id}-${i}`}
                        className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 border border-border"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <StIcon className={`h-3.5 w-3.5 shrink-0 ${st.color}`} />
                          <span className="truncate">{r.lead.nome}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.duration != null && r.duration > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.floor(r.duration / 60)}:{String(r.duration % 60).padStart(2, '0')}
                            </span>
                          )}
                          {r.resultado && (
                            <Badge variant="secondary" className="text-[10px]">
                              {r.resultado}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {st.label}
                          </Badge>
                          {r.error && (
                            <span className="text-[10px] text-destructive truncate max-w-32">
                              {r.error}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
