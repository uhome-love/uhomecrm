import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useRoleta, getCurrentWindowInfo, type JanelaId, type RoletaSegmento } from "@/hooks/useRoleta";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Clock, UserCheck, UserX, Users, Target, RotateCw, LogOut, Rocket, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Ban } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes, format, startOfDay, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import RoletagensTab from "@/components/roleta/RoletagensTab";
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
  return <span className="font-mono font-bold text-primary">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}

// ─── CEO View ───
function CeoView() {
  const {
    segmentos, credenciamentos, fila, distribuicoes, loading, submitting,
    pendentesCount, leadsAcumulados, aprovarCredenciamento, recusarCredenciamento,
    aprovarTodos, removerDaFila, reload,
  } = useRoleta();
  const windowInfo = getCurrentWindowInfo();

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const pendentes = credenciamentos.filter(c => c.status === "pendente");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">🎯 Roleta de Leads</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{windowInfo.emoji}</span>
            <span>{windowInfo.descricao}</span>
            <span className="text-muted-foreground">•</span>
            <Clock className="h-3.5 w-3.5" />
            <CountdownTimer target={windowInfo.proximaTransicao} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Leads acumulados (madrugada) */}
      {windowInfo.janela === "madrugada" && leadsAcumulados > 0 && (
        <Card className="border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-semibold text-lg">{leadsAcumulados} leads acumulados</p>
              <p className="text-sm text-muted-foreground">Aguardando distribuição na roleta da manhã</p>
            </div>
            <Button className="bg-[hsl(var(--primary))]">
              <Rocket className="h-4 w-4 mr-1" /> Disparar para roleta da manhã
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Credenciamentos Pendentes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Credenciamentos Pendentes
              {pendentesCount > 0 && (
                <Badge variant="destructive" className="text-xs">{pendentesCount}</Badge>
              )}
            </CardTitle>
            {pendentes.length > 1 && (
              <Button size="sm" variant="default" onClick={aprovarTodos} disabled={submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Aprovar todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum credenciamento pendente</p>
          ) : (
            <div className="space-y-2">
              {pendentes.map(c => {
                const seg1 = segmentos.find(s => s.id === c.segmento_1_id);
                const seg2 = segmentos.find(s => s.id === c.segmento_2_id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(c.corretor_nome || "C").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{c.corretor_nome}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{c.janela}</Badge>
                          {seg1 && <Badge className="text-[10px] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-0">{seg1.nome}</Badge>}
                          {seg2 && <Badge className="text-[10px] bg-accent text-accent-foreground border-0">{seg2.nome}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="default" onClick={() => aprovarCredenciamento(c.id)} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => recusarCredenciamento(c.id)} disabled={submitting} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roleta Ativa por Segmento */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target className="h-5 w-5" /> Roleta Ativa por Segmento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {segmentos.map(seg => {
            const segFila = fila.filter(f => f.segmento_id === seg.id).sort((a, b) => a.posicao - b.posicao);
            return (
              <Card key={seg.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{seg.nome}</CardTitle>
                  {seg.campanhas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {seg.campanhas.map(c => (
                        <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {segFila.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum corretor na fila</p>
                  ) : (
                    <div className="space-y-1.5">
                      {segFila.map((f, idx) => (
                        <div
                          key={f.id}
                          className={`flex items-center justify-between p-2 rounded-md text-sm ${
                            idx === 0 ? "bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/30" : "bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs w-5 text-center ${idx === 0 ? "text-[hsl(var(--primary))]" : "text-muted-foreground"}`}>
                              {f.posicao}
                            </span>
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px]">
                                {(f.corretor_nome || "C").substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{f.corretor_nome}</span>
                            {idx === 0 && <Badge className="text-[10px] bg-[hsl(var(--primary))] text-primary-foreground">Próximo</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{f.leads_recebidos || 0} leads</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => removerDaFila(f.id)}>
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Distribuições Recentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCw className="h-4 w-4" /> Distribuições Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {distribuicoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma distribuição registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Lead</th>
                    <th className="pb-2 font-medium">Segmento</th>
                    <th className="pb-2 font-medium">Corretor</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {distribuicoes.slice(0, 20).map(d => {
                    const status = d.status || "enviado";
                    const isExpired = status === "expirado" || status === "repassado";
                    const isAccepted = status === "aceito";
                    const timeLeft = d.expira_em ? differenceInMinutes(new Date(d.expira_em), new Date()) : null;
                    return (
                      <tr key={d.id} className={`border-b last:border-0 ${isExpired ? "text-destructive/80" : isAccepted ? "text-emerald-700" : ""}`}>
                        <td className="py-2 font-medium">{d.lead_nome}</td>
                        <td className="py-2">{d.segmento_nome}</td>
                        <td className="py-2">{d.corretor_nome}</td>
                        <td className="py-2">
                          <Badge variant={isExpired ? "destructive" : isAccepted ? "default" : "outline"} className={`text-[10px] ${isAccepted ? "bg-emerald-600" : ""}`}>
                            {status}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {d.enviado_em ? formatDistanceToNow(new Date(d.enviado_em), { addSuffix: true, locale: ptBR }) : "—"}
                          {timeLeft !== null && timeLeft > 0 && !isAccepted && !isExpired && (
                            <span className="ml-1 text-amber-600">({timeLeft}min restantes)</span>
                          )}
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
    </div>
  );
}

// ─── Corretor View ───
function CorretorView() {
  const { user } = useAuth();
  const {
    segmentos, meuCredenciamento, fila, loading, submitting,
    credenciar, sairDaRoleta,
  } = useRoleta();
  const windowInfo = getCurrentWindowInfo();
  const [selectedJanela, setSelectedJanela] = useState<string>(windowInfo.credenciamentoJanela || windowInfo.janela);
  const [seg1, setSeg1] = useState<string>("");
  const [seg2, setSeg2] = useState<string>("");
  
  // Noturna eligibility state
  const [noturnaEligible, setNoturnaEligible] = useState<boolean | null>(null);
  const [noturnaReason, setNoturnaReason] = useState<string>("");
  const [checkingNoturna, setCheckingNoturna] = useState(false);

  // Check noturna eligibility
  const checkNoturnaEligibility = useCallback(async () => {
    if (!user?.id) return;
    
    setCheckingNoturna(true);
    setNoturnaEligible(null);
    setNoturnaReason("");

    try {
      const today = startOfDay(new Date()).toISOString();
      const threeHoursAgo = subHours(new Date(), 3).toISOString();

      // Check 1: Has at least 1 visit today (marcada, confirmada, realizada, pendente)
      const { count: visitasCount } = await supabase
        .from("visitas")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user.id)
        .gte("data", today)
        .in("status", ["confirmada", "realizada", "marcada", "pendente"]);

      if (!visitasCount || visitasCount === 0) {
        setNoturnaEligible(false);
        setNoturnaReason("Pra participar da noturna, marque ou realize pelo menos 1 visita hoje.");
        setCheckingNoturna(false);
        return;
      }

      // Check 2: No stalled leads (not updated in 3h, excluding terminal stages)
      const { count: stalledCount } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user.id)
        .lt("updated_at", threeHoursAgo)
        .not("etapa", "in", '("Descartado","Vendido","Distrato")');

      if (stalledCount && stalledCount > 0) {
        setNoturnaEligible(false);
        setNoturnaReason(`Você tem ${stalledCount} lead(s) sem atualização há mais de 3h. Atualize seu pipeline antes de se credenciar.`);
        setCheckingNoturna(false);
        return;
      }

      setNoturnaEligible(true);
      setNoturnaReason("");
    } catch (error) {
      console.error("Error checking noturna eligibility:", error);
      setNoturnaEligible(true); // Fallback to allow if check fails
    } finally {
      setCheckingNoturna(false);
    }
  }, [user?.id]);

  // Trigger eligibility check when noturna is selected
  useEffect(() => {
    if (selectedJanela === "noturna") {
      checkNoturnaEligibility();
    } else {
      setNoturnaEligible(null);
      setNoturnaReason("");
    }
  }, [selectedJanela, checkNoturnaEligibility]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Already credenciado and approved
  if (meuCredenciamento?.status === "aprovado") {
    const minhasFila = fila.filter(f => f.corretor_id === user?.id);
    const leadsHoje = minhasFila.reduce((sum, f) => sum + (f.leads_recebidos || 0), 0);
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">🎯 Roleta de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{windowInfo.emoji} {windowInfo.descricao}</p>
        </div>
        <Card className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Você está na roleta!</h2>
            <div className="space-y-2 text-sm">
              {minhasFila.map(f => {
                const seg = segmentos.find(s => s.id === f.segmento_id);
                return (
                  <div key={f.id} className="flex items-center justify-between p-2 bg-background rounded-md border">
                    <span>{seg?.nome || "Segmento"}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Posição {f.posicao}</Badge>
                      <span className="text-xs text-muted-foreground">{f.leads_recebidos || 0} leads</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">Leads recebidos hoje: <strong>{leadsHoje}</strong></p>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => sairDaRoleta(meuCredenciamento.id)} disabled={submitting}>
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
          <p className="text-sm text-muted-foreground mt-1">{windowInfo.emoji} {windowInfo.descricao}</p>
        </div>
        <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">⏳</div>
            <h2 className="text-lg font-bold text-amber-700 dark:text-amber-400">Aguardando aprovação do CEO...</h2>
            <p className="text-sm text-muted-foreground">Seu credenciamento foi enviado. Assim que aprovado, você entrará automaticamente na fila.</p>
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
          <p className="text-sm text-muted-foreground mt-1">{windowInfo.emoji} {windowInfo.descricao}</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">🔒</div>
            <h2 className="text-lg font-bold">Credenciamento fechado</h2>
            <p className="text-sm text-muted-foreground">O credenciamento abre nos seguintes horários:</p>
            <div className="space-y-1 text-sm text-left max-w-xs mx-auto">
              <p>🌅 <strong>Manhã</strong>: Aberto 24h</p>
              <p>☀️ <strong>Tarde</strong>: 12:00 – 13:30</p>
              <p>🌙 <strong>Noturna</strong>: 18:00 – 23:59</p>
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

  // Credenciamento form
  const handleCredenciar = () => {
    if (!seg1) {
      return;
    }
    credenciar(selectedJanela, seg1, seg2 || null);
  };

  const seg2Options = segmentos.filter(s => s.id !== seg1);

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">🎯 Roleta de Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">{windowInfo.emoji} {windowInfo.descricao}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <CountdownTimer target={windowInfo.proximaTransicao} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 Quero participar da roleta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Janela */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Janela</label>
            <Select value={selectedJanela} onValueChange={setSelectedJanela}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a janela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">🌅 Manhã (09:30–13:30)</SelectItem>
                <SelectItem value="tarde">🌞 Tarde (13:30–18:00)</SelectItem>
                <SelectItem value="noturna">🌙 Noturna (18:00–23:30)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Segmento 1 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Segmento 1 <span className="text-destructive">*</span></label>
            <Select value={seg1} onValueChange={(v) => { setSeg1(v); if (seg2 === v) setSeg2(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o segmento principal" />
              </SelectTrigger>
              <SelectContent>
                {segmentos.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome} {s.campanhas.length > 0 && `(${s.campanhas.join(", ")})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Segmento 2 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Segmento 2 <span className="text-muted-foreground text-xs">(opcional)</span></label>
            <Select value={seg2} onValueChange={setSeg2}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um segundo segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {seg2Options.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome} {s.campanhas.length > 0 && `(${s.campanhas.join(", ")})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Você está elegível para a janela noturna!</p>
                </div>
              )}
              {noturnaEligible === null && !checkingNoturna && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Para a janela noturna, é necessário ter marcado ou realizado pelo menos 1 visita hoje e não possuir leads sem atualização há mais de 3h.
                  </p>
                </div>
              )}
            </>
          )}

          <Button
            className="w-full"
            onClick={handleCredenciar}
            disabled={!seg1 || submitting || (selectedJanela === "noturna" && (checkingNoturna || noturnaEligible === false))}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Users className="h-4 w-4 mr-1" />}
            📋 Me credenciar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───
export default function RoletaLeads() {
  const { isAdmin } = useUserRole();

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {isAdmin ? <CeoView /> : <CorretorView />}
    </div>
  );
}
