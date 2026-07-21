import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoleta, getCurrentWindowInfo } from "@/hooks/useRoleta";
import { useEmpreendimentosCanonicos } from "@/hooks/useFocoCorretores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2,
  UserCheck,
  UserX,
  Building2,
  CheckCircle2,
  XCircle,
  Rocket,
  AlertTriangle,
} from "lucide-react";

type RoletaApi = ReturnType<typeof useRoleta>;

interface Props {
  roleta: RoletaApi;
}

export function RoletaOperacaoTab({ roleta }: Props) {
  const {
    segmentos,
    credenciamentos,
    fila,
    submitting,
    pendentesCount,
    leadsAcumulados,
    aprovarCredenciamento,
    recusarCredenciamento,
    aprovarTodos,
    removerDaFila,
  } = roleta;

  const windowInfo = getCurrentWindowInfo();
  const pendentes = credenciamentos.filter((c) => c.status === "pendente");

  const { data: empreendimentos = [] } = useEmpreendimentosCanonicos({ includeInactive: false });

  // Alocações dos corretores atualmente na fila (por auth_user_id)
  const authIds = useMemo(
    () => Array.from(new Set(fila.map((f: any) => f.auth_user_id).filter(Boolean))) as string[],
    [fila]
  );

  const { data: alocacoes = {} } = useQuery({
    queryKey: ["roleta-op-alocacoes", authIds.sort().join(",")],
    enabled: authIds.length > 0,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data } = await supabase
        .from("corretor_alocacao")
        .select("user_id, empreendimentos")
        .in("user_id", authIds);
      const map: Record<string, string[]> = {};
      for (const r of data || []) map[r.user_id as string] = (r.empreendimentos as string[]) || [];
      return map;
    },
    staleTime: 30_000,
  });

  // Agrupa fila por empreendimento ativo. Preserva ordem original (posicao).
  const grupos = useMemo(() => {
    // dedup fila por corretor (mesmo corretor pode aparecer em 2 segmentos)
    const seen = new Set<string>();
    const filaUnica = fila.filter((f: any) => {
      const k = f.auth_user_id || f.corretor_id;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const porEmp: Record<string, typeof filaUnica> = {};
    const semAlocacao: typeof filaUnica = [];

    for (const f of filaUnica) {
      const auth = (f as any).auth_user_id as string | null;
      const empIds = (auth && alocacoes[auth]) || [];
      const empAtivos = empIds.filter((id) => empreendimentos.some((e) => e.id === id));
      if (empAtivos.length === 0) {
        semAlocacao.push(f);
        continue;
      }
      for (const eid of empAtivos) {
        if (!porEmp[eid]) porEmp[eid] = [] as any;
        (porEmp[eid] as any).push(f);
      }
    }
    return { porEmp, semAlocacao };
  }, [fila, alocacoes, empreendimentos]);

  const segNome = (id: string | null | undefined) =>
    id ? segmentos.find((s) => s.id === id)?.nome || null : null;

  return (
    <div className="space-y-6">
      {/* Leads acumulados (madrugada) */}
      {windowInfo.janela === "madrugada" && leadsAcumulados > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold text-lg">{leadsAcumulados} leads acumulados</p>
              <p className="text-sm text-muted-foreground">
                Aguardando distribuição na roleta da manhã
              </p>
            </div>
            <Button>
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
                <Badge variant="destructive" className="text-xs">
                  {pendentesCount}
                </Badge>
              )}
            </CardTitle>
            {pendentes.length > 1 && (
              <Button size="sm" onClick={aprovarTodos} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                )}
                Aprovar todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum credenciamento pendente
            </p>
          ) : (
            <div className="space-y-2">
              {pendentes.map((c) => {
                const seg1 = segmentos.find((s) => s.id === c.segmento_1_id);
                const seg2 = segmentos.find((s) => s.id === c.segmento_2_id);
                return (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(c.corretor_nome || "C").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{c.corretor_nome}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {c.janela}
                          </Badge>
                          {seg1 && (
                            <Badge className="text-[10px] bg-muted text-muted-foreground border-0">
                              {seg1.nome}
                            </Badge>
                          )}
                          {seg2 && (
                            <Badge className="text-[10px] bg-muted text-muted-foreground border-0">
                              {seg2.nome}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => aprovarCredenciamento(c.id)}
                        disabled={submitting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recusarCredenciamento(c.id)}
                        disabled={submitting}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
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

      {/* Roleta Ativa por Empreendimento */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Roleta Ativa por Empreendimento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {empreendimentos.map((emp) => {
            const empFila = grupos.porEmp[emp.id] || [];
            return (
              <Card key={emp.id} className="border-l-[3px] border-l-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-bold">{emp.nome}</CardTitle>
                    {emp.segmento_nome && (
                      <Badge variant="outline" className="text-[10px]">
                        {emp.segmento_nome}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {empFila.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Nenhum corretor na fila
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {empFila.map((f: any, idx: number) => {
                        // segmentos do corretor derivados dos empreendimentos alocados dele
                        const auth = f.auth_user_id as string | null;
                        const empIds = (auth && alocacoes[auth]) || [];
                        const segsDoCorretor = Array.from(
                          new Set(
                            empIds
                              .map((eid) => empreendimentos.find((e) => e.id === eid)?.segmento_nome)
                              .filter(Boolean) as string[]
                          )
                        );
                        return (
                          <div
                            key={`${emp.id}-${f.id}`}
                            className={`flex items-center justify-between p-2 rounded-md text-sm ${
                              idx === 0
                                ? "bg-primary/10 border border-primary/30"
                                : "bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`font-bold text-xs w-5 text-center ${
                                  idx === 0 ? "text-primary" : "text-muted-foreground"
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">
                                  {(f.corretor_nome || "C").substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium truncate">{f.corretor_nome}</span>
                              {idx === 0 && (
                                <Badge className="text-[10px] bg-primary text-primary-foreground shrink-0">
                                  Próximo
                                </Badge>
                              )}
                              {segsDoCorretor.length > 0 && (
                                <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                                  · {segsDoCorretor.join(" · ")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex flex-col items-end leading-tight">
                                <span className="text-xs text-foreground">
                                  <span className="font-semibold tabular-nums">{f.distribuidos_roleta}</span> distribuídos
                                  {" · "}
                                  <span className="font-semibold tabular-nums">{f.aceitos_roleta}</span> aceitos
                                </span>
                                {f.fora_roleta > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {f.fora_roleta} fora da roleta
                                  </span>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive/60 hover:text-destructive"
                                onClick={() => removerDaFila(f.id)}
                              >
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Fallback: corretores na fila sem empreendimento ativo alocado */}
          {grupos.semAlocacao.length > 0 && (
            <Card className="border-l-[3px] border-l-amber-500 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Sem empreendimento ativo alocado
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Estes corretores estão na fila, mas não têm empreendimento ativo. Ajuste em Foco Corretores.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {grupos.semAlocacao.map((f: any, idx: number) => (
                    <div
                      key={`sem-${f.id}`}
                      className="flex items-center justify-between p-2 rounded-md text-sm bg-amber-50 dark:bg-amber-950/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs w-5 text-center text-muted-foreground">
                          {idx + 1}
                        </span>
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {(f.corretor_nome || "C").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate">{f.corretor_nome}</span>
                        {segNome(f.segmento_id) && (
                          <Badge variant="outline" className="text-[10px]">
                            {segNome(f.segmento_id)}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive/60 hover:text-destructive"
                        onClick={() => removerDaFila(f.id)}
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
