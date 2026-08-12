import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useFilaDoDia, lembreteAutomatico, type LeadFila, type MotivoFila, type Compromisso, type LembretesAgrupados } from "@/hooks/useFilaDoDia";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import CriarLembreteModal from "@/components/pipeline/CriarLembreteModal";
import CardOverflowMenu from "@/components/pipeline/CardOverflowMenu";
import HomiSugestaoMensagem from "@/components/pipeline/HomiSugestaoMensagem";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { waLink, telLink, formatPhoneBR } from "@/lib/phone";
import { dispensarLead, restaurarLead } from "@/lib/filaDispensados";
import { limparRegistro } from "@/lib/registroLimpo";
import { baixarICS } from "@/lib/ics";
import {
  Target, Zap, Phone, MessageCircle, Home, Bell, Flame, Copy,
  Sparkles, AlertTriangle, ClockAlert, History, Layers, MoreVertical,
  HandCoins, PhoneCall, ChevronDown, X, HelpCircle, Plus, CalendarPlus, CheckCircle2, type LucideIcon,
} from "lucide-react";

const MOTIVO_META: Record<MotivoFila, { label: string; icon: LucideIcon; chip: string }> = {
  negocio:          { label: "Negócio",        icon: HandCoins,    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  pos_visita:       { label: "Pós-visita",     icon: Home,         chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  novo_lead:        { label: "Novo lead",      icon: Sparkles,     chip: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  no_show:          { label: "No-show",        icon: AlertTriangle, chip: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  retorno_hoje:     { label: "Retorno",        icon: ClockAlert,   chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  quente_esfriando: { label: "Esfriando",      icon: Flame,        chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
  sem_proximo_passo:{ label: "Sem próximo passo", icon: History,    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400" },
};

// Ordem dos chips de foco (só aparecem os que têm leads).
const MOTIVO_ORDEM: MotivoFila[] = ["negocio", "pos_visita", "novo_lead", "no_show", "retorno_hoje", "quente_esfriando", "sem_proximo_passo"];

// Por que cada motivo entra na fila (explicação da caixinha "Como funciona").
const MOTIVO_PORQUE: Record<MotivoFila, string> = {
  negocio:          "proposta ou negociação em aberto — é o que fecha o mês",
  pos_visita:       "visitou e falta o retorno — esfria em horas",
  novo_lead:        "chegou hoje e nunca foi contatado — regra dos 5 minutos",
  no_show:          "marcou visita e o cliente não veio — resgatar",
  retorno_hoje:     "você marcou um lembrete que venceu — é promessa",
  quente_esfriando: "marcado quente e sem você falar há dias",
  sem_proximo_passo: "piorando, sem lembrete marcado — retome antes de perder",
};

/** Caixinha "Como funciona" — explica a ordem da fila. */
function ComoFuncionaFila() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" /> Como funciona
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="border-b border-border p-3">
          <p className="text-[13px] font-semibold text-foreground">Como a fila é ordenada</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            A Agenda mostra só quem precisa de <b>ação agora</b>, na ordem de valor:
          </p>
        </div>
        <ol className="divide-y divide-border">
          {MOTIVO_ORDEM.map((k, i) => {
            const m = MOTIVO_META[k];
            const Icon = m.icon;
            return (
              <li key={k} className="flex items-start gap-2.5 p-2.5">
                <span className="mt-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md", m.chip)}>
                  <Icon className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-foreground">{m.label}</p>
                  <p className="text-[11.5px] leading-snug text-muted-foreground">{MOTIVO_PORQUE[k]}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="space-y-2 border-t border-border bg-muted/40 p-3 text-[11.5px] leading-snug text-muted-foreground">
          <p><b className="text-foreground">Empate:</b> quente antes de morno; e quem está há mais tempo sem falar sobe.</p>
          <p><b className="text-foreground">Sem Contato</b> vira um bloco só ("X leads da cadência pra hoje"), pra não entupir a fila.</p>
          <p><b className="text-foreground">Fica de fora</b> (segue no Pipeline): descartados, vendidos, estagnados e quem não tem nenhum gatilho de ação hoje.</p>
        </div>
        <div className="border-t border-border p-2.5">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-onboarding"))}
            className="w-full rounded-lg bg-muted px-3 py-2 text-[12.5px] font-semibold text-foreground hover:bg-muted-foreground/15"
          >
            Ver tour completo da Agenda
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const TEMP_LABEL: Record<string, { t: string; c: string }> = {
  quente: { t: "Quente", c: "text-red-600 dark:text-red-400" },
  morno:  { t: "Morno",  c: "text-amber-600 dark:text-amber-400" },
  frio:   { t: "Frio",   c: "text-blue-600 dark:text-blue-400" },
};

const SAUDE_BORDER: Record<string, string> = {
  verde: "before:bg-emerald-500", ambar: "before:bg-amber-500",
  vermelho: "before:bg-red-500", estagnado: "before:bg-violet-500", terminal: "before:bg-zinc-300",
};

const COMP_ICON: Record<Compromisso["icon"], { icon: LucideIcon; label: string }> = {
  phone:    { icon: Phone,         label: "Ligação" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  home:     { icon: Home,          label: "Visita" },
  bell:     { icon: Bell,          label: "Lembrete" },
};

function diasLabel(d: number | null, temAtividade: boolean): string {
  if (!temAtividade) return "sem atividade ainda";
  if (d === null || d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d}d`;
}

/** "o que fazer" — 1ª parte do título antes de ":", "—" ou "·" (tira o nome). */
function acaoDoTitulo(titulo: string): string {
  const t = titulo.split(/[:—·]/)[0]?.trim();
  return t && t.length > 1 ? t : titulo;
}

/** Contato: WhatsApp (principal) + Ligar + copiar. O corretor trabalha do zap. */
function AcoesContato({ telefone }: { telefone: string | null }) {
  const wa = waLink(telefone);
  const tel = telLink(telefone);
  if (!telefone) return null;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(formatPhoneBR(telefone) || telefone); toast.success("Número copiado"); }
    catch { toast.error("Não deu pra copiar"); }
  };
  // O número É o botão de ligar (toca no celular). WhatsApp é o outro canal.
  // Sem botão "Ligar" separado — evita 2 botões pra mesma intenção de contato.
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {tel ? (
        <a href={tel} aria-label={`Ligar para ${formatPhoneBR(telefone)}`} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tabular-nums text-foreground hover:text-primary">
          <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" /> {formatPhoneBR(telefone)}
        </a>
      ) : (
        <span className="text-[12.5px] tabular-nums text-muted-foreground">{formatPhoneBR(telefone)}</span>
      )}
      {wa && (
        <a
          href={wa} target="_blank" rel="noreferrer" aria-label="Abrir no WhatsApp"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      )}
      <button type="button" onClick={copiar} aria-label="Copiar número" className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CardPrioridade({
  lead, stages, onRegistrar, onOpen, onMove, onDispensar, destacado, feito,
}: {
  lead: LeadFila; stages: PipelineStage[];
  onRegistrar: () => void; onOpen: () => void;
  onMove: (leadId: string, stageId: string) => void;
  onDispensar: () => void;
  destacado?: boolean;
  /** true = acabou de ser registrado: fica ~1,2s em estado "Feito ✓" antes de sair da fila. */
  feito?: boolean;
}) {
  const m = MOTIVO_META[lead.motivo];
  const Icon = m.icon;
  const temp = TEMP_LABEL[(lead.temperatura ?? "").toLowerCase()];
  const leadObj = {
    id: lead.id, nome: lead.nome, stage_id: lead.stage_id, corretor_id: lead.corretor_id,
    telefone: lead.telefone, empreendimento: lead.empreendimento,
  } as unknown as PipelineLead;
  return (
    <div
      data-lead-id={lead.id}
      onClick={onOpen}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-border bg-card p-3 pl-4 overflow-hidden transition-all duration-500 hover:border-border/80 hover:bg-muted/20",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
        SAUDE_BORDER[lead.saude] ?? "before:bg-amber-500",
        destacado && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        feito && "border-emerald-500/60 bg-emerald-50/60 opacity-70 translate-x-2 dark:bg-emerald-500/5 before:bg-emerald-500"
      )}
    >


      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.chip)}>
              <Icon className="h-3 w-3" strokeWidth={2} /> {m.label}
            </span>
            {lead.resultado && (
              <span className="text-[11.5px] font-medium text-foreground/80">{lead.resultado}</span>
            )}
            {temp && <span className={cn("text-[11.5px] font-semibold", temp.c)}>· {temp.t}</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2 min-w-0">
            <span className="text-[15px] font-semibold text-foreground truncate">{lead.nome}</span>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">{lead.stage_nome}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <History className="h-3 w-3 shrink-0" />
            última atividade · {diasLabel(lead.dias_sem_atividade, lead.tem_atividade)}
          </div>
          {(() => {
            const reg = limparRegistro(lead.ultimo_registro);
            return reg ? (
              <div className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[12px] italic leading-snug text-foreground/80">
                “{reg}”
              </div>
            ) : null;
          })()}
          <HomiSugestaoMensagem
            nome={lead.nome}
            empreendimento={lead.empreendimento}
            telefone={lead.telefone}
            motivo={lead.motivo}
            stageNome={lead.stage_nome}
            ultimoRegistro={limparRegistro(lead.ultimo_registro) || null}
          />
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {feito ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[12.5px] font-semibold text-white">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} /> Feito
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRegistrar(); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Zap className="h-3.5 w-3.5" strokeWidth={2.4} /> Registrar
            </button>
          )}
          <CardOverflowMenu
            lead={leadObj}
            stages={stages}
            onMoveLead={onMove}
            onOpenDetail={onOpen}
            onRegistrarAtividade={onRegistrar}
            trigger={
              <button
                type="button"
                aria-label="Ações do lead"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            }
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDispensar(); }}
          title="Dispensar — tira este card da sugestão por 24h"
          className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
        >
          Dispensar
        </button>
        {lead.telefone && <AcoesContato telefone={lead.telefone} />}
      </div>
    </div>
  );
}

/** Card "feito hoje" — comprovante do que já foi registrado (sem ação de fila). */
function CardFeito({
  lead, onOpen, onVoltar,
}: { lead: LeadFila; onOpen: () => void; onVoltar: () => void }) {
  const hora = lead.ultimo_toque_at
    ? new Date(lead.ultimo_toque_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
      })
    : null;
  const reg = limparRegistro(lead.ultimo_registro);
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-3 pl-4 transition-colors hover:bg-muted/20 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-emerald-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[14.5px] font-semibold text-foreground">{lead.nome}</span>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">{lead.stage_nome}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            registrado{hora ? ` às ${hora}` : " hoje"}
          </div>
          {reg && (
            <div className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[12px] italic leading-snug text-foreground/80">
              “{reg}”
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onVoltar(); }}
          title="Voltar este lead pra fila de hoje"
          className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Voltar pra fila
        </button>
      </div>
    </div>
  );
}


/** Bloco único da cadência Sem Contato (volume de "tentar de novo"). */
function CadenciaBloco({
  total, leads, onRegistrar, onOpen,
}: {
  total: number; leads: LeadFila[];
  onRegistrar: (l: LeadFila) => void; onOpen: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left hover:bg-muted/30"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
          <PhoneCall className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-foreground">
            {total} {total === 1 ? "lead" : "leads"} da cadência Sem Contato
          </span>
          <span className="block text-[11.5px] text-muted-foreground">tentativas de hoje · toque em cada e ⚡ registre</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <div className="divide-y divide-border/60 border-t border-border">
          {leads.map((l) => (
            <div key={l.id} className="flex items-center gap-2 px-3.5 py-2.5">
              <button type="button" onClick={() => onOpen(l.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium text-foreground">{l.nome}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  última atividade · {diasLabel(l.dias_sem_atividade, l.tem_atividade)}
                </span>
              </button>
              <AcoesContato telefone={l.telefone} />
              <button
                type="button"
                onClick={() => onRegistrar(l)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Zap className="h-3.5 w-3.5" strokeWidth={2.4} /> Registrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Card de lembrete — mesma leitura do card de prioridade (não listinha). */
function CardLembrete({
  c, accent, onRegistrar, onDispensar, onOpen,
}: {
  c: Compromisso; accent: string;
  onRegistrar: (c: Compromisso) => void;
  onDispensar: (c: Compromisso) => void;
  onOpen: (id: string) => void;
}) {
  const meta = COMP_ICON[c.icon];
  const Icon = meta.icon;
  const isLembrete = c.tipo === "lembrete" && !!c.lead_id;
  const clickOpen = c.lead_id ? () => onOpen(c.lead_id!) : undefined;
  return (
    <div
      onClick={clickOpen}
      className={cn(
        "relative rounded-xl border border-border bg-card p-3 pl-4 overflow-hidden transition-colors",
        clickOpen && "cursor-pointer hover:border-border/80 hover:bg-muted/20",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1", accent
      )}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[15px] font-bold text-foreground leading-tight">{c.lead_nome}</span>
            {c.lead_stage && <span className="shrink-0 text-[12px] text-muted-foreground">· {c.lead_stage}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground/80">{acaoDoTitulo(c.titulo)}</span>
            {c.hora ? <span>· {c.hora}</span> : <span className="text-muted-foreground/60">· sem hora</span>}
          </div>
        </div>
      </div>
      {c.descricao && (
        <div className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[12.5px] italic leading-snug text-foreground/70">
          "{c.descricao}"
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5">
        <AcoesContato telefone={c.telefone} />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Adicionar ao calendário"
            title="Adicionar ao calendário do celular"
            onClick={(e) => {
              e.stopPropagation();
              baixarICS({
                titulo: `${acaoDoTitulo(c.titulo)}: ${c.lead_nome}`,
                descricao: [c.descricao, c.telefone ? `Contato: ${c.telefone}` : null].filter(Boolean).join("\n") || null,
                data: c.data,
                hora: c.hora,
              });
              toast.success("📅 Abra o arquivo pra adicionar ao seu calendário");
            }}
            className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </button>
          {isLembrete && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDispensar(c); }}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Dispensar
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRegistrar(c); }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Zap className="h-3.5 w-3.5" strokeWidth={2.4} /> Registrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type GrupoLembrete = "atrasados" | "hoje" | "futuro";
const GRUPO_META: Record<GrupoLembrete, { label: string; accent: string; tone: string }> = {
  atrasados: { label: "Atrasados", accent: "before:bg-red-500",   tone: "text-red-600" },
  hoje:      { label: "Hoje",      accent: "before:bg-amber-500", tone: "text-amber-600" },
  futuro:    { label: "Futuro",    accent: "before:bg-sky-400",   tone: "text-sky-600" },
};

type RegistrarState = { id: string; nome: string; concluirTarefaId?: string; origem?: "fila" } | null;

export default function AgendaCorretor() {
  const { data, isLoading } = useFilaDoDia();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"prioridades" | "lembretes">("prioridades");
  const [registrar, setRegistrar] = useState<RegistrarState>(null);
  const [foco, setFoco] = useState<"pendentes" | MotivoFila | "feitos">("pendentes");
  const [feitoId, setFeitoId] = useState<string | null>(null);
  const [grupoLembrete, setGrupoLembrete] = useState<GrupoLembrete>("hoje");
  const [criarLembrete, setCriarLembrete] = useState(false);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);

  const hojeLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "short", timeZone: "America/Sao_Paulo",
  });

  const prioridades = data?.prioridades ?? [];
  const cadencia = data?.cadencia ?? { total: 0, leads: [] };
  const feitosHoje = data?.feitosHoje ?? [];
  const stages = data?.stages ?? [];
  const lembretes = useMemo<LembretesAgrupados>(
    () => data?.lembretes ?? { atrasados: [], hoje: [], amanha: [], semana: [], proximos: [] },
    [data?.lembretes]
  );

  // Contagem por motivo (pros chips de foco).
  const contagemMotivo = useMemo(() => {
    const m = {} as Record<MotivoFila, number>;
    for (const l of prioridades) m[l.motivo] = (m[l.motivo] ?? 0) + 1;
    return m;
  }, [prioridades]);
  const focoDisponivel = MOTIVO_ORDEM.filter((k) => (contagemMotivo[k] ?? 0) > 0);
  const prioridadesFiltradas = foco === "todos" || foco === "feitos"
    ? prioridades
    : prioridades.filter((l) => l.motivo === foco);

  // Após registrar um card da fila: rola até o próximo e destaca por ~1,5s.
  useEffect(() => {
    if (!destaqueId) return;
    const el = document.querySelector<HTMLElement>(`[data-lead-id="${destaqueId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setDestaqueId(null), 1500);
    return () => clearTimeout(t);
  }, [destaqueId, prioridades]);


  // Lembretes agrupados em Atrasados / Hoje / Futuro.
  const gruposLembrete = useMemo<Record<GrupoLembrete, Compromisso[]>>(() => ({
    atrasados: lembretes.atrasados,
    hoje: lembretes.hoje,
    futuro: [...lembretes.amanha, ...lembretes.semana, ...lembretes.proximos],
  }), [lembretes]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["fila-do-dia"] });
  const abrirLead = (id: string) => navigate(`/pipeline-leads?lead=${id}`);

  /** Registrou atividade num card da fila → sai da fila de hoje e avança pro próximo. */
  const concluirDaFila = (leadId: string) => {
    const lista = prioridadesFiltradas;
    const i = lista.findIndex((l) => l.id === leadId);
    const proximo = i >= 0 ? (lista[i + 1] ?? lista[i - 1]) : null;
    dispensarLead(leadId);
    invalidar();
    if (proximo) setDestaqueId(proximo.id);
  };

  const voltarPraFila = (leadId: string) => {
    restaurarLead(leadId);
    invalidar();
    toast.success("Lead de volta na fila de hoje");
  };


  const moverEtapa = async (leadId: string, stageId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ stage_id: stageId, stage_changed_at: now, updated_at: now } as never)
      .eq("id", leadId);
    if (error) { toast.error("Não foi possível mover o lead."); return; }
    toast.success("Lead movido ✅");
    invalidar();
  };

  // Dispensar um lembrete = concluir SEM registrar (não conta, não mexe no lead).
  const dispensar = async (c: Compromisso) => {
    const { error } = await supabase
      .from("pipeline_tarefas")
      .update({ status: "concluida", concluida_em: new Date().toISOString() } as never)
      .eq("id", c.id);
    if (error) { toast.error("Não foi possível dispensar."); return; }
    toast.success("Lembrete dispensado");
    invalidar();
  };

  const registrarLembrete = (c: Compromisso) => {
    if (!c.lead_id) return;
    setRegistrar({ id: c.lead_id, nome: c.lead_nome, concluirTarefaId: c.id });
  };

  // Dispensar card da fila = tira da sugestão por 24h (não é adiar, não mexe no lead).
  const dispensarDaFila = (l: LeadFila) => {
    dispensarLead(l.id);
    toast.success(`${l.nome} dispensado por hoje`);
    invalidar();
  };

  const totalFila = prioridades.length + cadencia.total;

  const TabBtn = ({ id, label, badge }: { id: typeof tab; label: string; badge?: number }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className={cn("rounded-full px-1.5 text-[11px] font-bold",
          tab === id ? "bg-white/20" : "bg-muted-foreground/15")}>{badge}</span>
      )}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-24">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Agenda</h1>
          <p className="text-[13px] capitalize text-muted-foreground">{hojeLabel}</p>
        </div>
        <ComoFuncionaFila />
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-border bg-card p-1">
        <TabBtn id="prioridades" label="Prioridades" badge={totalFila} />
        <TabBtn id="lembretes" label="Lembretes" badge={data?.totalLembretes} />
      </div>

      {tab === "prioridades" ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-[13.5px] font-semibold text-foreground">Sua fila de hoje</span>
            <span className="text-[11.5px] text-muted-foreground">· quem o CRM sugere atacar agora</span>
          </div>

          {/* Filtro de foco por motivo */}
          {!isLoading && (focoDisponivel.length > 1 || feitosHoje.length > 0) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <FocoChip ativo={foco === "todos"} onClick={() => setFoco("todos")} label="Todos" count={prioridades.length} />
              {focoDisponivel.map((k) => (
                <FocoChip key={k} ativo={foco === k} onClick={() => setFoco(foco === k ? "todos" : k)} label={MOTIVO_META[k].label} count={contagemMotivo[k]} />
              ))}
              {feitosHoje.length > 0 && (
                <FocoChip
                  ativo={foco === "feitos"}
                  onClick={() => setFoco(foco === "feitos" ? "todos" : "feitos")}
                  label="Feitos hoje"
                  count={feitosHoje.length}
                />
              )}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : foco === "feitos" ? (
            <div className="space-y-2">
              {feitosHoje.map((l) => (
                <CardFeito
                  key={l.id} lead={l}
                  onOpen={() => abrirLead(l.id)}
                  onVoltar={() => voltarPraFila(l.id)}
                />
              ))}
            </div>
          ) : totalFila === 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-4">
              <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="text-[13px] text-foreground">
                <b className="font-semibold">Fila zerada — mandou bem!</b>
                <p className="mt-0.5 text-muted-foreground">Sem leads pedindo ação agora. Aproveite pra aquecer os mornos na Oferta Ativa.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {prioridadesFiltradas.map((l) => (
                <CardPrioridade
                  key={l.id} lead={l} stages={stages}
                  destacado={destaqueId === l.id}
                  onRegistrar={() => setRegistrar({ id: l.id, nome: l.nome, origem: "fila" })}
                  onOpen={() => abrirLead(l.id)}
                  onMove={moverEtapa}
                  onDispensar={() => dispensarDaFila(l)}
                />
              ))}
              {foco === "todos" && (
                <CadenciaBloco
                  total={cadencia.total} leads={cadencia.leads}
                  onRegistrar={(l) => setRegistrar({ id: l.id, nome: l.nome })}
                  onOpen={abrirLead}
                />
              )}
            </div>
          )}

        </>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-[13.5px] font-semibold text-foreground">Seus lembretes</span>
            <span className="text-[11.5px] text-muted-foreground">· sua organização</span>
            <button
              type="button"
              onClick={() => setCriarLembrete(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Lembrete
            </button>
          </div>

          {/* Filtro Atrasados / Hoje / Futuro */}
          <div className="mb-3 inline-flex rounded-xl border border-border bg-card p-1">
            {(["atrasados", "hoje", "futuro"] as GrupoLembrete[]).map((g) => {
              const n = gruposLembrete[g].length;
              const on = grupoLembrete === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrupoLembrete(g)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {GRUPO_META[g].label}
                  <span className={cn("rounded-full px-1.5 text-[11px] font-bold",
                    on ? "bg-white/20" : g === "atrasados" && n > 0 ? "bg-red-100 text-red-600" : "bg-muted-foreground/15")}>{n}</span>
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : gruposLembrete[grupoLembrete].length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
              {grupoLembrete === "atrasados" ? "Nenhum lembrete atrasado 🎉"
                : grupoLembrete === "hoje" ? "Nenhum lembrete para hoje."
                : "Nenhum lembrete futuro agendado."}
            </div>
          ) : (() => {
            const lista = gruposLembrete[grupoLembrete];
            const seus = lista.filter((c) => !lembreteAutomatico(c.origem));
            const auto = lista.filter((c) => lembreteAutomatico(c.origem));
            const secoes = [
              { titulo: "✍️ Criados por você", dica: "você marcou — retome", itens: seus },
              { titulo: "⚙️ Do sistema", dica: "gerados automaticamente", itens: auto },
            ];
            return (
              <div className="space-y-5">
                {secoes.map((sec) => sec.itens.length === 0 ? null : (
                  <div key={sec.titulo}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{sec.titulo}</span>
                      <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] font-bold text-muted-foreground">{sec.itens.length}</span>
                      <span className="text-[11px] text-muted-foreground/70">· {sec.dica}</span>
                    </div>
                    <div className="space-y-2">
                      {sec.itens.map((c) => (
                        <CardLembrete
                          key={`${c.tipo}-${c.id}`} c={c} accent={GRUPO_META[grupoLembrete].accent}
                          onRegistrar={registrarLembrete} onDispensar={dispensar} onOpen={abrirLead}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {registrar && (
        <RegistrarAtividadeModal
          lead={{ id: registrar.id, nome: registrar.nome }}
          concluirTarefaId={registrar.concluirTarefaId ?? null}
          onClose={() => setRegistrar(null)}
          onSaved={() => {
            if (registrar.origem === "fila") concluirDaFila(registrar.id);
            else invalidar();
          }}

        />
      )}

      <CriarLembreteModal
        open={criarLembrete}
        lead={null}
        onClose={() => setCriarLembrete(false)}
        onSaved={invalidar}
      />
    </div>
  );
}

function FocoChip({ ativo, onClick, label, count }: { ativo: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        ativo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {label} <span className="opacity-70">{count}</span>
      {ativo && label !== "Todos" && <X className="h-3 w-3" />}
    </button>
  );
}
