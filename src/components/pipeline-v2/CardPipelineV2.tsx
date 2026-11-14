// ─────────────────────────────────────────────────────────────────
// CardPipelineV2 — card novo do Pipeline (página de teste /pipeline-v2).
//
// Mesmas props do CardMinimal: troca direta no PipelineBoardV2 e no
// PipelineMobileViewV2. Não grava nada novo: os botões reaproveitam os
// fluxos que já existem (RegistrarAtividadeModal, TaskCompletionDialog,
// CardOverflowMenu, abrir a ficha).
//
// 4 linhas:
//   1. Quem: nome + 🔥 temperatura + 🤝 parceria (+ valor do negócio) + ···
//   2. O quê: produto sem campanha · situação
//   3. Próxima ação (única parte com fundo colorido) + botão que faz a ação
//   4. Ponto de saúde + última atividade · corretor · ⚡ registrar
// No computador, ··· e ⚡ aparecem ao passar o mouse. No celular, sempre.
// ─────────────────────────────────────────────────────────────────
import { memo, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Phone, Zap, Copy, Check } from "lucide-react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import CardOverflowMenu from "@/components/pipeline/CardOverflowMenu";
import TaskCompletionDialog from "@/components/pipeline/TaskCompletionDialog";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";
import { prefetchLeadDetailData } from "@/hooks/usePipelineLeadData";
import { useAuth } from "@/hooks/useAuth";
import { completeLeadTask } from "@/lib/completeLeadTask";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import type { CompletionPayload } from "@/components/pipeline/task-completion/types";
import { getInitials } from "@/lib/leadHelpers";
import { fmtMoney } from "@/lib/fmtMoney";
import { leadSaude, diasSemToque } from "@/lib/leadSaude";
import {
  resolverProximaAcao,
  type TarefaV2,
  type CadenciaV2,
  type TomAcao,
  type BotaoAcao,
} from "@/lib/pipelineV2/proximaAcao";
import {
  produtoLimpo,
  nomeCurto,
  situacaoTexto,
  linhaProduto,
  saudeTexto,
  telefoneInternacional,
  telefoneFormatado,
} from "@/lib/pipelineV2/textos";

export interface CardPipelineV2Props {
  lead: PipelineLead;
  stage?: PipelineStage;
  corretorNome?: string;
  corretorAvatarUrl?: string;
  parceiroNome?: string;
  proximaTarefa?: TarefaV2 | null;
  cadencia?: CadenciaV2 | null;
  negocioInfo?: { fase: string; vgv: number; fase_changed_at: string } | null;
  onClick: () => void;
  onDragStart: () => void;
  stages?: PipelineStage[];
  onMoveLead?: (leadId: string, newStageId: string, observacao?: string) => void;
  onTransferred?: (leadId: string, corretorId: string, nome: string) => void;
  /** "toque" no celular: botões de 40px e tudo sempre visível. */
  variante?: "desktop" | "toque";
}

// Cores por tom — fundo bem claro, texto do "quando" na cor. Funciona no claro e no escuro.
const TOM: Record<Exclude<TomAcao, "nenhum">, { caixa: string; quando: string; botao: string }> = {
  atrasada: {
    caixa: "bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20",
    quando: "text-red-700 dark:text-red-300",
    botao: "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10",
  },
  hoje: {
    caixa: "bg-primary/[0.06] border-primary/15",
    quando: "text-primary",
    botao: "border-primary/30 text-primary hover:bg-primary/5",
  },
  visita: {
    caixa: "bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    quando: "text-emerald-700 dark:text-emerald-300",
    botao: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
  },
  futura: {
    caixa: "bg-muted/50 border-border/60",
    quando: "text-muted-foreground",
    botao: "border-border text-muted-foreground hover:bg-muted",
  },
  atencao: {
    caixa: "bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20",
    quando: "text-amber-700 dark:text-amber-300",
    botao: "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10",
  },
  sem: {
    caixa: "bg-card border-dashed border-amber-300 dark:border-amber-500/40",
    quando: "text-amber-700 dark:text-amber-300",
    botao: "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10",
  },
};

