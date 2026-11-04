import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import TemperaturaChip from "./TemperaturaChip";
import { normalizarTemperatura, rotuloTemperatura } from "@/lib/temperatura";
import { getOrigemLabel } from "./LeadHistoricoTab";
import type { PipelineLead } from "@/hooks/usePipeline";

/**
 * ResumoLead — barra colapsável no topo da História com o que um gestor/CEO
 * precisa saber em 3 segundos: orçamento, temperatura, próximo passo, origem
 * (Campanha · Conjunto · Anúncio) e empreendimento. Começa FECHADA (não come a
 * jornada). Orçamento e temperatura são EDITÁVEIS ali mesmo.
 */

const TEMP_CLS: Record<string, string> = {
  quente: "text-danger-500",
  morno: "text-warning-700 dark:text-warning-500",
  frio: "text-sky-600",
};

function fmtOrc(v: string | null): string {
  if (!v || !v.trim()) return "—";
  return v.replace(/_/g, " ").replace(/\br\$\s*/i, "R$ ").trim();
}

export default function ResumoLead({ lead }: { lead: PipelineLead }) {
  const [aberto, setAberto] = useState(false);
  const [tempAtual, setTempAtual] = useState<string | null>(lead.temperatura ?? null);
  useEffect(() => setTempAtual(lead.temperatura ?? null), [lead.temperatura]);
  const [faixa, setFaixa] = useState<string | null>(null);
  const [passo, setPasso] = useState<string | null>(null);
  const [editOrc, setEditOrc] = useState(false);
  const [orcDraft, setOrcDraft] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("pipeline_leads")
        .select("faixa_valor, proxima_acao, data_proxima_acao")
        .eq("id", lead.id)
        .maybeSingle();
      if (cancel || !data) return;
      setFaixa((data as { faixa_valor?: string | null }).faixa_valor ?? null);
      const d = data as { proxima_acao?: string | null; data_proxima_acao?: string | null };
      setPasso(d.proxima_acao ? `${d.proxima_acao}${d.data_proxima_acao ? ` · ${d.data_proxima_acao.slice(0, 10).split("-").reverse().join("/")}` : ""}` : null);
    })();
    return () => { cancel = true; };
  }, [lead.id]);

  const salvarOrc = async () => {
    const v = orcDraft.trim() || null;
    setFaixa(v);
    setEditOrc(false);
    const { error } = await supabase.from("pipeline_leads").update({ faixa_valor: v } as never).eq("id", lead.id);
    if (error) toast.error("Não foi possível salvar o orçamento.");
    else toast.success("Orçamento atualizado");
  };

  const origemInfo = getOrigemLabel(lead.origem);
  const anuncioLinha = [lead.campanha, lead.conjunto_anuncio, lead.anuncio].filter(Boolean).join(" · ");
  const tempKey = normalizarTemperatura(tempAtual);
  const temp = tempKey === "nao_definida" ? null : { label: rotuloTemperatura(tempKey), cls: TEMP_CLS[tempKey] };

  return (
    <div className="px-7 pt-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Barra fechada — 1 linha */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-muted/40 transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground shrink-0">Resumo</span>
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap text-[12.5px] font-semibold text-foreground">
            <span className="whitespace-nowrap">💰 {fmtOrc(faixa)}</span>
            {temp && <><span className="text-muted-foreground/40">·</span><span className={cn("whitespace-nowrap", temp.cls)}>{temp.label}</span></>}
            {passo && <><span className="text-muted-foreground/40">·</span><span className="truncate text-foreground">➡️ {passo}</span></>}
            {origemInfo && <><span className="text-muted-foreground/40">·</span><span className="whitespace-nowrap text-muted-foreground">{origemInfo.emoji} {origemInfo.label}</span></>}
            {lead.empreendimento && <><span className="text-muted-foreground/40">·</span><span className="truncate text-muted-foreground">🏢 {lead.empreendimento}</span></>}
          </div>
          <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary">
            {aberto ? <>Fechar <ChevronUp className="h-3.5 w-3.5" /></> : <>Ver tudo <ChevronDown className="h-3.5 w-3.5" /></>}
          </span>
        </button>

        {/* Aberto — quadro completo, editável */}
        {aberto && (
          <div className="border-t border-border px-3.5 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Orçamento (editável) */}
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">💰 Orçamento</div>
              {editOrc ? (
                <div className="mt-1 flex items-center gap-1">
                  <input
                    autoFocus
                    value={orcDraft}
                    onChange={(e) => setOrcDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") salvarOrc(); if (e.key === "Escape") setEditOrc(false); }}
                    placeholder="ex.: 690 a 750 mil"
                    className="w-full rounded-md border border-border bg-card px-2 py-1 text-[12.5px] text-foreground focus:border-primary/60 focus:outline-none"
                  />
                  <button type="button" onClick={salvarOrc} className="text-success-500 hover:opacity-80"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setEditOrc(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => { setOrcDraft(faixa ?? ""); setEditOrc(true); }} className="mt-1 flex items-center gap-1.5 text-[13.5px] font-bold text-foreground hover:text-primary group">
                  {fmtOrc(faixa)} <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                </button>
              )}
            </div>

            {/* Temperatura (editável — componente pronto) */}
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1">🔥 Temperatura</div>
              <TemperaturaChip leadId={lead.id} value={tempAtual} onChange={setTempAtual} />
            </div>

            {/* Origem (Campanha · Conjunto · Anúncio) */}
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2 col-span-2 sm:col-span-2">
              <div className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">📱 Origem</div>
              <div className="mt-1 text-[12.5px] font-semibold text-foreground">
                {origemInfo ? `${origemInfo.emoji} ${origemInfo.label}` : "—"}
              </div>
              {anuncioLinha && <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{anuncioLinha}</div>}
              {!anuncioLinha && lead.formulario && <div className="mt-0.5 text-[11px] text-muted-foreground">📋 {lead.formulario}</div>}
            </div>

            {/* Empreendimento */}
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">🏢 Interesse (imóvel)</div>
              <div className="mt-1 text-[12.5px] font-semibold text-foreground truncate">{lead.empreendimento || "—"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
