// ─────────────────────────────────────────────────────────────────
// ResumoLeadLateral — o que o corretor precisa saber do lead em 3 segundos,
// fixo na coluna da esquerda (onde antes sobrava espaço vazio).
// Só lê campos que já existem. O orçamento continua editável ali mesmo,
// gravando no mesmo campo do ResumoLead (pipeline_leads.faixa_valor).
// O ResumoLead da aba "Dados do lead" continua onde está.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { grupoOrigem, rotuloOrigem } from "@/lib/leadOrigemUtils";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  const t = v.replace(/_/g, " ").replace(/\br\$\s*/i, "R$ ").trim();
  if (/^[0.,\s]+$/.test(t) || /^R\$\s*[0.,\s]*$/.test(t)) return null;
  if (/^\d[\d.\s]*$/.test(t)) {
    const n = Number(t.replace(/[.\s]/g, ""));
    if (n >= 1000000) return `R$ ${(n / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
    if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
    return `R$ ${n.toLocaleString("pt-BR")}`;
  }
  if (/^\d/.test(t)) return `R$ ${t}`;
  return t;
}

function Linha({ rotulo, children, ultima = false }: { rotulo: string; children: ReactNode; ultima?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 ${ultima ? "" : "border-b border-border"}`}>
      <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 break-words text-right text-[14px] font-semibold text-foreground">{children}</span>
    </div>
  );
}

export default function ResumoLeadLateral({ lead, esconderOrcamento = false }: { lead: PipelineLead; esconderOrcamento?: boolean }) {
  const [faixa, setFaixa] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<{ total: number; ultima: string | null }>({ total: 0, ultima: null });
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [leitura, setLeitura] = useState<{ id: string; erro: boolean } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [l, v] = await Promise.all([
        supabase.from("pipeline_leads").select("faixa_valor").eq("id", lead.id).maybeSingle(),
        supabase.from("visitas").select("data_visita").eq("pipeline_lead_id", lead.id).eq("status", "realizada").order("data_visita", { ascending: false }),
      ]);
      if (cancel) return;
      setLeitura({ id: lead.id, erro: !!(l.error || v.error) });
      if (l.error || v.error) return;
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
  const pendente = leitura?.id !== lead.id;
  const [aberto, setAberto] = useState(() => { try { return localStorage.getItem("ficha.resumo.aberto") === "1"; } catch { return false; } });
  const alternar = () => setAberto((v) => { try { localStorage.setItem("ficha.resumo.aberto", v ? "0" : "1"); } catch { /* ignore */ } return !v; });

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        <button type="button" onClick={alternar} aria-expanded={aberto} className="flex w-full items-center justify-between gap-2 rounded-md text-left uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>Resumo do lead</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-fast ${aberto ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h2>
      {aberto && (<div className="mt-2">

      <Linha rotulo="Interesse"><span className={lead.empreendimento ? "text-primary" : ""}>{(lead.empreendimento ? lead.empreendimento.charAt(0).toUpperCase() + lead.empreendimento.slice(1) : "") || <span className="font-normal text-muted-foreground">Não informado</span>}</span></Linha>

      <Linha rotulo="Origem">
        {[origem, campanha].filter(Boolean).join(" · ") || <span className="font-normal text-muted-foreground">Não informada</span>}
      </Linha>

      <Linha rotulo="Entrou">{lead.created_at ? diaMes(lead.created_at) : <span className="font-normal text-muted-foreground">Sem data</span>}</Linha>

      {!esconderOrcamento && (
      <Linha rotulo="Orçamento">
        {pendente ? <Skeleton className="ml-auto h-5 w-28 motion-reduce:animate-none" /> : leitura?.erro ? <span className="font-normal text-muted-foreground">Indisponível</span> : editando ? (
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
            <Button variant="ghost" size="icon" onClick={() => void salvar()} aria-label="Salvar orçamento" className="h-7 w-7 text-success-700"><Check className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setEditando(false)} aria-label="Cancelar" className="h-7 w-7 text-muted-foreground"><X className="h-4 w-4" /></Button>
          </span>
        ) : orc ? (
          <Button variant="link" onClick={() => { setRascunho(faixa ?? ""); setEditando(true); }} className="h-auto p-0 whitespace-normal text-right">{orc}</Button>
        ) : (
          <span className="inline-flex flex-wrap items-center justify-end gap-x-2.5">
            <span className="whitespace-nowrap font-normal text-muted-foreground">Não informado</span>
            <Button variant="link" onClick={() => { setRascunho(""); setEditando(true); }} className="h-auto p-0 font-semibold">Preencher</Button>
          </span>
        )}
      </Linha>
      )}

      <Linha rotulo="Visitas" ultima>
        {pendente ? <Skeleton className="ml-auto h-5 w-28 motion-reduce:animate-none" /> : leitura?.erro ? <span className="font-normal text-muted-foreground">Indisponível</span> : visitas.total > 0
          ? `${visitas.total} realizada${visitas.total > 1 ? "s" : ""}${visitas.ultima ? ` · ${diaMes(visitas.ultima)}` : ""}`
          : <span className="font-normal text-muted-foreground">Nenhuma ainda</span>}
      </Linha>
      </div>)}
    </section>
  );
}