const SAUDE_PONTO: Record<string, string> = {
  verde: "bg-emerald-500",
  ambar: "bg-amber-500",
  vermelho: "bg-red-500",
  estagnado: "bg-violet-500",
  terminal: "bg-sky-500",
};
const SAUDE_TEXTO: Record<string, string> = {
  verde: "text-muted-foreground font-medium",
  terminal: "text-muted-foreground font-medium",
  ambar: "text-amber-700 dark:text-amber-400 font-semibold",
  vermelho: "text-red-700 dark:text-red-400 font-semibold",
  estagnado: "text-violet-700 dark:text-violet-400 font-semibold",
};

const TEMPERATURA: Record<string, [string, string]> = {
  quente: ["🔥", "Quente"],
  morno: ["🌤️", "Morno"],
  frio: ["❄️", "Frio"],
};
const SEM_TEMPERATURA = new Set(["novo_lead", "sem_contato", "descarte", "caiu", "convertido", "venda"]);

// Botão com texto à direita. WhatsApp, Ligar, Confirmar e Concluir são ícones;
// "Definir" vira o link "＋ Definir agora" na segunda linha da caixa.
const ROTULO_BOTAO: Partial<Record<Exclude<BotaoAcao, null>, string>> = {
  virar: "Virar negócio",
};

