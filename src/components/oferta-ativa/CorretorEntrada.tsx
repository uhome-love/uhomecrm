/**
 * CorretorEntrada — entrada rápida do corretor na Oferta Ativa (estilo Mutirão ao vivo).
 *
 * Fluxo: campanha em destaque → onboarding (meta + campanha + script) → discador.
 * O catálogo completo fica escondido atrás de "Ver todas as listas".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useSidebar } from "@/components/ui/sidebar";
import { Phone, Users, Clock, LayoutGrid, ScrollText, Rocket, Radio } from "lucide-react";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useCampanhasDisponiveis } from "@/hooks/useCampanhasDisponiveis";
import type { OALista } from "@/hooks/useOfertaAtiva";
import DialingModeWithScript from "./DialingModeWithScript";
import OnboardingOfertaAtivaModal from "./OnboardingOfertaAtivaModal";
import CorretorListSelection from "./CorretorListSelection";

function diasRestantes(expiraEm?: string | null) {
  if (!expiraEm) return null;
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

const ONBOARD_KEY = "oa-entrada-onboarded";

export default function CorretorEntrada() {
  const { campanhas, statsMap, isLoading } = useCampanhasDisponiveis();
  const { progress } = useCorretorProgress();
  const [selectedLista, setSelectedLista] = useState<OALista | null>(null);
  const [showTodas, setShowTodas] = useState(false);
  const [onboardingFor, setOnboardingFor] = useState<OALista | null>(null);
  const { setOpen, open } = useSidebar();
  const prevOpenRef = useRef(open);

  const destaque = campanhas[0] ?? null;
  const outras = campanhas.slice(1);

  // Onboarding automático 1x por dia, quando há campanha disponível
  useEffect(() => {
    if (!destaque || selectedLista || showTodas) return;
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (localStorage.getItem(ONBOARD_KEY) === hoje) return;
    localStorage.setItem(ONBOARD_KEY, hoje);
    setOnboardingFor(destaque);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destaque?.id]);

  // Modo arena: colapsa o menu lateral enquanto liga
  useEffect(() => {
    if (selectedLista) {
      prevOpenRef.current = open;
      document.body.classList.add("arena-mode");
      setOpen(false);
    } else {
      document.body.classList.remove("arena-mode");
      setOpen(prevOpenRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLista]);

  const iniciar = useCallback((lista: OALista) => {
    setOnboardingFor(null);
    setSelectedLista(lista);
  }, []);

  if (selectedLista) {
    return <DialingModeWithScript lista={selectedLista} onBack={() => setSelectedLista(null)} />;
  }

  if (showTodas) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowTodas(false)}>
          ← Voltar para a entrada rápida
        </Button>
        <CorretorListSelection />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <OnboardingOfertaAtivaModal
        open={!!onboardingFor}
        campanha={onboardingFor}
        stats={onboardingFor ? statsMap[onboardingFor.id] : undefined}
        onStart={() => onboardingFor && iniciar(onboardingFor)}
        onClose={() => setOnboardingFor(null)}
      />

      {/* Faixa de progresso do dia */}
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <MetaMini label="🔥 Ligações" atual={progress.tentativas} meta={progress.metaLigacoes} pct={progress.progLigacoes} />
        <MetaMini label="✅ Aproveitados" atual={progress.aproveitados} meta={progress.metaAproveitados} pct={progress.progAproveitados} />
        <MetaMini label="📅 Visitas" atual={progress.visitasMarcadas} meta={progress.metaVisitas} pct={progress.progVisitas} />
      </div>

      {/* Campanha em destaque */}
      {destaque ? (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                <Rocket className="h-3.5 w-3.5" /> Campanha do dia
              </p>
              <h2 className="mt-1 truncate text-xl font-bold text-foreground">
                {destaque.empreendimento || destaque.nome}
              </h2>
              {destaque.observacao && (
                <p className="mt-1 text-sm italic text-muted-foreground">🎯 {destaque.observacao}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Users className="h-3 w-3" /> {statsMap[destaque.id]?.naFila ?? 0} leads na fila
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  {statsMap[destaque.id]?.aproveitados ?? 0} aproveitados
                </Badge>
                {diasRestantes(destaque.expira_em) !== null && (
                  <Badge variant="outline" className="gap-1 text-[11px]">
                    <Clock className="h-3 w-3" />
                    {diasRestantes(destaque.expira_em) === 0
                      ? "expira hoje"
                      : `expira em ${diasRestantes(destaque.expira_em)}d`}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button size="lg" className="gap-2" onClick={() => iniciar(destaque)}>
                <Phone className="h-4 w-4" /> Começar a ligar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOnboardingFor(destaque)}>
                <ScrollText className="h-3.5 w-3.5" /> Ver script e meta
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Radio className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">Nenhuma campanha liberada para você agora</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que a liderança liberar uma campanha de Oferta Ativa, ela aparece aqui.
          </p>
        </div>
      )}

      {/* Outras campanhas liberadas */}
      {outras.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Outras campanhas liberadas
          </p>
          {outras.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{c.empreendimento || c.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {statsMap[c.id]?.naFila ?? 0} na fila · {statsMap[c.id]?.aproveitados ?? 0} aproveitados
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => iniciar(c)}>
                <Phone className="h-3.5 w-3.5" /> Ligar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setShowTodas(true)}>
        <LayoutGrid className="h-3.5 w-3.5" /> Ver todas as listas
      </Button>
    </div>
  );
}

function MetaMini({ label, atual, meta, pct }: { label: string; atual: number; meta: number; pct: number }) {
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
