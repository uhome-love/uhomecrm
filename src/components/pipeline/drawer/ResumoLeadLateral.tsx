// ─────────────────────────────────────────────────────────────────
// ResumoLeadLateral — o que o corretor precisa saber do lead em 3 segundos,
// fixo na coluna da esquerda (onde antes sobrava espaço vazio).
// Só lê campos que já existem. O orçamento continua editável ali mesmo,
// gravando no mesmo campo do ResumoLead (pipeline_leads.faixa_valor).
// O ResumoLead da aba "Dados do lead" continua onde está.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { grupoOrigem, rotuloOrigem } from "@/lib/leadOrigemUtils";
import type { PipelineLead } from "@/hooks/usePipeline";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function diaMes(dataOuIso?: string | null): string {
  if (!dataOuIso) return "";
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(dataOuIso);
  const d = new Date(soData ? `${dataOuIso}T12:00:00-03:00` : dataOuIso);
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "numeric" }).formatToParts(d);
  const dia = partes.find((x) => x.type === "day")?.value ?? "";
  const mes = Number(partes.find((x) => x.type === "month")?.value ?? "1");
  return `${dia} ${MESES[mes - 1]}`;
}

function fmtOrc(v: string | null): string | null {
  if (!v || !v.trim()) return null;
  return v.replace(/_/g, " ").replace(/\br\$\s*/i, "R$ ").trim();
}

function Linha({ rotulo, children, ultima = false }: { rotulo: string; children: ReactNode; ultima?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 ${ultima ? "" : "border-b border-border"}`}>
      <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 break-words text-right text-[14px] font-semibold text-foreground">{children}</span>
    </div>
  );
}

export default function ResumoLeadLateral({ lead }: { lead: PipelineLead }) {
  const [faixa, setFaixa] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<{ total: number; ultima: string | null }>({ total: 0, ultima: null });
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [l, v] = await Promise.all([
        supabase.from("pipeline_leads").select("faixa_valor").eq("id", lead.id).maybeSingle(),
        supabase.from("visitas").select("data_visita").eq("pipeline_lead_id", lead.id).eq("status", "realizada").order("data_visita", { ascending: false }),
      ]);
      if (cancel) return;
      setFaixa(((l.data as { faixa_valor?: string | null } | null)?.faixa_valor) ?? null);
      const lista = (v.data ?? []) as { data_visita: string }[];
      setVisitas({ total: lista.length, ultima: lista[0]?.data_visita ?? null });
    })();
    return () => { cancel = true; };
  }, [lead.id]);

  const salvar = async () => {
    const valor = rascunho.trim() || null;
    setFaixa(valor);
    setEditando(false);
    const { error } = await supabase.from("pipeline_leads").update({ faixa_valor: valor } as never).eq("id", lead.id);
    if (error) toast.error("Não foi possível salvar o orçamento.");
    else toast.success("Orçamento atualizado");
  };

  const origem = lead.origem ? (grupoOrigem(lead.origem) === "Outros" ? rotuloOrigem(lead.origem) : grupoOrigem(lead.origem)) : null;
  const norm = (t?: string | null) => (t ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const campanhaBruta = lead.campanha || lead.formulario;
  const campanha = campanhaBruta && norm(campanhaBruta) !== norm(lead.empreendimento) ? campanhaBruta : null;
  const orc = fmtOrc(faixa);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Resumo do lead</h2>

      <Linha rotulo="Interesse">{lead.empreendimento || <span className="font-normal text-muted-foreground">Não informado</span>}</Linha>

      <Linha rotulo="Origem">
        {[origem, campanha].filter(Boolean).join(" · ") || <span className="font-normal text-muted-foreground">Não informada</span>}
      </Linha>

      <Linha rotulo="Entrou">{lead.created_at ? diaMes(lead.created_at) : <span className="font-normal text-muted-foreground">Sem data</span>}</Linha>

      <Linha rotulo="Orçamento">
        {editando ? (
          <span className="flex items-center gap-1">
            <label htmlFor={`orc-${lead.id}`} className="sr-only">Orçamento</label>
            <input
              id={`orc-${lead.id}`}
              autoFocus
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void salvar(); if (e.key === "Escape") setEditando(false); }}
              placeholder="ex.: parcela até R$ 2.500"
              className="w-44 rounded-md border border-border bg-card px-2 py-1 text-[13px] font-normal text-foreground focus:border-primary/60 focus:outline-none"
            />
            <button type="button" onClick={() => void salvar()} aria-label="Salvar orçamento" className="p-1 text-success-700 hover:opacity-80"><Check className="h-4 w-4" /></button>
            <button type="button" onClick={() => setEditando(false)} aria-label="Cancelar" className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </span>
        ) : orc ? (
          <button type="button" onClick={() => { setRascunho(faixa ?? ""); setEditando(true); }} className="hover:text-primary">{orc}</button>
        ) : (
          <span className="inline-flex flex-wrap items-center justify-end gap-x-2.5">
            <span className="whitespace-nowrap font-normal text-muted-foreground">Não informado</span>
            <button type="button" onClick={() => { setRascunho(""); setEditando(true); }} className="font-semibold text-primary hover:underline">Preencher</button>
          </span>
        )}
      </Linha>

      <Linha rotulo="Visitas" ultima>
        {visitas.total > 0
          ? `${visitas.total} realizada${visitas.total > 1 ? "s" : ""}${visitas.ultima ? ` · ${diaMes(visitas.ultima)}` : ""}`
          : <span className="font-normal text-muted-foreground">Nenhuma ainda</span>}
      </Linha>

    </section>
  );
}