const CardPipelineV2 = memo(function CardPipelineV2({
  lead,
  stage,
  corretorNome,
  corretorAvatarUrl,
  parceiroNome,
  proximaTarefa,
  cadencia,
  negocioInfo,
  onClick,
  onDragStart,
  stages,
  onMoveLead,
  onTransferred,
  variante = "desktop",
}: CardPipelineV2Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toque = variante === "toque";
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [concluirLembreteId, setConcluirLembreteId] = useState<string | null>(null);
  const [concluindoOpen, setConcluindoOpen] = useState(false);
  const [concluindoBusy, setConcluindoBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const stageTipo = stage?.tipo;

  const acao = useMemo(
    () =>
      resolverProximaAcao({
        stageTipo,
        tarefa: proximaTarefa ?? null,
        cadencia: cadencia ?? null,
        flagStatus: lead.flag_status ?? null,
        nomeLead: lead.nome,
        chegouEm: lead.distribuido_em ?? lead.created_at,
      }),
    [stageTipo, proximaTarefa, cadencia, lead.flag_status, lead.nome, lead.distribuido_em, lead.created_at],
  );

  const saude = useMemo(
    () =>
      leadSaude({
        ultimo_toque_at: lead.ultimo_toque_at,
        distribuido_em: lead.distribuido_em,
        aceito_em: lead.aceito_em,
        created_at: lead.created_at,
        stage_tipo: stageTipo,
        estagnacao_carencia_ate: lead.estagnacao_carencia_ate,
      }),
    [lead.ultimo_toque_at, lead.distribuido_em, lead.aceito_em, lead.created_at, stageTipo, lead.estagnacao_carencia_ate],
  );

  const rodape = useMemo(() => {
    const dias = diasSemToque({
      ultimo_toque_at: lead.ultimo_toque_at,
      distribuido_em: lead.distribuido_em,
      aceito_em: lead.aceito_em,
      created_at: lead.created_at,
    });
    return saudeTexto(saude, dias, !!lead.ultimo_toque_at);
  }, [saude, lead.ultimo_toque_at, lead.distribuido_em, lead.aceito_em, lead.created_at]);

  const produto = useMemo(() => produtoLimpo(lead.empreendimento), [lead.empreendimento]);
  const linha2 = useMemo(
    () => linhaProduto(produto, situacaoTexto(lead.flag_status ?? null, stageTipo)),
    [produto, lead.flag_status, stageTipo],
  );

  const temperatura = stageTipo && !SEM_TEMPERATURA.has(stageTipo) ? TEMPERATURA[lead.temperatura] : undefined;
  const valor = negocioInfo && negocioInfo.vgv > 0 ? fmtMoney(negocioInfo.vgv, "short") : "";
  const mostrarCorretor = !!corretorNome && lead.corretor_id !== user?.id;
  const telIntl = telefoneInternacional(lead.telefone || lead.telefone2);
  const telBonito = telefoneFormatado(lead.telefone || lead.telefone2);
  const menuEnabled = !!(stages && onMoveLead);
  const extrasVisiveis = toque ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 transition-opacity";
  const tom = acao.tom === "nenhum" ? null : TOM[acao.tom];
  const tamanhoBotao = toque ? "h-10 min-w-10" : "h-[30px] min-w-[30px]";

  const abrirRegistrar = () => {
    if (proximaTarefa?.tipo === "lembrete" && proximaTarefa.id) setConcluirLembreteId(proximaTarefa.id);
    setRegistrarOpen(true);
  };

  const handleOpen = () => {
    if (registrarOpen || concluindoOpen) return;
    prefetchLeadDetailData(queryClient, lead.id, user?.id);
    trackPipelineEvent("pipeline_card_clicked", {
      lead_id: lead.id,
      stage_id: lead.stage_id,
      corretor_id: lead.corretor_id,
      stage: stage?.tipo ?? stage?.nome,
      status: acao.tom,
    });
    onClick();
  };

  const parar = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const abrirWhatsApp = () => {
    if (!telIntl) {
      toast.error("Este lead não tem telefone cadastrado.");
      return;
    }
    window.open(`https://wa.me/${telIntl}`, "_blank", "noopener,noreferrer");
    // Depois da conversa, o registro fica a um toque: abre o registro de atividade.
    abrirRegistrar();
  };

  const executar = (botao: BotaoAcao) => {
    switch (botao) {
      case "whats":
        abrirWhatsApp();
        return;
      case "confirmar":
      case "concluir":
        if (proximaTarefa?.id) setConcluindoOpen(true);
        else handleOpen();
        return;
      case "definir":
      case "virar":
        handleOpen();
        return;
      default:
        return;
    }
  };

  const botaoIcone = `inline-flex ${tamanhoBotao} items-center justify-center rounded-[9px] border bg-card transition-colors`;
  const botaoTexto = `inline-flex ${toque ? "h-10 px-3" : "h-[30px] px-2"} shrink-0 items-center rounded-[9px] border bg-card text-xs font-bold whitespace-nowrap transition-colors`;

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Abrir lead ${lead.nome || "sem nome"}`}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => setIsDragging(false)}
      onMouseEnter={() => prefetchLeadDetailData(queryClient, lead.id, user?.id)}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
      data-dragging={isDragging || undefined}
      className={[
        "group relative flex cursor-pointer flex-col rounded-[14px] border border-border/70 bg-card text-left shadow-sm",
        "transition-[transform,box-shadow,border-color,opacity] duration-150 hover:-translate-y-px hover:border-border hover:shadow-md",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        toque ? "gap-2.5 px-4 pb-3 pt-3.5" : "gap-2 px-3.5 pb-2.5 pt-3",
        isDragging ? "scale-[0.98] cursor-grabbing opacity-60 shadow-lg" : "",
      ].join(" ")}
    >
      {/* 1 · Quem */}
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-[14.5px] font-semibold leading-5 tracking-tight text-foreground">
            {lead.nome || "Sem nome"}
          </span>
          {temperatura && (
            <span role="img" aria-label={`Temperatura: ${temperatura[1]}`} title={temperatura[1]} className="shrink-0 text-[13px] leading-5">
              {temperatura[0]}
            </span>
          )}
          {parceiroNome && (
            <span
              title={`Parceria com ${parceiroNome}`}
              className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-violet-50 px-1.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
            >
              🤝 {parceiroNome.trim().split(/\s+/)[0]}
            </span>
          )}
        </div>
        {valor && <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{valor}</span>}
        {/* Celular: menu ··· sempre visível, na própria linha */}
        {toque && menuEnabled && (
          <div className="-my-1 -mr-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <CardOverflowMenu
              lead={lead}
              stages={stages!}
              onMoveLead={onMoveLead!}
              onOpenDetail={onClick}
              onTransferred={onTransferred}
              onRegistrarAtividade={abrirRegistrar}
            />
          </div>
        )}
      </div>

      {/* Computador: ⚡ e ··· flutuam no canto ao passar o mouse, sem ocupar espaço do nome */}
      {!toque && (
        <div
          className={`absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-border/70 bg-card/95 p-0.5 shadow-sm backdrop-blur-sm ${extrasVisiveis}`}
          onClick={(e) => e.stopPropagation()}
        >
          {stageTipo !== "descarte" && (
            <button
              type="button"
              aria-label="Registrar atividade"
              title="Registrar atividade"
              onClick={parar(abrirRegistrar)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Zap className="h-[15px] w-[15px]" strokeWidth={2.2} />
            </button>
          )}
          {menuEnabled && (
            <CardOverflowMenu
              lead={lead}
              stages={stages!}
              onMoveLead={onMoveLead!}
              onOpenDetail={onClick}
              onTransferred={onTransferred}
              onRegistrarAtividade={abrirRegistrar}
            />
          )}
        </div>
      )}

      {/* 2 · O quê */}
      {linha2 && <div className="-mt-1.5 truncate text-[12.5px] font-medium leading-[18px] text-muted-foreground">{linha2}</div>}

      {/* 3 · Próxima ação */}
      {tom && (
        <div className={`flex items-center gap-2 rounded-[10px] border py-2 pl-2.5 pr-2 ${tom.caixa}`}>
          <span aria-hidden className="shrink-0 text-[15px] leading-5">
            {acao.emoji}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="line-clamp-2 break-words text-[13px] font-semibold leading-[17px] text-foreground">{acao.titulo}</span>
            {acao.botao === "definir" ? (
              <button
                type="button"
                onClick={parar(() => executar("definir"))}
                className={`self-start text-left text-xs font-bold leading-4 underline-offset-2 hover:underline ${tom.quando}`}
              >
                ＋ {acao.quando}
              </button>
            ) : (
              <span className={`break-words text-xs font-semibold leading-4 ${tom.quando}`}>{acao.quando}</span>
            )}
          </div>

          {acao.botao === "whats" && (
            <button type="button" aria-label="Abrir WhatsApp" title="WhatsApp" onClick={parar(() => executar("whats"))} className={`${botaoIcone} ${tom.botao}`}>
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
            </button>
          )}

          {acao.botao === "ligar" &&
            (toque ? (
              <a
                href={telIntl ? `tel:+${telIntl}` : undefined}
                aria-label="Ligar"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!telIntl) {
                    e.preventDefault();
                    toast.error("Este lead não tem telefone cadastrado.");
                  }
                }}
                className={`${botaoIcone} ${tom.botao}`}
              >
                <Phone className="h-4 w-4" strokeWidth={2} />
              </a>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Ligar" title="Ligar" onClick={(e) => e.stopPropagation()} className={`${botaoIcone} ${tom.botao}`}>
                    <Phone className="h-4 w-4" strokeWidth={2} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="text-xs font-semibold text-muted-foreground">Ligar para {lead.nome?.split(" ")[0] || "o lead"}</div>
                  <div className="mt-1 text-base font-bold tabular-nums text-foreground">{telBonito || "Sem telefone"}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!telIntl}
                      onClick={() => {
                        void navigator.clipboard?.writeText(telBonito);
                        toast.success("Número copiado");
                      }}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </button>
                    <button
                      type="button"
                      onClick={abrirRegistrar}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Registrar ligação
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            ))}

          {(acao.botao === "confirmar" || acao.botao === "concluir") && (
            <button
              type="button"
              aria-label={acao.botao === "confirmar" ? "Confirmar a visita" : "Concluir a tarefa"}
              title={acao.botao === "confirmar" ? "Confirmar a visita" : "Concluir a tarefa"}
              onClick={parar(() => executar(acao.botao))}
              className={`${botaoIcone} ${tom.botao}`}
            >
              <Check className="h-4 w-4" strokeWidth={2.4} />
            </button>
          )}

          {acao.botao && ROTULO_BOTAO[acao.botao] && (
            <button type="button" onClick={parar(() => executar(acao.botao))} className={`${botaoTexto} ${tom.botao}`}>
              {ROTULO_BOTAO[acao.botao]}
            </button>
          )}
        </div>
      )}

      {/* 4 · Rodapé */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5" title="Última atividade">
          <span aria-hidden className={`h-[7px] w-[7px] shrink-0 rounded-full ${SAUDE_PONTO[saude] ?? "bg-slate-400"}`} />
          <span className={`truncate text-xs leading-4 ${SAUDE_TEXTO[saude] ?? "text-muted-foreground"}`}>{rodape}</span>
        </div>
        {mostrarCorretor && (
          <div className="flex max-w-[112px] shrink-0 items-center gap-1.5" title={corretorNome}>
            {corretorAvatarUrl ? (
              <img src={corretorAvatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" loading="lazy" />
            ) : (
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9.5px] font-bold text-primary">
                {getInitials(corretorNome)}
              </span>
            )}
            <span className="truncate text-xs font-medium text-muted-foreground">{nomeCurto(corretorNome)}</span>
          </div>
        )}
        {toque && stageTipo !== "descarte" && (
          <button
            type="button"
            aria-label="Registrar atividade"
            onClick={parar(abrirRegistrar)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-3.5 text-[13px] font-bold text-primary"
          >
            <Zap className="h-[15px] w-[15px]" strokeWidth={2.2} />
            Registrar
          </button>
        )}
      </div>

      {proximaTarefa?.id && (
        <TaskCompletionDialog
          open={concluindoOpen}
          onOpenChange={(v) => {
            if (!concluindoBusy) setConcluindoOpen(v);
          }}
          tarefaTitulo={proximaTarefa.titulo || "Tarefa"}
          tarefaOrigem={proximaTarefa.origem ?? null}
          tarefaId={proximaTarefa.id}
          tarefaSubtipo={proximaTarefa.subtipo ?? null}
          tarefaTipo={proximaTarefa.tipo ?? null}
          leadNome={lead.nome || undefined}
          leadId={lead.id}
          currentStageId={lead.stage_id}
          context="lead"
          onConfirm={async (payload: CompletionPayload) => {
            if (!user || !proximaTarefa.id) return;
            setConcluindoBusy(true);
            try {
              const { toast: msg } = await completeLeadTask({
                tarefaId: proximaTarefa.id,
                tarefaTitulo: proximaTarefa.titulo || "Tarefa",
                leadId: lead.id,
                leadNome: lead.nome,
                userId: user.id,
                payload,
                tarefaTipo: proximaTarefa.tipo ?? null,
              });
              toast.success(msg);
              setConcluindoOpen(false);
              invalidateTaskQueries(queryClient, lead.id);
            } catch (err) {
              const m = err instanceof Error ? err.message : "Erro ao concluir tarefa";
              toast.error("Não foi possível concluir: " + m);
            } finally {
              setConcluindoBusy(false);
            }
          }}
        />
      )}

      {registrarOpen && (
        <div data-no-card-click onClick={(e) => e.stopPropagation()}>
          <RegistrarAtividadeModal
            lead={{ id: lead.id, nome: lead.nome }}
            concluirTarefaId={concluirLembreteId}
            onClose={() => {
              setRegistrarOpen(false);
              setConcluirLembreteId(null);
            }}
            onSaved={() => invalidateTaskQueries(queryClient, lead.id)}
          />
        </div>
      )}
    </div>
  );
});

export default CardPipelineV2;
