import { useState } from "react";
import { useEscalaDiaria } from "@/hooks/useEscalaDiaria";
import { usePipeline } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CalendarDays, Users, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EscalaDiariaPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { segmentos, loading: segLoading } = usePipeline();
  const escala = useEscalaDiaria(selectedDate);

  const isLoading = segLoading || escala.loading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const dateFormatted = format(new Date(selectedDate + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Escala Diária
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{dateFormatted}</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Grid: one card per segmento */}
      <div className="grid gap-4">
        {segmentos.map(segmento => {
          const corretoresEscalados = escala.getCorretoresNoSegmento(segmento.id);
          return (
            <div
              key={segmento.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: segmento.cor }}
                  />
                  <h2 className="text-lg font-display font-bold text-foreground">
                    {segmento.nome}
                  </h2>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {corretoresEscalados.length} escalado{corretoresEscalados.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* List all team members with checkboxes */}
              {escala.teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum corretor cadastrado no time.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {escala.teamMembers
                    .filter(tm => tm.user_id)
                    .map(tm => {
                      const isEscalado = escala.isCorretorEscalado(segmento.id, tm.user_id!);
                      return (
                        <label
                          key={tm.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all text-sm ${
                            isEscalado
                              ? "border-primary/40 bg-primary/5 font-medium"
                              : "border-border bg-background hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={isEscalado}
                            onCheckedChange={() => escala.toggleCorretor(segmento.id, tm.user_id!)}
                          />
                          <span className="truncate">{tm.nome}</span>
                          {tm.equipe && (
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                              {tm.equipe}
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {segmentos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum segmento configurado. Configure os segmentos na Administração.</p>
        </div>
      )}
    </div>
  );
}
