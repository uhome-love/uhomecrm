import { useState } from "react";
import { useEscalaDiaria } from "@/hooks/useEscalaDiaria";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  CalendarDays,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  WifiOff,
  Coffee,
  MapPin,
  RotateCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_ICON: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  na_empresa: { icon: Building2, color: "text-emerald-600", label: "Na empresa" },
  em_pausa: { icon: Coffee, color: "text-amber-600", label: "Em pausa" },
  em_visita: { icon: MapPin, color: "text-blue-600", label: "Em visita" },
  offline: { icon: WifiOff, color: "text-muted-foreground", label: "Offline" },
};

const APPROVAL_BADGE: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", className: "bg-amber-500/15 text-amber-600 border-amber-500/20", icon: Clock },
  aprovado: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", className: "bg-destructive/15 text-destructive border-destructive/20", icon: XCircle },
};

export default function EscalaDiariaPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { isGestor, isAdmin } = useUserRole();
  const escala = useEscalaDiaria(selectedDate);
  const isManager = isGestor || isAdmin;

  if (escala.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const dateFormatted = format(new Date(selectedDate + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Escala Diária & Roleta
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{dateFormatted}</p>
        </div>
        <div className="flex items-center gap-2">
          {escala.totalPendentes > 0 && isManager && (
            <Button
              size="sm"
              onClick={() => escala.aprovarTodos()}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Aprovar Todos ({escala.totalPendentes})
            </Button>
          )}
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-[160px] h-9"
          />
          <Button variant="outline" size="sm" onClick={() => escala.reload()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pending Approval Alert */}
      {escala.totalPendentes > 0 && isManager && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{escala.totalPendentes}</strong> corretor(es) aguardando aprovação para a escala de hoje.
          </p>
        </div>
      )}

      {/* Segments Grid */}
      <div className="grid gap-5">
        {escala.segmentos.map(segmento => {
          const campanhasDoSeg = escala.getCampanhasDoSegmento(segmento.id);
          const aprovados = escala.getCorretoresNoSegmento(segmento.id);
          const pendentes = escala.getPendentesNoSegmento(segmento.id);
          const hasNoAprovados = aprovados.length === 0;

          return (
            <Card
              key={segmento.id}
              className={`overflow-hidden ${hasNoAprovados ? "border-amber-500/30" : ""}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full shadow-sm"
                      style={{ backgroundColor: segmento.cor || "#3b82f6" }}
                    />
                    <div>
                      <CardTitle className="text-lg">{segmento.nome}</CardTitle>
                      {segmento.empreendimentos && segmento.empreendimentos.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {segmento.empreendimentos.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      {aprovados.length} ativo{aprovados.length !== 1 ? "s" : ""}
                    </Badge>
                    {pendentes.length > 0 && (
                      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Alert: no one scheduled */}
                {hasNoAprovados && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-amber-500/10">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      Nenhum corretor escalado — leads deste segmento ficarão sem atendimento!
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                {escala.teamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum corretor cadastrado no time.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {escala.teamMembers
                      .filter(tm => tm.user_id)
                      .map(tm => {
                        const isEscalado = escala.isCorretorEscalado(segmento.id, tm.user_id!);
                        const entryStatus = escala.getEntryStatus(segmento.id, tm.user_id!);
                        const disp = escala.getDisponibilidade(tm.user_id!);
                        const statusInfo = STATUS_ICON[disp?.status || "offline"] || STATUS_ICON.offline;
                        const StatusIcon = statusInfo.icon;
                        const approvalInfo = entryStatus ? APPROVAL_BADGE[entryStatus] : null;
                        const leadsHoje = disp?.leads_recebidos_turno || 0;
                        const profileName = escala.profiles[tm.user_id!] || tm.nome;

                        return (
                          <div
                            key={tm.id}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                              entryStatus === "aprovado"
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : entryStatus === "pendente"
                                ? "border-amber-500/30 bg-amber-500/5"
                                : isEscalado
                                ? "border-destructive/30 bg-destructive/5"
                                : "border-border bg-card hover:bg-muted/50"
                            }`}
                          >
                            {/* Checkbox for managers to toggle */}
                            {isManager && (
                              <Checkbox
                                checked={isEscalado}
                                onCheckedChange={() => escala.toggleCorretor(segmento.id, tm.user_id!)}
                                disabled={escala.saving}
                              />
                            )}

                            {/* Status icon */}
                            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${
                              disp?.na_roleta ? "bg-emerald-500/15" : "bg-muted"
                            }`}>
                              <StatusIcon className={`h-3.5 w-3.5 ${statusInfo.color}`} />
                            </div>

                            {/* Name & info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">{profileName}</p>
                                {disp?.na_roleta && (
                                  <RotateCw className="h-3 w-3 text-emerald-600 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-medium ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                                {leadsHoje > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    · {leadsHoje} leads hoje
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Approval badge + actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {approvalInfo && (
                                <Badge className={`${approvalInfo.className} text-[9px] px-1.5 gap-0.5`}>
                                  <approvalInfo.icon className="h-2.5 w-2.5" />
                                  {approvalInfo.label}
                                </Badge>
                              )}
                              {isManager && entryStatus === "pendente" && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-emerald-600 hover:bg-emerald-500/10"
                                    onClick={() => {
                                      const entry = escala.escala.find(
                                        e => e.segmento_id === segmento.id && e.corretor_id === tm.user_id
                                      );
                                      if (entry) escala.aprovar(entry.id, "aprovado");
                                    }}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      const entry = escala.escala.find(
                                        e => e.segmento_id === segmento.id && e.corretor_id === tm.user_id
                                      );
                                      if (entry) escala.aprovar(entry.id, "rejeitado");
                                    }}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
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
      </div>

      {escala.segmentos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum segmento configurado.</p>
        </div>
      )}
    </div>
  );
}
