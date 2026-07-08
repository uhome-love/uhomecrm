import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, TrendingUp } from "lucide-react";
import { fmtMoney } from "@/lib/fmtMoney";
import { type Negocio, NEGOCIOS_FASES } from "@/hooks/useNegocios";

interface NegocioFull extends Negocio {
  unidade?: string | null;
  data_assinatura?: string | null;
  proposta_situacao?: string | null;
  proposta_valor?: number | null;
  negociacao_situacao?: string | null;
  negociacao_pendencia?: string | null;
  documentacao_situacao?: string | null;
  motivo_queda?: string | null;
  construtora?: string | null;
}

interface Props {
  negocioId: string | null;
  corretorNome?: string;
}

/**
 * Aba Negócio do modal do lead — painel de INFORMAÇÕES do negócio.
 *
 * No fluxo único, as fases do negócio são as próprias etapas do pipeline de
 * leads (Proposta/Negociação → Aprovação/Documentação → Contrato Gerado → Ganho).
 * A mudança de fase acontece movendo o card no pipeline (com popup que grava no
 * histórico do lead). Esta aba mostra o estado atual e os dados registrados.
 */
export default function DrawerNegocioTab({ negocioId }: Props) {
  const [negocio, setNegocio] = useState<NegocioFull | null>(null);
  const [loading, setLoading] = useState(true);

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
        <p className="text-sm text-muted-foreground">
          Nenhum negócio ainda. Ao mover o lead para <strong>Proposta / Negociação</strong> o negócio é iniciado.
        </p>
      </div>
    );
  }

  const faseInfo = NEGOCIOS_FASES.find((f) => f.key === negocio.fase);
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
            {negocio.construtora && (
              <p className="text-[11px] text-muted-foreground truncate">{negocio.construtora}</p>
            )}
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

        <p className="text-[10px] text-muted-foreground">
          As fases avançam movendo o card no pipeline. Cada mudança fica registrada no Histórico do lead.
        </p>
      </div>

      {/* Resumo de seções */}
      <div className="grid grid-cols-1 gap-2">
        <SummaryRow label="Proposta" value={negocio.proposta_situacao || (negocio.proposta_valor ? fmtMoney(negocio.proposta_valor, "exact") : null)} />
        <SummaryRow label="Negociação" value={negocio.negociacao_situacao || negocio.negociacao_pendencia} />
        <SummaryRow label="Documentação" value={negocio.documentacao_situacao} />
        {negocio.data_assinatura && (
          <SummaryRow label="Assinatura" value={negocio.data_assinatura} />
        )}
        {negocio.observacoes && <SummaryRow label="Observações" value={negocio.observacoes} />}
      </div>
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
