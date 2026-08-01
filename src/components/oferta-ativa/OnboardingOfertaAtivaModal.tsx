/**
 * OnboardingOfertaAtivaModal — 1 tela de entrada rápida na Oferta Ativa.
 * Blocos: meta do dia · campanha disponível · script da ligação → "Começar a ligar".
 * Espelha o padrão do Mutirão ao vivo (OnboardingModal).
 */
import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Phone, Target, Users, Clock, ScrollText } from "lucide-react";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import ScriptPanel from "@/components/oferta-ativa/ScriptPanel";
import type { OALista } from "@/hooks/useOfertaAtiva";
import type { ListaStats } from "@/hooks/useCampanhasDisponiveis";

interface Props {
  open: boolean;
  campanha: OALista | null;
  stats?: ListaStats;
  onStart: () => void;
  onClose: () => void;
}

function diasRestantes(expiraEm?: string | null) {
  if (!expiraEm) return null;
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export default function OnboardingOfertaAtivaModal({ open, campanha, stats, onStart, onClose }: Props) {
  const { progress } = useCorretorProgress();
  const dias = useMemo(() => diasRestantes(campanha?.expira_em), [campanha?.expira_em]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Pronto para ligar?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. Meta do dia */}
          <section className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Meta do dia
            </p>
            <div className="grid grid-cols-3 gap-3">
              <MetaItem label="Ligações" atual={progress.tentativas} meta={progress.metaLigacoes} pct={progress.progLigacoes} />
              <MetaItem label="Aproveitados" atual={progress.aproveitados} meta={progress.metaAproveitados} pct={progress.progAproveitados} />
              <MetaItem label="Visitas" atual={progress.visitasMarcadas} meta={progress.metaVisitas} pct={progress.progVisitas} />
            </div>
          </section>

          {/* 2. Campanha disponível */}
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campanha disponível
            </p>
            {campanha ? (
              <>
                <p className="text-sm font-bold text-foreground">{campanha.empreendimento || campanha.nome}</p>
                {campanha.campanha && <p className="text-xs text-muted-foreground">{campanha.campanha}</p>}
                {campanha.observacao && (
                  <p className="mt-1 text-xs italic text-foreground/80">🎯 {campanha.observacao}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <Users className="h-3 w-3" /> {stats?.naFila ?? 0} na fila
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    {stats?.aproveitados ?? 0} aproveitados
                  </Badge>
                  {dias !== null && (
                    <Badge variant="outline" className="gap-1 text-[11px]">
                      <Clock className="h-3 w-3" /> {dias === 0 ? "expira hoje" : `expira em ${dias}d`}
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma campanha liberada para você agora.</p>
            )}
          </section>

          {/* 3. Script da ligação */}
          <section className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ScrollText className="h-3.5 w-3.5" /> Script da ligação
            </p>
            <ScriptPanel
              empreendimento={campanha?.empreendimento || ""}
              compact
              hideCta
              scriptFilter="ligacao"
            />
          </section>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Pular
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!campanha} onClick={onStart}>
            <Phone className="h-4 w-4" /> Começar a ligar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaItem({ label, atual, meta, pct }: { label: string; atual: number; meta: number; pct: number }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-bold text-foreground">
        {atual}<span className="text-muted-foreground">/{meta}</span>
      </p>
      <Progress value={pct} className="mt-1 h-1.5" />
    </div>
  );
}
