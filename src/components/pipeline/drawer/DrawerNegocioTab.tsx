import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, ChevronRight, Check, ExternalLink, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
import { type Negocio, NEGOCIOS_FASES } from "@/hooks/useNegocios";
import { useNegocioActions } from "@/hooks/useNegocioActions";
import FaseTransitionModal from "../FaseTransitionModal";

const NegocioDetailModal = lazy(() => import("../NegocioDetailModal"));
const VendaCelebration = lazy(() => import("../VendaCelebration"));

interface NegocioFull extends Negocio {
  unidade?: string | null;
  data_assinatura?: string | null;
  proposta_situacao?: string | null;
  proposta_valor?: number | null;
  negociacao_situacao?: string | null;
  negociacao_pendencia?: string | null;
  documentacao_situacao?: string | null;
  motivo_queda?: string | null;
}

interface Props {
  negocioId: string | null;
  corretorNome?: string;
}

const FASE_ORDER = NEGOCIOS_FASES.map((f) => f.key);

export default function DrawerNegocioTab({ negocioId, corretorNome }: Props) {
  const [negocio, setNegocio] = useState<NegocioFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    if (!negocioId) {
      setNegocio(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("negocios")
      .select("*")
      .eq("id", negocioId)
      .maybeSingle();
    setNegocio((data as NegocioFull) || null);
    setLoading(false);
  }, [negocioId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const {
    transitionTarget,
    setTransitionTarget,
    celebrationData,
    setCelebrationData,
    requestMoveFase,
    handleTransitionConfirm,
  } = useNegocioActions(load);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
        <Briefcase className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhum negócio vinculado a este lead.</p>
      </div>
    );
  }

  const faseInfo = NEGOCIOS_FASES.find((f) => f.key === negocio.fase);
  const currentIdx = FASE_ORDER.indexOf(negocio.fase);
  const isPerdido = negocio.status === "perdido" || negocio.fase === "perdido";
  const vgv = negocio.vgv_final || negocio.vgv_estimado || 0;

  return (
    <div className="px-3 md:px-5 py-4 space-y-4">
      {/* Header do negócio */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
              <Briefcase className="h-3.5 w-3.5" /> Negócio
            </div>
            <p className="text-sm font-semibold text-foreground truncate mt-0.5">
              {negocio.empreendimento || "Sem empreendimento"}
              {negocio.unidade ? ` · ${negocio.unidade}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-sm font-bold">{vgv > 0 ? fmtMoney(vgv, "short") : "—"}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">VGV</span>
          </div>
        </div>

        {isPerdido ? (
          <Badge variant="destructive" className="text-[11px]">
            Negócio caiu{negocio.motivo_queda ? ` · ${negocio.motivo_queda}` : ""}
          </Badge>
        ) : (
          <Badge
            className="text-[11px] border-0 text-white"
            style={{ backgroundColor: faseInfo?.cor || "#4969FF" }}
          >
            {faseInfo?.label || negocio.fase}
          </Badge>
        )}
      </div>

      {/* Barra de fases clicável */}
      {!isPerdido && (
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 px-1">
            Avançar fase
          </p>
          <div className="flex flex-col gap-1">
            {NEGOCIOS_FASES.map((f, idx) => {
              const done = idx < currentIdx;
              const current = idx === currentIdx;
              return (
                <button
                  key={f.key}
                  disabled={current}
                  onClick={() => requestMoveFase(negocio, f.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                    current && "bg-muted font-semibold cursor-default",
                    !current && "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] shrink-0",
                      done && "text-white",
                      current && "ring-2 ring-offset-1 ring-offset-card",
                      !done && !current && "bg-muted text-muted-foreground"
                    )}
                    style={
                      done || current
                        ? { backgroundColor: f.cor, ...(current ? { boxShadow: `0 0 0 2px ${f.cor}` } : {}) }
                        : undefined
                    }
                  >
                    {done ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span className={cn("flex-1", current ? "text-foreground" : "text-muted-foreground")}>
                    {f.label}
                  </span>
                  {!current && idx > currentIdx && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                  {current && <span className="text-[10px] text-primary">atual</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumo de seções */}
      <div className="grid grid-cols-1 gap-2">
        <SummaryRow label="Proposta" value={negocio.proposta_situacao} />
        <SummaryRow label="Negociação" value={negocio.negociacao_situacao || negocio.negociacao_pendencia} />
        <SummaryRow label="Documentação" value={negocio.documentacao_situacao} />
        {negocio.data_assinatura && (
          <SummaryRow label="Assinatura" value={negocio.data_assinatura} />
        )}
        {negocio.observacoes && <SummaryRow label="Observações" value={negocio.observacoes} />}
      </div>

      {/* Gestão completa */}
      <Button
        variant="outline"
        className="w-full gap-2 rounded-xl"
        onClick={() => setDetailOpen(true)}
      >
        <ExternalLink className="h-4 w-4" />
        Gestão completa do negócio
      </Button>

      {/* Modais */}
      {detailOpen && (
        <Suspense fallback={null}>
          <NegocioDetailModal
            open={detailOpen}
            onOpenChange={(o) => {
              setDetailOpen(o);
              if (!o) load();
            }}
            negocio={negocio}
            onUpdate={async (id, updates) => {
              await supabase
                .from("negocios")
                .update({ ...updates, updated_at: new Date().toISOString() } as any)
                .eq("id", id);
              await load();
            }}
            onMoveFase={(id, fase) => requestMoveFase(negocio, fase)}
          />
        </Suspense>
      )}

      {transitionTarget && (
        <FaseTransitionModal
          open={!!transitionTarget}
          onOpenChange={(v) => {
            if (!v) setTransitionTarget(null);
          }}
          targetFase={transitionTarget.fase}
          negocio={negocio}
          onConfirm={(data) => handleTransitionConfirm(negocio, data)}
        />
      )}

      {celebrationData && (
        <Suspense fallback={null}>
          <VendaCelebration
            nomeCliente={celebrationData.nomeCliente}
            empreendimento={celebrationData.empreendimento}
            vgv={celebrationData.vgv}
            corretorNome={corretorNome}
            onDismiss={() => setCelebrationData(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
      <span className="text-[11px] font-medium text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-xs text-foreground flex-1 break-words">{value}</span>
    </div>
  );
}
