import { AlertCircle, Phone, CalendarCheck, MessageCircle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { FollowUpLead, VisitaHoje } from "@/hooks/useCorretorHomeData";

interface Props {
  followUps: FollowUpLead[];
  visitasHoje: VisitaHoje[];
  newLeadsCount: number;
  onStartCall: () => void;
}

export default function AcoesAgora({ followUps, visitasHoje, newLeadsCount, onStartCall }: Props) {
  const navigate = useNavigate();
  const totalActions = followUps.length + visitasHoje.length + newLeadsCount;

  if (totalActions === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 text-center">
          <p className="text-sm font-semibold text-emerald-600">✅ Sem ações pendentes agora</p>
          <p className="text-xs text-muted-foreground mt-0.5">Inicie a discagem para prospectar novos leads</p>
        </CardContent>
      </Card>
    );
  }

  const nextVisita = visitasHoje.find(v => v.status === "marcada" || v.status === "confirmada");

  return (
    <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
              <AlertCircle className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">⚡ Ações Agora</p>
              <p className="text-[10px] text-muted-foreground">{totalActions} {totalActions === 1 ? "ação pendente" : "ações pendentes"}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {newLeadsCount > 0 && (
            <div className="flex items-center justify-between bg-background/80 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-foreground">{newLeadsCount} lead{newLeadsCount > 1 ? "s" : ""} novo{newLeadsCount > 1 ? "s" : ""} para responder</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-primary" onClick={() => navigate("/pipeline-leads")}>
                Ver <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {nextVisita && (
            <div className="flex items-center justify-between bg-background/80 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-foreground">
                  Visita {nextVisita.hora_visita ? `às ${nextVisita.hora_visita}` : "hoje"} — {nextVisita.nome_cliente}
                </span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-amber-600" onClick={() => navigate("/agenda-visitas")}>
                Agenda <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {followUps.length > 0 && (
            <div className="flex items-center justify-between bg-background/80 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-foreground">{followUps.length} follow-up{followUps.length > 1 ? "s" : ""} pendente{followUps.length > 1 ? "s" : ""}</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-emerald-600" onClick={() => navigate("/pipeline-leads")}>
                Ver <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* CTA Começar Discagem */}
        <Button
          size="lg"
          className="w-full h-12 gap-2 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_16px_hsl(152_60%_42%/0.25)]"
          onClick={onStartCall}
        >
          <Phone className="h-5 w-5" /> Começar Discagem <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
