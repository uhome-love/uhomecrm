/**
 * HomiActionCard — Renderiza os cartões do Homi Copiloto:
 *  - Propostas de ação (criar tarefa / criar visita) com confirmação
 *  - Resultados de leitura (pendências, imóveis, escolher lead)
 * Layout compacto e amigável. Nada é gravado sem o corretor confirmar.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, X, Clock, CalendarPlus, Home, MapPin, AlertTriangle, Search, Loader2, ChevronRight,
} from "lucide-react";
import { useHomiActions } from "@/hooks/useHomiActions";
import type { HomiAction, HomiResult } from "@/contexts/HomiContext";

const TIPO_BUTTONS = [
  { value: "ligar", label: "Ligar", emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "enviar_material", label: "Email", emoji: "✉️" },
  { value: "follow_up", label: "Follow-up", emoji: "📋" },
  { value: "enviar_proposta", label: "Proposta", emoji: "📄" },
  { value: "marcar_visita", label: "Visita", emoji: "🏠" },
  { value: "outro", label: "Outro", emoji: "➕" },
];
const LOCAL_OPTIONS = [
  { value: "stand", label: "🏗️ Stand" },
  { value: "empresa", label: "🏢 Escritório" },
  { value: "videochamada", label: "📹 Videochamada" },
  { value: "decorado", label: "🏠 Decorado" },
  { value: "no_imovel", label: "🔑 No imóvel" },
  { value: "outro", label: "📍 Outro" },
];
const RESPONSAVEL_OPTIONS = [
  { value: "proprio_corretor", label: "👤 Próprio corretor" },
  { value: "gerente", label: "👔 Gerente" },
  { value: "corretor_parceiro", label: "🤝 Corretor parceiro" },
  { value: "responsavel_construtora", label: "🏗️ Construtora" },
];

function todayBRT() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function tomorrowBRT() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function fmtMoney(v?: number | null) {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ─────────────────────────────────────────────── Task proposal card
function TarefaCard({ action }: { action: HomiAction }) {
  const { confirmarTarefa, saving } = useHomiActions();
  const c = action.campos || {};
  const [tipo, setTipo] = useState<string>(c.tipo || "follow_up");
  const [tipoCustom, setTipoCustom] = useState<string>(c.tipo_personalizado || "");
  const [data, setData] = useState<string>(c.vence_em || todayBRT());
  const [hora, setHora] = useState<string>(c.hora_vencimento || "");
  const [obs, setObs] = useState<string>(c.descricao || "");
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) return null;
  if (done) return <DoneBadge label={`Tarefa criada para ${action.lead_nome}`} />;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <CalendarPlus className="h-4 w-4 text-primary" /> Nova tarefa · <span className="text-primary">{action.lead_nome}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {TIPO_BUTTONS.map((t) => (
          <button key={t.value} onClick={() => setTipo(t.value)}
            className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${tipo === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      {tipo === "outro" && (
        <Input value={tipoCustom} onChange={(e) => setTipoCustom(e.target.value)} placeholder="Descreva o tipo" className="h-8 text-xs" />
      )}
      <div className="flex gap-1.5 items-center">
        <button onClick={() => setData(todayBRT())} className={`text-[11px] px-2 py-1 rounded-lg border ${data === todayBRT() ? "bg-primary/15 border-primary/40" : "border-border"}`}>Hoje</button>
        <button onClick={() => setData(tomorrowBRT())} className={`text-[11px] px-2 py-1 rounded-lg border ${data === tomorrowBRT() ? "bg-primary/15 border-primary/40" : "border-border"}`}>Amanhã</button>
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 text-xs flex-1" />
        <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-8 text-xs w-24" />
      </div>
      <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="text-xs min-h-[52px]" />
      <div className="flex gap-2 pt-0.5">
        <Button size="sm" className="flex-1 h-8 text-xs gap-1" disabled={saving}
          onClick={async () => {
            const ok = await confirmarTarefa({
              lead_id: action.lead_id!, lead_nome: action.lead_nome!, tipo,
              tipo_personalizado: tipoCustom, vence_em: data, hora_vencimento: hora, descricao: obs,
            });
            if (ok) setDone(true);
          }}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirmar
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCancelled(true)}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── Visit proposal card
function VisitaCard({ action }: { action: HomiAction }) {
  const { confirmarVisita, saving } = useHomiActions();
  const c = action.campos || {};
  const [data, setData] = useState<string>(c.data_visita || todayBRT());
  const [hora, setHora] = useState<string>(c.hora_visita || "");
  const [local, setLocal] = useState<string>(c.local_visita || "");
  const [resp, setResp] = useState<string>(c.responsavel_visita || "proprio_corretor");
  const [emp, setEmp] = useState<string>(c.empreendimento || "");
  const [obs, setObs] = useState<string>(c.observacoes || "");
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) return null;
  if (done) return <DoneBadge label={`Visita agendada para ${action.lead_nome}`} />;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Home className="h-4 w-4 text-emerald-600" /> Marcar visita · <span className="text-emerald-700">{action.lead_nome}</span>
      </div>
      <Input value={emp} onChange={(e) => setEmp(e.target.value)} placeholder="Empreendimento" className="h-8 text-xs" />
      <div className="flex gap-1.5 items-center">
        <button onClick={() => setData(todayBRT())} className={`text-[11px] px-2 py-1 rounded-lg border ${data === todayBRT() ? "bg-emerald-500/15 border-emerald-500/40" : "border-border"}`}>Hoje</button>
        <button onClick={() => setData(tomorrowBRT())} className={`text-[11px] px-2 py-1 rounded-lg border ${data === tomorrowBRT() ? "bg-emerald-500/15 border-emerald-500/40" : "border-border"}`}>Amanhã</button>
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 text-xs flex-1" />
        <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-8 text-xs w-24" />
      </div>
      <div className="flex gap-1.5">
        <Select value={local} onValueChange={setLocal}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Local" /></SelectTrigger>
          <SelectContent>{LOCAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={resp} onValueChange={setResp}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>{RESPONSAVEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações (opcional)" className="text-xs min-h-[52px]" />
      <div className="flex gap-2 pt-0.5">
        <Button size="sm" className="flex-1 h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving}
          onClick={async () => {
            const ok = await confirmarVisita({
              lead_id: action.lead_id!, lead_nome: action.lead_nome!, nome_cliente: c.nome_cliente || action.lead_nome!,
              telefone: c.telefone, empreendimento: emp, data_visita: data, hora_visita: hora,
              local_visita: local, responsavel_visita: resp, observacoes: obs,
            });
            if (ok) setDone(true);
          }}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirmar
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCancelled(true)}>Cancelar</Button>
      </div>
    </div>
  );
}

function DoneBadge({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 flex items-center gap-2 text-xs text-emerald-700 font-medium">
      <CheckCircle2 className="h-4 w-4" /> {label}
    </div>
  );
}

// ─────────────────────────────────────────────── Read: pendências
function PendenciasCard({ result }: { result: HomiResult }) {
  const atrasadas = (result.atrasadas as any[]) || [];
  const hoje = (result.hoje as any[]) || [];
  const visitas = (result.visitas_hoje as any[]) || [];
  const empty = !atrasadas.length && !hoje.length && !visitas.length;
  if (empty) return <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">🎉 Nada atrasado ou pendente por agora.</div>;
  return (
    <div className="space-y-2">
      {atrasadas.length > 0 && (
        <Section title={`Atrasadas (${atrasadas.length})`} icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" />}>
          {atrasadas.map((t) => <Row key={t.id} main={t.lead_nome} sub={`${t.titulo || t.tipo} · ${t.vence_em}${t.hora_vencimento ? " " + t.hora_vencimento.slice(0,5) : ""}`} tone="danger" />)}
        </Section>
      )}
      {hoje.length > 0 && (
        <Section title={`Tarefas de hoje (${hoje.length})`} icon={<Clock className="h-3.5 w-3.5 text-primary" />}>
          {hoje.map((t) => <Row key={t.id} main={t.lead_nome} sub={`${t.titulo || t.tipo}${t.hora_vencimento ? " · " + t.hora_vencimento.slice(0,5) : ""}`} />)}
        </Section>
      )}
      {visitas.length > 0 && (
        <Section title={`Visitas de hoje (${visitas.length})`} icon={<Home className="h-3.5 w-3.5 text-emerald-600" />}>
          {visitas.map((v) => <Row key={v.id} main={v.nome_cliente} sub={`${v.hora_visita ? v.hora_visita.slice(0,5) + " · " : ""}${v.empreendimento || v.local_visita || ""}`} tone="success" />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground mb-1.5">{icon}{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ main, sub, tone }: { main: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg hover:bg-accent/40">
      <div className="min-w-0">
        <p className={`text-xs font-medium truncate ${tone === "danger" ? "text-destructive" : tone === "success" ? "text-emerald-700" : "text-foreground"}`}>{main}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── Read: imóveis
function ImoveisCard({ result }: { result: HomiResult }) {
  const imoveis = (result.imoveis as any[]) || [];
  if (!imoveis.length) return <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">Nenhum imóvel encontrado com esses critérios.</div>;
  return (
    <div className="space-y-1.5">
      {imoveis.map((im) => (
        <div key={im.codigo} className="flex gap-2 rounded-xl border border-border bg-card/60 p-2">
          {im.thumb ? <img src={im.thumb} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" /> : <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><Home className="h-5 w-5 text-muted-foreground" /></div>}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{im.empreendimento || im.titulo || im.codigo}</p>
            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{im.bairro || "—"} · {im.dormitorios ? `${im.dormitorios} dorm` : ""} {im.area ? `· ${im.area}m²` : ""}</p>
            {im.valor_venda != null && <p className="text-[11px] font-bold text-primary">{fmtMoney(im.valor_venda)}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────── Read: escolher lead
function EscolherLeadCard({ result, onPick }: { result: HomiResult; onPick: (text: string) => void }) {
  const candidates = (result.candidates as any[]) || [];
  const intentLabel = result.intent === "criar_visita" ? "marcar visita" : "criar tarefa";
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Search className="h-3.5 w-3.5 text-amber-600" /> Qual lead?</p>
      <div className="space-y-1">
        {candidates.map((l) => (
          <button key={l.id} onClick={() => onPick(`${intentLabel} para ${l.nome}`)}
            className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{l.nome}</p>
              {(l.empreendimento || l.telefone) && <p className="text-[10px] text-muted-foreground truncate">{l.empreendimento || l.telefone}</p>}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── Public renderers
export function HomiActionsRenderer({ actions }: { actions?: HomiAction[] }) {
  if (!actions?.length) return null;
  return (
    <div className="space-y-2 mt-1">
      {actions.map((a, i) => {
        if (a.tipo === "criar_tarefa") return <TarefaCard key={i} action={a} />;
        if (a.tipo === "criar_visita") return <VisitaCard key={i} action={a} />;
        return null;
      })}
    </div>
  );
}

export function HomiResultsRenderer({ results, onPick }: { results?: HomiResult[]; onPick: (text: string) => void }) {
  if (!results?.length) return null;
  return (
    <div className="space-y-2 mt-1">
      {results.map((r, i) => {
        if (r.tipo === "pendencias") return <PendenciasCard key={i} result={r} />;
        if (r.tipo === "imoveis") return <ImoveisCard key={i} result={r} />;
        if (r.tipo === "escolher_lead") return <EscolherLeadCard key={i} result={r} onPick={onPick} />;
        return null;
      })}
    </div>
  );
}
