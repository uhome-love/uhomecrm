import { useRoleta, getCurrentWindowInfo } from "@/hooks/useRoleta";
import { compareRoletaSegmentos } from "@/hooks/useRoletaSegmentos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2,
  UserCheck,
  UserX,
  Target,
  CheckCircle2,
  XCircle,
  Rocket,
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
  const segmentosOrdenados = [...segmentos].sort(compareRoletaSegmentos);

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
                            <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                              {seg1.nome}
                            </Badge>
                          )}
                          {seg2 && (
                            <Badge className="text-[10px] bg-accent text-accent-foreground border-0">
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

      {/* Roleta Ativa por Segmento */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target className="h-5 w-5" /> Roleta Ativa por Segmento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {segmentosOrdenados.map((seg) => {
            const segFila = fila.filter((f) => f.segmento_id === seg.id);
            return (
              <Card key={seg.id} className="border-l-[3px] border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-primary">{seg.nome}</CardTitle>
                  {seg.campanhas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {seg.campanhas.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {segFila.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Nenhum corretor na fila
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {segFila.map((f, idx) => (
                        <div
                          key={f.id}
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
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
