import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useRoleta,
  getCurrentWindowInfo,
  getBrtDateInfo,
} from "@/hooks/useRoleta";
import { compareRoletaSegmentos } from "@/hooks/useRoletaSegmentos";
import { useElegibilidadeRoleta } from "@/hooks/useElegibilidadeRoleta";
import { useMinhaAlocacao } from "@/hooks/useFocoCorretores";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Clock,
  Users,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { subHours } from "date-fns";
import { StateWrapper } from "@/components/ui/StateWrapper";

// ─── Countdown Timer ───
function CountdownTimer({ target }: { target: Date }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return (
    <span className="font-mono font-bold text-primary">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function RoletaCorretorView() {
  const { user } = useAuth();
  const { segmentos, meuCredenciamento, fila, loading, submitting, sairDaRoleta } =
    useRoleta();
  const { elegibilidade, carregando: carregandoElegibilidade } = useElegibilidadeRoleta();
  const {
    data: minhaAlocacao = [],
    isLoading: loadingAlocacao,
    isError: erroAlocacao,
    refetch: refetchAlocacao,
    isFetching: fetchingAlocacao,
  } = useMinhaAlocacao();

  // Relógio vivo: recalcula a janela a cada 30s para a tela virar sozinha
  // quando o credenciamento abre/fecha (PWA fica aberto o dia todo).
  const [windowInfo, setWindowInfo] = useState(() => getCurrentWindowInfo());
  useEffect(() => {
    const i = setInterval(() => setWindowInfo(getCurrentWindowInfo()), 30_000);
    return () => clearInterval(i);
  }, []);

  const { isSunday, isHoliday } = getBrtDateInfo();
  const isDiaEspecial = isSunday || isHoliday;
  const [janelaManual, setJanelaManual] = useState(false);
  const [selectedJanela, setSelectedJanela] = useState<string>(
    isDiaEspecial ? "dia_todo" : windowInfo.credenciamentoJanela || windowInfo.janela
  );

  // Enquanto o corretor não escolher manualmente, segue a janela vigente.
  useEffect(() => {
    if (janelaManual || isDiaEspecial) return;
    const alvo = windowInfo.credenciamentoJanela || windowInfo.janela;
    setSelectedJanela((prev) => (prev === alvo ? prev : alvo));
  }, [windowInfo.credenciamentoJanela, windowInfo.janela, janelaManual, isDiaEspecial]);

  const [marcandoPresenca, setMarcandoPresenca] = useState(false);


  // Noturna eligibility state
  const [noturnaEligible, setNoturnaEligible] = useState<boolean | null>(null);
  const [noturnaReason, setNoturnaReason] = useState<string>("");
  const [checkingNoturna, setCheckingNoturna] = useState(false);

  const checkNoturnaEligibility = useCallback(async () => {
    if (!user?.id) return;
    setCheckingNoturna(true);
    setNoturnaEligible(null);
    setNoturnaReason("");

    try {
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      const idsToCheck = [user.id, profile?.id].filter(Boolean) as string[];

      const { count: visitasCount } = await supabase
        .from("visitas")
        .select("id", { count: "exact", head: true })
        .in("corretor_id", idsToCheck)
        .gte("data_visita", hoje)
        .in("status", ["confirmada", "realizada", "marcada", "pendente", "reagendada"]);

      if (!visitasCount || visitasCount === 0) {
        setNoturnaEligible(false);
        setNoturnaReason("Pra participar da noturna, marque ou realize pelo menos 1 visita hoje.");
        setCheckingNoturna(false);
        return;
      }

      const threeHoursAgo = subHours(new Date(), 3).toISOString();
      const { count: stalledCount } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user.id)
        .lt("updated_at", threeHoursAgo)
        .not("etapa", "in", '("Descartado","Vendido","Distrato")');

      if (stalledCount && stalledCount > 0) {
        setNoturnaEligible(false);
        setNoturnaReason(
          `Você tem ${stalledCount} lead(s) sem atualização há mais de 3h. Atualize seu pipeline antes de se credenciar.`
        );
        setCheckingNoturna(false);
        return;
      }

      setNoturnaEligible(true);
      setNoturnaReason("");
    } catch (error) {
      console.error("Error checking noturna eligibility:", error);
      setNoturnaEligible(true);
    } finally {
      setCheckingNoturna(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedJanela === "noturna") {
      checkNoturnaEligibility();
    } else {
      setNoturnaEligible(null);
      setNoturnaReason("");
    }
  }, [selectedJanela, checkNoturnaEligibility]);

  if (loading) {
    return <StateWrapper loading skeletonVariant="page" className="py-4" />;
  }

  // Already credenciado and approved
  if (meuCredenciamento?.status === "aprovado") {
    const minhasFila = fila.filter((f) => f.corretor_id === user?.id);
    const leadsHoje = minhasFila.reduce((sum, f) => sum + (f.leads_recebidos || 0), 0);
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">🎯 Roleta de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {windowInfo.emoji} {windowInfo.descricao}
          </p>
        </div>
        <Card className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              Você está na roleta!
            </h2>
            <div className="space-y-2 text-sm">
              {minhasFila.map((f) => {
                const seg = segmentos.find((s) => s.id === f.segmento_id);
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2 bg-background rounded-md border"
                  >
                    <span>{seg?.nome || "Segmento"}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Posição {f.posicao}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {f.leads_recebidos || 0} leads
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Leads recebidos hoje: <strong>{leadsHoje}</strong>
            </p>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => sairDaRoleta(meuCredenciamento.id)}
              disabled={submitting}
            >
              <LogOut className="h-4 w-4 mr-1" /> Sair da roleta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending approval
  if (meuCredenciamento?.status === "pendente") {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">🎯 Roleta de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {windowInfo.emoji} {windowInfo.descricao}
          </p>
        </div>
        <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">⏳</div>
            <h2 className="text-lg font-bold text-amber-700 dark:text-amber-400">
              Aguardando aprovação do CEO...
            </h2>
            <p className="text-sm text-muted-foreground">
              Seu credenciamento foi enviado. Assim que aprovado, você entrará automaticamente na
              fila.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              <span className="text-sm text-amber-600">Aguardando...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not credenciado — check if within credenciamento window
  if (!windowInfo.credenciamentoAberto) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">🎯 Roleta de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {windowInfo.emoji} {windowInfo.descricao}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">🔒</div>
            <h2 className="text-lg font-bold">Credenciamento fechado</h2>
            <p className="text-sm text-muted-foreground">
              O credenciamento abre nos seguintes horários:
            </p>
            <div className="space-y-1 text-sm text-left max-w-xs mx-auto">
              <p>🌅 <strong>Manhã</strong>: 07:00 – 09:30</p>
              <p>🌞 <strong>Tarde</strong>: 12:00 – 13:30</p>
              <p>🌙 <strong>Noturna</strong>: 18:30 – 21:30</p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Próxima abertura em </span>
              <CountdownTimer target={windowInfo.proximaTransicao} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Marcar presença via alocação
  // O servidor (credenciar_por_alocacao) é a validação real da alocação —
  // aqui não bloqueamos por leitura local vazia/falha.
  const handleMarcarPresenca = async () => {
    setMarcandoPresenca(true);
    try {
      const { data, error } = await supabase.rpc("credenciar_por_alocacao", {
        p_janela: selectedJanela,
      });
      if (error) throw error;
      const res = data as { success: boolean; error?: string; message?: string };
      if (!res.success) {
        toast.error(res.error || "Falha ao marcar presença");
        return;
      }
      toast.success(res.message || "Presença registrada!");
      refetchAlocacao();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || String(e)));
    } finally {
      setMarcandoPresenca(false);
    }
  };

  const semAlocacao = !loadingAlocacao && !erroAlocacao && minhaAlocacao.length === 0;
  const alocacaoAtiva = minhaAlocacao.filter((a) => a.ativo);
  const todosInativos = !loadingAlocacao && minhaAlocacao.length > 0 && alocacaoAtiva.length === 0;


  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">🎯 Roleta de Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {windowInfo.emoji} {windowInfo.descricao}
        </p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <CountdownTimer target={windowInfo.proximaTransicao} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 Marcar presença na roleta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Janela */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Janela</label>
            <Select
              value={selectedJanela}
              onValueChange={(v) => {
                setJanelaManual(true);
                setSelectedJanela(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a janela" />
              </SelectTrigger>
              <SelectContent>
                {isDiaEspecial ? (
                  <SelectItem value="dia_todo">☀️ Dia Todo (08:00–23:30)</SelectItem>
                ) : (
                  (() => {
                    const now = new Date();
                    const brt = new Date(
                      now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
                    );
                    const mins = brt.getHours() * 60 + brt.getMinutes();
                    const t0930 = 9 * 60 + 30;
                    const t1200 = 12 * 60;
                    const t1330 = 13 * 60 + 30;
                    const t1830 = 18 * 60 + 30;
                    const t2130 = 21 * 60 + 30;

                    const manhaEncerrado = mins >= t0930;
                    const tardeEncerrado = mins >= t1330;
                    const noturnaEncerrado = mins >= t2130;
                    const noturnaAindaNaoAbriu = mins < t1830;

                    return (
                      <>
                        <SelectItem value="manha" disabled={manhaEncerrado}>
                          🌅 Manhã (07:00–12:00) {manhaEncerrado ? "— encerrado" : ""}
                        </SelectItem>

                        <SelectItem value="tarde" disabled={tardeEncerrado || mins < t1200}>
                          🌞 Tarde (12:00–18:30){" "}
                          {tardeEncerrado
                            ? "— encerrado"
                            : mins < t1200
                            ? "— abre às 12:00"
                            : ""}
                        </SelectItem>
                        <SelectItem
                          value="noturna"
                          disabled={noturnaEncerrado || noturnaAindaNaoAbriu}
                        >
                          🌙 Noturna (18:30–23:30){" "}
                          {noturnaEncerrado
                            ? "— encerrado"
                            : noturnaAindaNaoAbriu
                            ? "— abre às 18:30"
                            : ""}
                        </SelectItem>
                      </>
                    );
                  })()
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Card: Seus empreendimentos hoje */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Seus empreendimentos hoje</label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => refetchAlocacao()}
                disabled={fetchingAlocacao}
              >
                {fetchingAlocacao ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Atualizar"
                )}
              </Button>
            </div>
            {loadingAlocacao ? (
              <div className="flex items-center gap-2 p-3 rounded-md border bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Carregando alocação...</span>
              </div>
            ) : erroAlocacao ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Não consegui carregar seu foco agora. Toque em “Atualizar” — você ainda pode
                  marcar presença, a validação é feita no servidor.
                </p>
              </div>
            ) : todosInativos ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Seus empreendimentos de foco estão inativos no momento. Fale com seu gestor
                  para reativar e voltar a receber leads.
                </p>
              </div>
            ) : semAlocacao ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Você ainda não tem empreendimentos alocados. Fale com seu gestor pra receber
                  leads da roleta. Se o gestor acabou de definir, toque em “Atualizar”.
                </p>
              </div>
            ) : (

              <div className="rounded-md border bg-muted/30 divide-y">
                {alocacaoAtiva.map((a) => (
                  <div
                    key={a.empreendimento_id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-sm">🏢 {a.empreendimento_nome}</span>
                    {a.segmento_nome && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.segmento_nome}
                      </Badge>
                    )}
                  </div>
                ))}
                <div className="px-3 py-2 text-[11px] text-muted-foreground bg-background/50">
                  Definido pelo seu gestor. Alteração? Fale com ele.
                </div>
              </div>
            )}
          </div>

          {/* Sunday/Holiday eligibility */}
          {isDiaEspecial && elegibilidade && !elegibilidade.pode_domingo && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
              <Ban className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">
                Para participar da roleta de {isSunday ? "domingo" : "feriado"}, você precisa ter
                realizado pelo menos {elegibilidade.visitas_min_domingo} visitas de segunda a
                sábado. Você realizou {elegibilidade.visitas_semana}.
              </p>
            </div>
          )}
          {isDiaEspecial && elegibilidade && elegibilidade.pode_domingo && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Elegível! {elegibilidade.visitas_semana} visitas realizadas na semana.
              </p>
            </div>
          )}

          {/* Noturna validation feedback */}
          {selectedJanela === "noturna" && (
            <>
              {checkingNoturna && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted border">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Verificando elegibilidade...</p>
                </div>
              )}
              {!checkingNoturna && noturnaEligible === false && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <Ban className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">{noturnaReason}</p>
                </div>
              )}
              {!checkingNoturna && noturnaEligible === true && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Você está elegível para a janela noturna!
                  </p>
                </div>
              )}
              {noturnaEligible === null && !checkingNoturna && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Para a janela noturna, é necessário ter marcado ou realizado pelo menos 1 visita
                    hoje e não possuir leads sem atualização há mais de 3h.
                  </p>
                </div>
              )}
            </>
          )}

          <Button
            className="w-full"
            onClick={handleMarcarPresenca}
            disabled={
              loadingAlocacao ||
              marcandoPresenca ||
              submitting ||

              submitting ||
              (selectedJanela === "noturna" &&
                (checkingNoturna || noturnaEligible === false)) ||
              (isDiaEspecial && elegibilidade && !elegibilidade.pode_domingo) ||
              carregandoElegibilidade
            }
          >
            {marcandoPresenca ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            ✅ Marcar presença
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

