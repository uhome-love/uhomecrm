/**
 * HomiActionCard — Renderiza os cartões do Homi Copiloto:
 *  - Propostas de ação (criar tarefa / criar visita) com confirmação e busca de lead embutida
 *  - Resultados de leitura (pendências acionáveis, imóveis, escolher lead, resumo do lead)
 * Layout compacto e amigável. Nada é gravado sem o corretor confirmar.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Clock, CalendarPlus, Home, MapPin, AlertTriangle, Search, Loader2,
  ChevronRight, User, MessageCircle, CheckCheck, Plus, Sparkles, Phone, Send,

} from "lucide-react";
import { useHomiActions, type LeadOption } from "@/hooks/useHomiActions";
import { useHomi } from "@/contexts/HomiContext";
import { useBrokerSlug } from "@/hooks/useBrokerSlug";
import { gerarSlugUhome } from "@/utils/imoveisFormat";
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

// ─────────────────────────────────────────────── Navegar para o lead no pipeline
function useOpenLead() {
  const navigate = useNavigate();
  const { closeHomi } = useHomi();
  return useCallback((leadId?: string | null) => {
    if (!leadId) return;
    closeHomi();
    navigate(`/pipeline-leads?lead=${leadId}`);
  }, [navigate, closeHomi]);
}

// ─────────────────────────────────────────────── Busca de lead embutida
function LeadSearch({ onSelect }: { onSelect: (lead: LeadOption) => void }) {
  const { searchLeads } = useHomiActions();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (term.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const r = await searchLeads(term);
      setResults(r);
      setLoading(false);
    }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [term, searchLeads]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar lead pelo nome…"
          className="h-9 text-xs pl-8"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {term.trim().length >= 2 && !loading && results.length === 0 && (
        <p className="text-[11px] text-muted-foreground px-1">Nenhum lead encontrado.</p>
      )}
      {results.length > 0 && (
        <div className="max-h-44 overflow-y-auto space-y-1">
          {results.map((l) => (
            <button key={l.id} onClick={() => onSelect(l)}
              className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{l.nome}</p>
                {(l.empreendimento || l.telefone) && <p className="text-[10px] text-muted-foreground truncate">{l.empreendimento || l.telefone}</p>}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────── Task proposal card
function TarefaCard({ action }: { action: HomiAction }) {
  const { confirmarTarefa, saving } = useHomiActions();
  const c = action.campos || {};
  const [leadId, setLeadId] = useState<string | undefined>(action.lead_id);
  const [leadNome, setLeadNome] = useState<string | undefined>(action.lead_nome);
  const [tipo, setTipo] = useState<string>(c.tipo || "follow_up");
  const [tipoCustom, setTipoCustom] = useState<string>(c.tipo_personalizado || "");
  const [data, setData] = useState<string>(c.vence_em || todayBRT());
  const [hora, setHora] = useState<string>(c.hora_vencimento || "");
  const [obs, setObs] = useState<string>(c.descricao || "");
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) return null;
  if (done) return <DoneBadge label={`Tarefa criada para ${leadNome}`} />;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <CalendarPlus className="h-4 w-4 text-primary" /> Nova tarefa
        {leadNome && <>· <span className="text-primary">{leadNome}</span></>}
      </div>

      {!leadId ? (
        <LeadSearch onSelect={(l) => { setLeadId(l.id); setLeadNome(l.nome); }} />
      ) : (
        <button onClick={() => { setLeadId(undefined); setLeadNome(undefined); }}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          trocar lead
        </button>
      )}

      {leadId && (
        <>
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
                  lead_id: leadId, lead_nome: leadNome!, tipo,
                  tipo_personalizado: tipoCustom, vence_em: data, hora_vencimento: hora, descricao: obs,
                });
                if (ok) setDone(true);
              }}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirmar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCancelled(true)}>Cancelar</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────── Visit proposal card
function VisitaCard({ action }: { action: HomiAction }) {
  const { confirmarVisita, saving } = useHomiActions();
  const c = action.campos || {};
  const [leadId, setLeadId] = useState<string | undefined>(action.lead_id);
  const [leadNome, setLeadNome] = useState<string | undefined>(action.lead_nome);
  const [telefone, setTelefone] = useState<string>(c.telefone || "");
  const [data, setData] = useState<string>(c.data_visita || todayBRT());
  const [hora, setHora] = useState<string>(c.hora_visita || "");
  const [local, setLocal] = useState<string>(c.local_visita || "");
  const [resp, setResp] = useState<string>(c.responsavel_visita || "proprio_corretor");
  const [emp, setEmp] = useState<string>(c.empreendimento || "");
  const [obs, setObs] = useState<string>(c.observacoes || "");
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) return null;
  if (done) return <DoneBadge label={`Visita agendada para ${leadNome}`} />;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Home className="h-4 w-4 text-emerald-600" /> Marcar visita
        {leadNome && <>· <span className="text-emerald-700">{leadNome}</span></>}
      </div>

      {!leadId ? (
        <LeadSearch onSelect={(l) => { setLeadId(l.id); setLeadNome(l.nome); setTelefone(l.telefone || ""); setEmp(l.empreendimento || ""); }} />
      ) : (
        <button onClick={() => { setLeadId(undefined); setLeadNome(undefined); }}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          trocar lead
        </button>
      )}

      {leadId && (
        <>
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
                  lead_id: leadId, lead_nome: leadNome!, nome_cliente: leadNome!,
                  telefone, empreendimento: emp, data_visita: data, hora_visita: hora,
                  local_visita: local, responsavel_visita: resp, observacoes: obs,
                });
                if (ok) setDone(true);
              }}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirmar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCancelled(true)}>Cancelar</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────── Anotação rápida
function AnotacaoCard({ action }: { action: HomiAction }) {
  const { anotarLead, saving } = useHomiActions();
  const [texto, setTexto] = useState<string>(action.texto || "");
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) return null;
  if (done) return <DoneBadge label={`Anotação salva em ${action.lead_nome}`} />;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-amber-600" /> Anotação · <span className="text-amber-700">{action.lead_nome}</span>
      </div>
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que registrar?" className="text-xs min-h-[60px]" />
      <div className="flex gap-2 pt-0.5">
        <Button size="sm" className="flex-1 h-8 text-xs gap-1" disabled={saving || !texto.trim()}
          onClick={async () => {
            const ok = await anotarLead(action.lead_id!, action.lead_nome!, texto);
            if (ok) setDone(true);
          }}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Salvar anotação
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

// ─────────────────────────────────────────────── Read: pendências (acionável)
function PendenciasCard({ result, onPick }: { result: HomiResult; onPick: (text: string) => void }) {
  const { concluirTarefa } = useHomiActions();
  const { openComposer } = useHomi();
  const openLead = useOpenLead();
  const [concluded, setConcluded] = useState<Set<string>>(new Set());

  const atrasadas = ((result.atrasadas as any[]) || []).filter((t) => !concluded.has(t.id));
  const hoje = ((result.hoje as any[]) || []).filter((t) => !concluded.has(t.id));
  const visitas = (result.visitas_hoje as any[]) || [];
  const empty = !atrasadas.length && !hoje.length && !visitas.length;
  if (empty) return <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">🎉 Nada atrasado ou pendente por agora.</div>;

  const handleConcluir = async (t: any) => {
    const ok = await concluirTarefa(t.id, t.pipeline_lead_id, t.lead_nome, t.titulo || t.tipo);
    if (ok) setConcluded((prev) => new Set(prev).add(t.id));
  };
  const draftWhats = (nome: string) => onPick(`Escreve uma mensagem de WhatsApp curta e natural de follow-up para o lead ${nome}.`);

  const TaskRow = ({ t, tone }: { t: any; tone?: "danger" }) => (
    <div className="rounded-lg border border-border/70 bg-card/60 p-2 space-y-1.5">
      <div className="min-w-0">
        <p className={`text-xs font-medium truncate ${tone === "danger" ? "text-destructive" : "text-foreground"}`}>{t.lead_nome}</p>
        <p className="text-[10px] text-muted-foreground truncate">{t.titulo || t.tipo}{t.hora_vencimento ? " · " + t.hora_vencimento.slice(0, 5) : ""}{tone === "danger" && t.vence_em ? " · " + t.vence_em : ""}</p>
      </div>
      <div className="flex gap-1">
        <RowAction icon={<CheckCheck className="h-3.5 w-3.5" />} label="Concluir" onClick={() => handleConcluir(t)} tone="success" />
        <RowAction icon={<Plus className="h-3.5 w-3.5" />} label="Tarefa" onClick={() => openComposer("criar_tarefa", { lead_id: t.pipeline_lead_id, lead_nome: t.lead_nome })} />
        <RowAction icon={<MessageCircle className="h-3.5 w-3.5" />} label="Whats" onClick={() => draftWhats(t.lead_nome)} />
        <RowAction icon={<User className="h-3.5 w-3.5" />} label="Lead" onClick={() => openLead(t.pipeline_lead_id)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {atrasadas.length > 0 && (
        <Section title={`Atrasadas (${atrasadas.length})`} icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" />}>
          {atrasadas.map((t) => <TaskRow key={t.id} t={t} tone="danger" />)}
        </Section>
      )}
      {hoje.length > 0 && (
        <Section title={`Tarefas de hoje (${hoje.length})`} icon={<Clock className="h-3.5 w-3.5 text-primary" />}>
          {hoje.map((t) => <TaskRow key={t.id} t={t} />)}
        </Section>
      )}
      {visitas.length > 0 && (
        <Section title={`Visitas de hoje (${visitas.length})`} icon={<Home className="h-3.5 w-3.5 text-emerald-600" />}>
          {visitas.map((v) => (
            <div key={v.id} className="rounded-lg border border-border/70 bg-card/60 p-2 space-y-1.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-700 truncate">{v.nome_cliente}</p>
                <p className="text-[10px] text-muted-foreground truncate">{v.hora_visita ? v.hora_visita.slice(0, 5) + " · " : ""}{v.empreendimento || v.local_visita || ""}</p>
              </div>
              <div className="flex gap-1">
                <RowAction icon={<MessageCircle className="h-3.5 w-3.5" />} label="Whats" onClick={() => draftWhats(v.nome_cliente)} />
                {v.pipeline_lead_id && <RowAction icon={<User className="h-3.5 w-3.5" />} label="Lead" onClick={() => openLead(v.pipeline_lead_id)} />}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function RowAction({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: "success" }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-1 py-1 rounded-md border transition-all ${
        tone === "success"
          ? "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
          : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}>
      {icon}<span>{label}</span>
    </button>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground mb-1.5">{icon}{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────── Read: resumo do lead
function ResumoLeadCard({ result, onPick }: { result: HomiResult; onPick: (text: string) => void }) {
  const { openComposer } = useHomi();
  const openLead = useOpenLead();
  const lead = (result.lead as any) || {};
  const proximas = (result.proximas_tarefas as any[]) || [];
  const sugestao = result.sugestao_proxima_acao as string | undefined;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{lead.nome}</p>
          <p className="text-[10px] text-muted-foreground truncate">{lead.stage_nome || "—"}{lead.empreendimento ? " · " + lead.empreendimento : ""}</p>
        </div>
      </div>
      {lead.telefone && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.telefone}</p>}
      {result.ultima_interacao && <p className="text-[11px] text-muted-foreground">🕑 Última interação: {result.ultima_interacao as string}</p>}
      {proximas.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold text-foreground">Próximas tarefas:</p>
          {proximas.map((t: any, i: number) => (
            <p key={i} className="text-[11px] text-muted-foreground truncate">• {t.titulo || t.tipo} — {t.vence_em}{t.hora_vencimento ? " " + t.hora_vencimento.slice(0, 5) : ""}</p>
          ))}
        </div>
      )}
      {sugestao && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-[11px] text-foreground">
          💡 {sugestao}
        </div>
      )}
      <div className="flex gap-1.5 pt-0.5">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px] gap-1" onClick={() => openComposer("criar_tarefa", { lead_id: lead.id, lead_nome: lead.nome })}>
          <Plus className="h-3 w-3" /> Tarefa
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px] gap-1" onClick={() => onPick(`Escreve uma mensagem de WhatsApp curta para o lead ${lead.nome}.`)}>
          <MessageCircle className="h-3 w-3" /> Whats
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px] gap-1" onClick={() => openLead(lead.id)}>
          <User className="h-3 w-3" /> Abrir
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── Read: imóveis
function buildShare(im: any, slugRef: string | null) {
  const shareSlug = gerarSlugUhome({
    tipo: im.tipo || "imovel",
    quartos: im.dormitorios ?? 0,
    bairro: im.bairro || "",
    codigo: im.codigo,
    slug: im.slug,
  });
  const shareUrl = slugRef
    ? `https://uhome.com.br/c/${slugRef}/imovel/${shareSlug}`
    : `https://uhome.com.br/imovel/${shareSlug}`;
  const linhas = [
    `🏠 ${im.empreendimento || im.titulo || "Imóvel"}`,
    im.bairro ? `📍 ${im.bairro}` : "",
    [im.dormitorios ? `${im.dormitorios} dorm` : "", im.vagas ? `${im.vagas} vaga(s)` : "", im.area ? `${im.area}m²` : ""].filter(Boolean).join(" · "),
    im.valor_venda != null ? `💰 ${fmtMoney(im.valor_venda)}` : "",
    "",
    `👉 ${shareUrl}`,
  ].filter((l) => l !== undefined);
  return { shareUrl, message: linhas.join("\n") };
}

function ImovelRow({ im }: { im: any }) {
  const slugRef = useBrokerSlug();
  const [copied, setCopied] = useState(false);
  const { shareUrl, message } = buildShare(im, slugRef);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 p-2 space-y-2">
      <div className="flex gap-2">
        {im.thumb ? <img src={im.thumb} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" /> : <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><Home className="h-5 w-5 text-muted-foreground" /></div>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{im.empreendimento || im.titulo || im.codigo}</p>
          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{im.bairro || "—"} · {im.dormitorios ? `${im.dormitorios} dorm` : ""} {im.area ? `· ${im.area}m²` : ""}</p>
          {im.valor_venda != null && <p className="text-[11px] font-bold text-primary">{fmtMoney(im.valor_venda)}</p>}
        </div>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px] gap-1" onClick={copy}>
          {copied ? <><CheckCheck className="h-3.5 w-3.5 text-green-600" /> Copiado</> : <><MessageCircle className="h-3.5 w-3.5" /> Copiar mensagem</>}
        </Button>
        <Button asChild size="sm" className="flex-1 h-8 text-[11px] gap-1 bg-[#25D366] hover:bg-[#1fb457] text-white">
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <Send className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

function ImoveisCard({ result }: { result: HomiResult }) {
  const imoveis = (result.imoveis as any[]) || [];
  if (!imoveis.length) return <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">Nenhum imóvel encontrado com esses critérios.</div>;
  return (
    <div className="space-y-1.5">
      {result.aproximado && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 px-1">Sem correspondência exata — mostrando opções próximas:</p>
      )}
      {imoveis.map((im) => <ImovelRow key={im.codigo} im={im} />)}
    </div>
  );
}

// ─────────────────────────────────────────────── Read: escolher lead
function EscolherLeadCard({ result, onPick }: { result: HomiResult; onPick: (text: string) => void }) {
  const candidates = (result.candidates as any[]) || [];
  const INTENTS: Record<string, string> = {
    criar_visita: "marcar visita para",
    criar_tarefa: "criar tarefa para",
    resumo_lead: "me fala do lead",
    anotar_lead: "anotar no lead",
    contexto_lead: "escreve uma mensagem de WhatsApp para",
    registrar_resultado: "registrar resultado do contato com",
    preparar_visita: "preparar a visita de",
  };
  const intentLabel = INTENTS[result.intent as string] || "me fala do lead";
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

// ─────────────────────────────────────────────── Composer: buscar imóvel (campo único)
function ImovelSearchCard({ action }: { action: HomiAction }) {
  const { sendMessage, isLoading } = useHomi();
  const [termo, setTermo] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) return <DoneBadge label="Buscando imóveis…" />;

  const buscar = () => {
    const t = termo.trim();
    if (!t) return;
    setSent(true);
    sendMessage(`Buscar imóvel: ${t}`);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Search className="h-3.5 w-3.5 text-primary" /> Buscar imóvel</p>
      <Input
        autoFocus
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
        placeholder="Ex.: 2 dorms no Petrópolis até 600 mil"
        className="h-9 text-xs"
      />
      <Button onClick={buscar} disabled={isLoading || !termo.trim()} size="sm" className="w-full h-9 text-xs gap-1.5">
        <Search className="h-3.5 w-3.5" /> Buscar
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────── Read: contexto do lead (mini-resumo)
function ContextoLeadCard({ result }: { result: HomiResult }) {
  const openLead = useOpenLead();
  const lead = (result.lead as any) || {};
  return (
    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-2.5 space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
          <User className="h-3.5 w-3.5 text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground truncate">{lead.nome}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {lead.stage_nome || "—"}{lead.flag_status ? " · " + lead.flag_status : ""}
          </p>
        </div>
        <button onClick={() => openLead(lead.id)} className="text-[10px] text-indigo-600 underline underline-offset-2 shrink-0">abrir</button>
      </div>
      {result.ultima_interacao && <p className="text-[10px] text-muted-foreground">🕑 {result.ultima_interacao as string}</p>}
      {typeof result.n_anotacoes === "number" && (result.n_anotacoes as number) > 0 && (
        <p className="text-[10px] text-muted-foreground">📝 {result.n_anotacoes as number} anotação(ões) considerada(s)</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────── Read: preparar visita (cabeçalho)
function PrepararVisitaCard({ result }: { result: HomiResult }) {
  const openLead = useOpenLead();
  const lead = (result.lead as any) || {};
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2.5 flex items-center gap-2">
      <div className="h-7 w-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
        <Home className="h-3.5 w-3.5 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foreground truncate">Briefing · {lead.nome}</p>
        {lead.empreendimento && <p className="text-[10px] text-muted-foreground truncate">{lead.empreendimento}</p>}
      </div>
      {lead.id && <button onClick={() => openLead(lead.id)} className="text-[10px] text-emerald-700 underline underline-offset-2 shrink-0">abrir</button>}
    </div>
  );
}

// ─────────────────────────────────────────────── Read: leads esfriando
function LeadsEsfriandoCard({ result, onPick }: { result: HomiResult; onPick: (text: string) => void }) {
  const { openComposer } = useHomi();
  const openLead = useOpenLead();
  const leads = (result.leads as any[]) || [];
  if (!leads.length) return <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">🎉 Nenhum lead esfriando. Cadência em dia!</div>;
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-2.5 space-y-1.5">
      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">❄️ Leads esfriando ({leads.length})</p>
      {leads.map((l) => (
        <div key={l.id} className="rounded-lg border border-border/70 bg-card/60 p-2 space-y-1.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{l.nome}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {l.dias_parado != null ? `${l.dias_parado} dias sem contato` : "sem atividade"}{l.empreendimento ? " · " + l.empreendimento : ""}
            </p>
          </div>
          <div className="flex gap-1">
            <RowAction icon={<MessageCircle className="h-3.5 w-3.5" />} label="Reengajar" onClick={() => onPick(`Escreve uma mensagem de WhatsApp para reengajar o lead ${l.nome}.`)} />
            <RowAction icon={<Plus className="h-3.5 w-3.5" />} label="Tarefa" onClick={() => openComposer("criar_tarefa", { lead_id: l.id, lead_nome: l.nome })} />
            <RowAction icon={<User className="h-3.5 w-3.5" />} label="Lead" onClick={() => openLead(l.id)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────── Action: registrar resultado do contato
function ResultadoCard({ action }: { action: HomiAction }) {
  const { confirmarResultado, saving } = useHomiActions();
  const { openComposer } = useHomi();
  const [detalhe, setDetalhe] = useState<string>(action.detalhe || "");
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const prox = (action.proxima_tarefa as any) || {};

  if (cancelled) return null;
  if (done) return <DoneBadge label={`Resultado registrado em ${action.lead_nome}`} />;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <CheckCheck className="h-4 w-4 text-primary" /> {action.resultado_label || "Resultado"} · <span className="text-primary">{action.lead_nome}</span>
      </div>
      <Textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Detalhe do contato (opcional)" className="text-xs min-h-[48px]" />
      {prox.titulo && (
        <p className="text-[11px] text-muted-foreground">Próxima ação sugerida: <strong className="text-foreground">{prox.titulo}</strong></p>
      )}
      <div className="flex gap-2 pt-0.5">
        <Button size="sm" className="flex-1 h-8 text-xs gap-1" disabled={saving}
          onClick={async () => {
            const ok = await confirmarResultado(action.lead_id!, action.lead_nome!, action.resultado_label || "Resultado do contato", detalhe);
            if (ok) {
              setDone(true);
              if (prox.tipo) openComposer("criar_tarefa", { lead_id: action.lead_id!, lead_nome: action.lead_nome!, campos: { tipo: prox.tipo } });
            }
          }}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Registrar
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCancelled(true)}>Cancelar</Button>
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
        if (a.tipo === "anotar_lead") return <AnotacaoCard key={i} action={a} />;
        if (a.tipo === "buscar_imovel") return <ImovelSearchCard key={i} action={a} />;
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
        if (r.tipo === "pendencias") return <PendenciasCard key={i} result={r} onPick={onPick} />;
        if (r.tipo === "imoveis") return <ImoveisCard key={i} result={r} />;
        if (r.tipo === "escolher_lead") return <EscolherLeadCard key={i} result={r} onPick={onPick} />;
        if (r.tipo === "resumo_lead") return <ResumoLeadCard key={i} result={r} onPick={onPick} />;
        return null;
      })}
    </div>
  );
}
