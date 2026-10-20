import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Phone, CalendarCheck, DollarSign, Users, BarChart3, Building2, Target, Megaphone, UserCheck, Activity, Eye } from "lucide-react";
import { StateWrapper } from "@/components/ui/StateWrapper";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { MiniKpi, SectionLabel, HBar, formatBRLCompact, ORIGIN_COLORS, FALLBACK_COLORS } from "./DesktopPrimitives";

export default function DesktopApprovals({ model }: { model: CeoDashboardController }) {
  const { reloadRoleta, errors, localPendentes, aprovar, recusar, aprovarTodos } = model;
  return (<>
{/* ═══ APROVAÇÕES PENDENTES ═══ */}
      {errors.roleta && (
        <Card className="border-danger/40 bg-[#f7f7fb] dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aprovações Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <StateWrapper
              error={errors.roleta}
              onRetry={() => { reloadRoleta(); }}
              errorTitle="Falha ao carregar a fila de credenciamento"
              errorDescription="Pode haver credenciamentos pendentes não exibidos."
            />
          </CardContent>
        </Card>
      )}
      {!errors.roleta && localPendentes.length > 0 && (
        <Card className="border-primary/40 bg-[#f7f7fb] dark:bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Aprovações Pendentes
                <Badge className="bg-primary text-white text-[10px]">{localPendentes.length}</Badge>
              </CardTitle>
              {localPendentes.length > 1 && (
                <Button size="sm" onClick={aprovarTodos} className="bg-success hover:bg-[#059669] text-white text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar todos
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {localPendentes.map((c) => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-white dark:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {c.avatar && <AvatarImage src={c.avatar} />}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(c.corretor_nome || "C").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{c.corretor_nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{c.janela}</Badge>
                        {(c.empreendimentos_alocados && c.empreendimentos_alocados.length > 0) ? (
                          c.empreendimentos_alocados.map((nome: string) => (
                            <Badge key={nome} className="text-[10px] bg-primary/10 text-primary border-0">{nome}</Badge>
                          ))
                        ) : (
                          <Badge className="text-[10px] bg-warning/10 text-warning border-0">Sem alocação</Badge>
                        )}
                      </div>

                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => aprovar(c.id)} className="bg-success hover:bg-[#059669] text-white text-xs flex-1 sm:flex-none">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => recusar(c.id)} className="text-danger border-danger/30 hover:bg-danger/5 text-xs flex-1 sm:flex-none">
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Presença da Roleta migrada para a página /roleta/presenca (menu Presença) */}
  </>);
}
