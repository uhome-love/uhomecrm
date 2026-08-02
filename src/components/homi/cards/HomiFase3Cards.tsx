/**
 * Cartões da Fase 3 do HOMI Workspace:
 *  - LeadsParadosCard: leads parados com etapa, tempo e última interação (diagnóstico vem no texto do HOMI)
 *  - FollowupLoteCard: follow-ups em lote, um cartão por lead, com copiar / WhatsApp (aprovação individual)
 *  - RelatorioMetricasCard: números oficiais (rpc_metricas) com gráfico e fonte clicável
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, CheckCheck, MessageCircle, Send, TrendingUp, User, Mail,
} from "lucide-react";
import HomiCard, { HomiKpi } from "@/components/homi/cards/HomiCard";

import type { HomiResult } from "@/contexts/HomiContext";

function money(v?: number | null) {
  if (v == null) return "R$ 0";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

/* ─────────────────────────────── Leads parados com diagnóstico */
export function LeadsParadosCard({ result, onPick }: { result: HomiResult; onPick: (t: string) => void }) {
  const navigate = useNavigate();
  const leads = (result.leads as any[]) || [];
  if (!leads.length) return null;

  return (
    <HomiCard
      icon={AlertTriangle}
      tone="alerta"
      titulo={`Leads parados (${leads.length}) · ${String(result.dias ?? 5)}+ dias`}
    >

      {leads.map((l) => (
        <div key={l.id} className="space-y-1.5 rounded-lg border border-border/70 bg-card/60 p-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{l.nome}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {l.etapa || "—"}
              {l.dias_parado != null ? ` · ${l.dias_parado} dias parado` : ""}
              {l.empreendimento ? ` · ${l.empreendimento}` : ""}
            </p>
            {l.ultima && <p className="truncate text-[10px] text-muted-foreground/80">Último: {l.ultima}</p>}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onPick(`Escreve um follow-up de WhatsApp para o lead ${l.nome}.`)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Follow-up
            </button>
            <button
              type="button"
              onClick={() => navigate(`/pipeline-leads?lead=${l.id}`)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <User className="h-3.5 w-3.5" /> Lead
            </button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-full gap-1 text-[11px]"
        onClick={() => onPick("Gera o follow-up em lote para esses leads parados, um por lead.")}
      >
        <Send className="h-3.5 w-3.5" /> Gerar follow-up para todos
      </Button>
    </HomiCard>
  );
}

/* ─────────────────────────────── Follow-up em lote (aprovação por lead) */
function FollowupItem({ item }: { item: any }) {
  const navigate = useNavigate();
  const [texto, setTexto] = useState<string>(item.texto || "");
  const [copiado, setCopiado] = useState(false);
  const fone = onlyDigits(item.telefone);
  const waHref = fone
    ? `https://wa.me/55${fone.replace(/^55/, "")}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-1.5 rounded-lg border border-border/70 bg-card/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-foreground">{item.nome}</p>
        {item.lead_id && (
          <button
            type="button"
            onClick={() => navigate(`/pipeline-leads?lead=${item.lead_id}`)}
            className="shrink-0 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            abrir lead
          </button>
        )}
      </div>
      {item.empreendimento && <p className="truncate text-[10px] text-muted-foreground">{item.empreendimento}</p>}
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-[64px] text-xs" />
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-[11px]" onClick={copiar}>
          {copiado ? <><CheckCheck className="h-3.5 w-3.5 text-green-600" /> Copiado</> : <><MessageCircle className="h-3.5 w-3.5" /> Copiar</>}
        </Button>
        <Button asChild size="sm" className="h-8 flex-1 gap-1 bg-[#25D366] text-white text-[11px] hover:bg-[#1fb457]">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <Send className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

export function FollowupLoteCard({ result }: { result: HomiResult }) {
  const itens = (result.itens as any[]) || [];
  if (!itens.length) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-primary/25 bg-primary/5 p-2.5">
      <p className="text-xs font-bold text-foreground">✉️ Follow-ups prontos ({itens.length}) — revise e envie</p>
      {itens.map((it, i) => <FollowupItem key={it.lead_id || i} item={it} />)}
    </div>
  );
}

/* ─────────────────────────────── Relatório de métricas (SSOT) */
function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function delta(atual: number, anterior?: number | null) {
  if (anterior == null) return undefined;
  if (!anterior) return atual > 0 ? "novo" : undefined;
  const p = Math.round(((atual - anterior) / anterior) * 100);
  return `${p >= 0 ? "+" : ""}${p}% vs. anterior`;
}

export function RelatorioMetricasCard({ result }: { result: HomiResult }) {
  const navigate = useNavigate();
  const t = (result.totais as any) || {};
  const ant = (result.anterior as any) || null;
  const corretores = ((result.corretores as any[]) || []).filter((c) => c.vgv > 0 || c.visitas > 0);
  const escopo = String(result.escopo || "corretor");

  return (
    <div className="space-y-2 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
        Números · {String(result.periodo_label || "período")}
        <span className="rounded bg-muted px-1 text-[9px] font-medium uppercase text-muted-foreground">
          {escopo === "global" ? "empresa" : escopo === "gestor" ? "equipe" : "meu"}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <Kpi label="Leads" valor={String(t.leads_recebidos ?? 0)} sub={delta(t.leads_recebidos ?? 0, ant?.leads_recebidos)} />
        <Kpi label="Visitas agendadas" valor={String(t.visitas_agendadas ?? 0)} />
        <Kpi label="Visitas realizadas" valor={String(t.visitas_realizadas ?? 0)} sub={delta(t.visitas_realizadas ?? 0, ant?.visitas_realizadas)} />
        <Kpi label="Vendas" valor={String(t.vendas ?? 0)} sub={delta(t.vendas ?? 0, ant?.vendas)} />
        <Kpi label="VGV assinado" valor={money(t.vgv_assinado)} sub={delta(t.vgv_assinado ?? 0, ant?.vgv_assinado)} />
        <Kpi
          label="Conversão visita→venda"
          valor={t.visitas_realizadas ? `${Math.round(((t.vendas || 0) / t.visitas_realizadas) * 100)}%` : "—"}
        />
      </div>

      {escopo !== "corretor" && corretores.length > 1 && (
        <div className="h-32 rounded-lg border border-border/70 bg-card/60 p-1.5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={corretores.slice(0, 6).map((c) => ({ nome: (c.nome || "—").split(" ")[0], VGV: c.vgv }))}>
              <XAxis dataKey="nome" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="VGV" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/central-relatorios")}
        className="flex w-full items-center justify-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Fonte: rpc_metricas · {String(result.inicio)} a {String(result.fim)} · ver na Performance
      </button>
    </div>
  );
}
