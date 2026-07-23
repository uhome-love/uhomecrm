import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Copy, Phone, MessageSquare, SkipForward, PhoneOff, CheckCircle2,
  CalendarPlus, XCircle, Loader2, Sparkles, Building2, Tag, Clock,
  Search, Flame,
} from "lucide-react";
import type { useMutiraoSession } from "@/hooks/useMutiraoSession";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { playSoundSuccess, playSoundFanfare, getCelebrationEnabled } from "@/lib/celebrations";

type BaldeKey = "verde_hot" | "verde" | "amarelo";

const BALDE_META: Record<BaldeKey, { label: string; icon: any; badgeClass: string; hot?: boolean }> = {
  verde_hot: {
    label: "Verde Quente",
    icon: Flame,
    badgeClass: "bg-success-500/12 text-success-700 border-success-500/40 dark:text-success-500",
    hot: true,
  },
  verde: {
    label: "Verde",
    icon: CheckCircle2,
    badgeClass: "bg-success-500/10 text-success-700 border-success-500/30 dark:text-success-500",
  },
  amarelo: {
    label: "Amarelo",
    icon: Clock,
    badgeClass: "bg-warning-500/10 text-warning-700 border-warning-500/30 dark:text-warning-500",
  },
};

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function LeadCard({
  ms,
  onSemInteresse,
  onAgendarVisita,
  onOpenFilters,
}: {
  ms: ReturnType<typeof useMutiraoSession>;
  onSemInteresse: () => void;
  onAgendarVisita: () => void;
  onOpenFilters?: () => void;
}) {
  const [dossie, setDossie] = useState<string | null>(null);
  const [dossieLoading, setDossieLoading] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { setDossie(null); }, [ms.current?.lead.id]);

  const lead = ms.current?.lead;

  const callSeconds = ms.callStart
    ? Math.floor(((ms.callEnd ?? Date.now()) - ms.callStart) / 1000)
    : 0;

  async function gerarDossie() {
    if (!lead) return;
    setDossieLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("homi-copilot", {
        body: { mode: "dossie_oferta", pipeline_lead_id: lead.id },
      });
      if (error) throw error;
      const texto = (data as any)?.texto || (data as any)?.mensagem || (data as any)?.sugestao_resposta || "Sem insights disponíveis.";
      setDossie(texto);
    } catch (e) {
      console.error("[dossie]", e);
      setDossie("Não consegui gerar o dossiê agora. Use o script como base.");
    } finally {
      setDossieLoading(false);
    }
  }


  const copyPhone = () => {
    if (!lead?.telefone) return;
    navigator.clipboard.writeText(lead.telefone);
    toast.success("Telefone copiado");
  };
  const openWhats = () => {
    if (!lead?.telefone_normalizado) return toast.info("Sem telefone válido");
    window.open(`https://wa.me/${lead.telefone_normalizado}`, "_blank");
  };

  const celebrateAproveitar = () => {
    if (!getCelebrationEnabled()) return;
    playSoundSuccess();
  };
  const celebrateVisita = () => {
    if (!getCelebrationEnabled()) return;
    playSoundFanfare();
  };

  // ─── Skeleton durante transição (puxar/pular) ───
  if (!ms.current && ms.proximoLeadPending && !ms.noLeadsReason) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card animate-fade-in">
        <div className="px-4 py-2 border-b border-border">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <div className="h-7 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-6 w-32 rounded bg-muted animate-pulse" />
            <div className="h-6 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-20 w-full rounded-lg bg-muted animate-pulse" />
          <div className="h-10 w-full rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  // ─── Empty state ───
  if (!ms.current || !lead) {

    const noLeads = !!ms.noLeadsReason;
    const hasFilters = (ms.filters.empreendimento_ids.length + ms.filters.segmento_ids.length) > 0;
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card animate-fade-in">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          {noLeads ? <Search className="w-6 h-6 text-primary" /> : <Sparkles className="w-6 h-6 text-primary" />}
        </div>
        {noLeads ? (
          <>
            <h3 className="text-lg font-semibold mb-1.5">Sem leads disponíveis com esses filtros</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              {hasFilters
                ? "Nenhum lead na fila corresponde aos empreendimentos/segmentos escolhidos ou já estão em cooldown."
                : "A fila está temporariamente vazia. Tente novamente em instantes."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {onOpenFilters && (
                <Button size="lg" onClick={onOpenFilters}>Trocar seleção</Button>
              )}
              <Button
                size="lg" variant="outline"
                onClick={() => { ms.clearNoLeads(); ms.proximoLead(); }}
                disabled={ms.proximoLeadPending}
              >
                {ms.proximoLeadPending && <Loader2 className="animate-spin" />}
                Tentar de novo
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-1.5">Pronto para começar?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Vamos pescar um lead descartado com alta chance de reativação.
            </p>
            <Button size="lg" onClick={() => ms.proximoLead()} disabled={ms.proximoLeadPending}>
              {ms.proximoLeadPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Puxar próximo lead
            </Button>
          </>
        )}
      </div>
    );
  }

  const balde = BALDE_META[(ms.current.balde as BaldeKey)] ?? BALDE_META.verde;
  const BaldeIcon = balde.icon;
  const resultBtnsDisabled = ms.callState !== "ended";

  return (
    <TooltipProvider delayDuration={200}>
      <div
        key={lead.id}
        className={cn(
          "rounded-2xl border bg-card overflow-hidden shadow-card animate-fade-in",
          balde.hot ? "border-success-500/40 mutirao-hot-glow" : "border-border",
        )}
      >
        {/* Balde header */}
        <div className={cn("px-4 py-2 border-b flex items-center justify-between", balde.badgeClass)}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide">
            <BaldeIcon className="w-3.5 h-3.5" />
            {balde.label}
          </span>
          {(() => {
            // Calcula dias BRT no client (evita off-by-one de tz na RPC)
            const src = lead.stage_changed_at ?? null;
            if (!src) return null;
            const brtOffsetMs = -3 * 60 * 60 * 1000;
            const toBrtDay = (d: Date) => Math.floor((d.getTime() + brtOffsetMs) / 86_400_000);
            const dias = Math.max(0, toBrtDay(new Date()) - toBrtDay(new Date(src)));
            return <span className="text-xs font-medium opacity-80">Descartado há {dias}d</span>;
          })()}
        </div>

        <div className="p-5 space-y-5">
          {/* Hero: nome + telefone */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-tight text-foreground truncate">
                {lead.nome || "Sem nome"}
              </h2>
              <p className="text-base font-mono text-muted-foreground mt-1">
                {lead.telefone || "—"}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={copyPhone} aria-label="Copiar telefone">
                    <Copy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar telefone</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={openWhats} aria-label="Abrir WhatsApp">
                    <MessageSquare />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir no WhatsApp</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5">
            {lead.empreendimento_canonico?.nome && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-6 gap-1 max-w-[220px] truncate">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{lead.empreendimento_canonico.nome}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{lead.empreendimento_canonico.nome}</TooltipContent>
              </Tooltip>
            )}
            {lead.segmento?.nome && (
              <Badge variant="outline" className="h-6 gap-1">
                <Tag className="w-3 h-3" />
                {lead.segmento.nome}
              </Badge>
            )}
            {lead.motivo_descarte && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-6 max-w-[240px] truncate">
                    Motivo: {lead.motivo_descarte}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{lead.motivo_descarte}</TooltipContent>
              </Tooltip>
            )}
          </div>


          {/* Dossiê */}
          <div className="rounded-lg border border-border bg-muted/40 p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Dossiê rápido
              </p>
              {!dossie && (
                <Button size="sm" variant="ghost" onClick={gerarDossie} disabled={dossieLoading} className="h-7 -my-1">
                  {dossieLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Gerar com IA
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {dossie ?? "Peça à IA um resumo do lead e a melhor abordagem em 3 segundos."}
            </p>
          </div>

          {/* Zona de ação: ligar */}
          <div className="flex items-center gap-2">
            {ms.callState === "idle" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <Button
                      size="lg"
                      className="w-full font-semibold shadow-sm"
                      onClick={ms.startCall}
                      disabled={!ms.lockConfirmed}
                    >
                      {ms.lockConfirmed ? <Phone /> : <Loader2 className="animate-spin" />}
                      {ms.lockConfirmed ? "Ligar agora" : "Reservando lead…"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!ms.lockConfirmed && (
                  <TooltipContent>Aguardando confirmação do lock para evitar dois corretores no mesmo lead</TooltipContent>
                )}
              </Tooltip>
            )}
            {ms.callState === "in_call" && (
              <div className="flex-1 flex items-center gap-3 rounded-md border-2 border-primary bg-primary/5 px-4 h-10">
                <span className="recording-dot" aria-hidden />
                <span className="text-sm font-medium text-foreground">
                  Em ligação — <span className="font-mono tabular-nums">{fmtDuration(callSeconds)}</span>
                </span>
                <Button size="sm" variant="destructive" className="ml-auto" onClick={ms.endCall}>
                  <PhoneOff /> Encerrar
                </Button>
              </div>
            )}
            {ms.callState === "ended" && (
              <div className="flex-1 flex items-center gap-2 rounded-md border border-success-500/30 bg-success-500/5 px-4 h-10 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span className="text-sm text-foreground">
                  Ligação encerrada (<span className="font-mono tabular-nums">{fmtDuration(callSeconds)}</span>) — registre o resultado
                </span>
              </div>
            )}
            <Button size="lg" variant="outline" onClick={() => ms.pular()} disabled={ms.registrarPending || !ms.lockConfirmed}>
              <SkipForward /> Pular
            </Button>
          </div>

          {/* Botões de resultado */}
          <div
            className={cn(
              "grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 transition-opacity duration-200",
              resultBtnsDisabled ? "opacity-60" : "opacity-100",
            )}
          >
            <ResultButton
              variant="success"
              icon={CheckCircle2}
              label="Aproveitar"
              points={4}
              disabled={resultBtnsDisabled || ms.registrarPending}
              onClick={() => {
                celebrateAproveitar();
                ms.registrar({ resultado: "aproveitado", observacao: "Aproveitado no mutirão" });
              }}
            />
            <ResultButton
              variant="warning"
              icon={CalendarPlus}
              label="Agendar visita"
              points={10}
              disabled={resultBtnsDisabled || ms.registrarPending}
              onClick={() => {
                celebrateVisita();
                onAgendarVisita();
              }}
            />
            <ResultButton
              variant="outline"
              icon={Clock}
              label="Não atendeu"
              points={1}
              disabled={resultBtnsDisabled || ms.registrarPending}
              onClick={() => ms.registrar({ resultado: "nao_atendeu" })}
            />
            <ResultButton
              variant="outline-destructive"
              icon={XCircle}
              label="Sem interesse"
              points={1}
              disabled={resultBtnsDisabled || ms.registrarPending}
              onClick={onSemInteresse}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ResultButton({
  variant, icon: Icon, label, points, disabled, onClick,
}: {
  variant: "success" | "warning" | "outline" | "outline-destructive";
  icon: any;
  label: string;
  points: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={variant as any}
      disabled={disabled}
      onClick={onClick}
      className="h-10 justify-center gap-1.5"
    >
      <Icon />
      <span className="font-semibold">{label}</span>
      <span
        className={cn(
          "ml-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          variant === "success" || variant === "warning"
            ? "bg-white/25 text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        +{points}
      </span>
    </Button>
  );
}
