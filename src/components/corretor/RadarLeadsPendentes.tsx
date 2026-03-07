import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Phone, MessageCircle, ArrowRight, AlertTriangle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LeadRadar } from "@/hooks/useMissoesLeads";

interface Props {
  leads: LeadRadar[];
  loading: boolean;
  onOpenPipeline?: () => void;
}

function tempColor(temp: string) {
  if (temp === "quente") return "text-red-500 bg-red-500/10";
  if (temp === "morno") return "text-amber-500 bg-amber-500/10";
  return "text-blue-400 bg-blue-400/10";
}

function tempEmoji(temp: string) {
  if (temp === "quente") return "🔥";
  if (temp === "morno") return "🟡";
  return "🧊";
}

export default function RadarLeadsPendentes({ leads, loading, onOpenPipeline }: Props) {
  const [idx, setIdx] = useState(0);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Carregando radar...
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-6 text-center space-y-2">
          <div className="text-3xl">🎯</div>
          <p className="text-sm font-bold text-foreground">Nenhum lead pendente!</p>
          <p className="text-xs text-muted-foreground">Todos os seus leads estão em dia.</p>
        </CardContent>
      </Card>
    );
  }

  const lead = leads[Math.min(idx, leads.length - 1)];
  const total = leads.length;
  const urgentes = leads.filter(l => l.diasSemContato >= 7).length;

  const handleWhatsApp = () => {
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  const handleCall = () => {
    if (lead.telefone) {
      window.open(`tel:${lead.telefone}`, "_self");
    }
  };

  return (
    <Card className="border-primary/15 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Radar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Radar de Oportunidades</h3>
              <p className="text-[10px] text-muted-foreground">{total} leads esperando contato</p>
            </div>
          </div>
          {urgentes > 0 && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" /> {urgentes} urgentes
            </Badge>
          )}
        </div>

        {/* Lead card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={lead.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-3 rounded-xl border border-border/60 bg-card space-y-2.5"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{lead.nome}</p>
                <p className="text-xs text-muted-foreground truncate">{lead.empreendimento || "Sem empreendimento"}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm">{tempEmoji(lead.temperatura)}</span>
                <Badge variant="outline" className={`text-[9px] ${tempColor(lead.temperatura)}`}>
                  {lead.temperatura}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lead.diasSemContato === 0
                  ? "Hoje"
                  : lead.diasSemContato === 1
                  ? "1 dia"
                  : `${lead.diasSemContato} dias`} sem contato
              </span>
              <Badge variant="secondary" className="text-[9px]">
                {lead.stage_nome}
              </Badge>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 h-10 rounded-xl"
                onClick={handleCall}
                disabled={!lead.telefone}
              >
                <Phone className="h-4 w-4" /> Ligar
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={handleWhatsApp}
                disabled={!lead.telefone}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              {onOpenPipeline && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 w-10 rounded-xl shrink-0 p-0"
                  onClick={onOpenPipeline}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {total > 1 && (
          <div className="flex items-center justify-between px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIdx(Math.max(0, idx - 1))}
              disabled={idx === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              {Math.min(idx + 1, total)} de {total}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIdx(Math.min(total - 1, idx + 1))}
              disabled={idx >= total - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
