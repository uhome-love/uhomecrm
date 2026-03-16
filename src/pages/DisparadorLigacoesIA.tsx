/**
 * DisparadorLigacoesIA — CEO-only page for sequential AI calling via Twilio + ElevenLabs
 * Similar to WhatsApp Campaign Dispatcher but for outbound voice calls.
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
  Clock, User, Filter, List, BarChart3, RefreshCw, ChevronLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOAListas, type OALista, type OALead } from "@/hooks/useOfertaAtiva";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ── Types ──
interface CallResult {
  lead: OALead;
  status: string;
  duration: number | null;
  callSid: string | null;
  error?: string;
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
  calling: { label: "Ligando...", color: "text-blue-500", icon: Phone },
  ringing: { label: "Chamando", color: "text-amber-500", icon: Phone },
  "in-progress": { label: "Em andamento", color: "text-emerald-500", icon: Bot },
  completed: { label: "Concluída", color: "text-emerald-600", icon: CheckCircle },
  busy: { label: "Ocupado", color: "text-amber-600", icon: PhoneOff },
  "no-answer": { label: "Sem resposta", color: "text-destructive", icon: XCircle },
  failed: { label: "Falhou", color: "text-destructive", icon: XCircle },
  canceled: { label: "Cancelada", color: "text-muted-foreground", icon: XCircle },
  skipped: { label: "Sem telefone", color: "text-muted-foreground", icon: XCircle },
};

export default function DisparadorLigacoesIA() {
  const navigate = useNavigate();
  const { listas, isLoading: listasLoading } = useOAListas();
  const activeListas = useMemo(() => listas.filter(l => l.status === "ativa"), [listas]);

  // ── Step 1: Configuration ──
  const [selectedListaIds, setSelectedListaIds] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState("all");
  const [delayBetweenCalls, setDelayBetweenCalls] = useState(5); // seconds

  // ── Step 2: Queue & Execution ──
  const [step, setStep] = useState<"config" | "preview" | "running" | "done">("config");
  const [queue, setQueue] = useState<OALead[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<CallResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);
  const pauseRef = useRef(false);

  // Toggle lista selection
  const toggleLista = (id: string) => {
    setSelectedListaIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Load leads from selected lists ──
  const loadQueue = async () => {
    if (selectedListaIds.length === 0) {
      toast.error("Selecione pelo menos uma lista");
      return;
    }
    setLoadingQueue(true);
    try {
      // Fetch leads from selected lists
      let query = supabase
        .from("oferta_ativa_leads")
        .select("*")
        .in("lista_id", selectedListaIds)
        .in("status", ["na_fila", "em_cooldown"])
        .not("telefone", "is", null)
        .order("tentativas_count", { ascending: true });

      const { data: leads, error } = await query;
      if (error) throw error;

      let filtered = (leads || []) as OALead[];

      // Apply result filter
      if (resultFilter === "never_called") {
        filtered = filtered.filter(l => l.tentativas_count === 0);
      } else if (resultFilter !== "all") {
        // Need to check last attempt result — fetch tentativas for these leads
        const leadIds = filtered.map(l => l.id);
        if (leadIds.length > 0) {
          const { data: tentativas } = await supabase
            .from("oferta_ativa_tentativas")
            .select("lead_id, resultado, created_at")
            .in("lead_id", leadIds)
            .order("created_at", { ascending: false });

          // Get last result per lead
          const lastResult = new Map<string, string>();
          for (const t of tentativas || []) {
            if (!lastResult.has(t.lead_id)) {
              lastResult.set(t.lead_id, t.resultado);
            }
          }
          filtered = filtered.filter(l => lastResult.get(l.id) === resultFilter);
        }
      }

      // Filter out leads without phone
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
    setStep("running");
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pauseRef.current = false;

    for (let i = currentIndex; i < queue.length; i++) {
      if (abortRef.current) break;

      // Wait while paused
      while (pauseRef.current && !abortRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (abortRef.current) break;

      const lead = queue[i];
      setCurrentIndex(i);

      if (!lead.telefone) {
        setResults(prev => [...prev, { lead, status: "skipped", duration: null, callSid: null }]);
        continue;
      }

      // Initiate call
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

      // Wait between calls (give time for the AI to finish conversation)
      if (i < queue.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, delayBetweenCalls * 1000));
      }
    }

    setIsRunning(false);
    setStep("done");
    toast.success("🏁 Sessão de ligações concluída!");
  };

  const handlePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
    setIsRunning(false);
    setStep("done");
  };

  const handleReset = () => {
    setStep("config");
    setQueue([]);
    setResults([]);
    setCurrentIndex(0);
    setIsRunning(false);
    setIsPaused(false);
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const total = results.length;
    const initiated = results.filter(r => r.status === "initiated").length;
    const failed = results.filter(r => r.status === "failed").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    return { total, initiated, failed, skipped };
  }, [results]);

  // ── Render ──
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

      {/* ─── STEP 1: CONFIG ─── */}
      {step === "config" && (
        <div className="space-y-4">
          {/* List Selection */}
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

          {/* Filters */}
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
                  <span>3s</span>
                  <span>30s</span>
                  <span>60s</span>
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{lead.telefone}</span>
                      {lead.tentativas_count > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {lead.tentativas_count} tent.
                        </Badge>
                      )}
                    </div>
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
          {/* Progress */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {step === "done" ? "Concluído" : isPaused ? "⏸ Pausado" : "🔄 Em execução"}
                </span>
                <span className="font-semibold">
                  {results.length} / {queue.length}
                </span>
              </div>
              <Progress value={(results.length / Math.max(queue.length, 1)) * 100} />

              {/* Current lead */}
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

              {/* Controls */}
              {step === "running" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePause}
                    className="flex-1 gap-1.5"
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? "Retomar" : "Pausar"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleStop}
                    className="flex-1 gap-1.5"
                  >
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
                <p className="text-xs text-muted-foreground">Ligações Iniciadas</p>
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
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Log de Ligações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {[...results].reverse().map((r, i) => {
                    const st = CALL_STATUS[r.status] || CALL_STATUS.waiting;
                    const StIcon = st.icon;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 border border-border"
                      >
                        <div className="flex items-center gap-2">
                          <StIcon className={`h-3.5 w-3.5 ${st.color}`} />
                          <span>{r.lead.nome}</span>
                        </div>
                        <div className="flex items-center gap-2">
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
