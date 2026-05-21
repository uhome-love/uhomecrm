import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Zap, Trophy, Phone, MessageCircle, Copy, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import TimelineSection from "./TimelineSection";
import LeadContextPanel from "./LeadContextPanel";
import type { FocusLead } from "@/hooks/useFocusLeads";

interface Task {
  id: string;
  titulo: string;
  tipo: string | null;
  vence_em: string | null;
  hora_vencimento: string | null;
}

interface Props {
  lead: FocusLead;
  workedCount: number;
  homiLoading: boolean;
  homiInsight: string | null;
  onGenerateInsight: () => void;
  onRegenerateInsight: () => void;
  pendingTasks: Task[];
  timelineRefreshKey?: number;
  onCompleteTask: (taskId: string, titulo: string) => void;
  onCompleteNextTask: () => void;
  onCreateNewTask: () => void;
  onAdvanceNextLead: () => void;
  /** Slot do painel esquerdo: ações pós-painel (Descartar). */
  panelChildren?: ReactNode;
}

/** Normaliza fone BR para wa.me (apenas dígitos, prefixa 55 se faltar). */
function toWaDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function LeadFocusScreen({
  lead, workedCount, homiLoading, homiInsight, onGenerateInsight, onRegenerateInsight,
  pendingTasks, timelineRefreshKey,
  onCompleteTask, onCompleteNextTask, onCreateNewTask, onAdvanceNextLead, panelChildren,
}: Props) {
  const nextTask = lead.next_pending_task;
  const [phoneCopied, setPhoneCopied] = useState(false);
  const hasPhone = !!lead.phone;

  const handlePhonePopoverOpen = async (open: boolean) => {
    if (!open || !lead.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone);
      setPhoneCopied(true);
      toast.success("Telefone copiado!");
      setTimeout(() => setPhoneCopied(false), 2000);
    } catch {
      // clipboard pode falhar em contextos não-seguros — silencioso
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!lead.phone) return;
    const digits = toWaDigits(lead.phone);
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 max-w-[1400px] mx-auto w-full">
      {/* ====== TOP STRIP (info + 3 botões) ====== */}
      <div
        className="rounded-2xl p-3 sm:p-4 flex flex-col gap-3"
        style={{
          background: "linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))",
          border: "1px solid rgba(79,70,229,0.25)",
        }}
      >
        {/* Linha 1 — info */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <Trophy className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 leading-tight">Trabalhados</p>
              <p className="text-base font-bold text-white leading-tight tabular-nums">{workedCount}</p>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10 hidden sm:block" />

          <div className="flex-1 min-w-0">
            {nextTask ? (
              <>
                <p className="text-[10px] uppercase tracking-wide text-indigo-300 font-semibold">Próxima ação</p>
                <p className="text-sm text-white truncate">{nextTask.titulo}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-wide text-amber-300 font-semibold">Sem tarefa pendente</p>
                <p className="text-sm text-gray-300 truncate">Registre o contato e agende o próximo passo.</p>
              </>
            )}
          </div>
        </div>

        {/* Linha 2 — 3 botões */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* CTA principal */}
          <Button
            onClick={nextTask ? onCompleteNextTask : onCreateNewTask}
            className="flex-1 h-12 gap-2 text-sm font-semibold rounded-xl text-white border-0 shadow-lg hover:brightness-110"
            style={{
              background: "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
              boxShadow: "0 8px 24px -8px hsl(var(--primary-500) / 0.55)",
            }}
          >
            <Zap className="w-4 h-4" />
            Concluir tarefa e registrar
            <span className="ml-1">→</span>
          </Button>

          {/* Ligar — Popover revelando telefone + copy automático */}
          <div className="flex gap-2 sm:contents">
            <Popover onOpenChange={handlePhonePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  disabled={!hasPhone}
                  className="h-12 sm:w-[120px] flex-1 sm:flex-none gap-2 text-sm font-semibold rounded-xl border-0 disabled:opacity-40"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#86efac",
                  }}
                  title={hasPhone ? "Revelar telefone" : "Sem telefone cadastrado"}
                >
                  <Phone className="w-4 h-4" />
                  Ligar
                </Button>
              </PopoverTrigger>
              {hasPhone && (
                <PopoverContent className="w-auto p-3 space-y-2" align="end">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Telefone do lead
                  </p>
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex items-center gap-2 text-lg font-bold tracking-wider text-foreground hover:text-primary transition-colors"
                  >
                    {lead.phone}
                    {phoneCopied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </a>
                  <p className="text-[10px] text-muted-foreground">
                    {phoneCopied ? "Copiado · " : ""}Toque para discar no celular
                  </p>
                </PopoverContent>
              )}
            </Popover>

            {/* WhatsApp — onClick + window.open (wa.me universal) */}
            <Button
              onClick={handleWhatsAppClick}
              disabled={!hasPhone}
              className="h-12 sm:w-[140px] flex-1 sm:flex-none gap-2 text-sm font-semibold rounded-xl bg-[#25D366] text-white border-0 hover:bg-[#1da856] disabled:bg-muted disabled:text-muted-foreground"
              title={hasPhone ? "Abrir conversa no WhatsApp" : "Sem telefone cadastrado"}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>

            {/* Próximo lead — pular sem registrar ação */}
            <Button
              onClick={onAdvanceNextLead}
              variant="outline"
              className="h-12 sm:w-[130px] flex-1 sm:flex-none gap-1.5 text-sm font-semibold rounded-xl border border-white/20 bg-white/10 text-foreground hover:bg-white/20 hover:text-white"
              title="Pular para o próximo lead sem registrar ação"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ====== GRID 30 / 70 (painel esquerda, timeline direita) ====== */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-0">
        <div className="lg:col-span-3 min-h-0">
          <LeadContextPanel
            lead={lead}
            homiLoading={homiLoading}
            homiInsight={homiInsight}
            onGenerateInsight={onGenerateInsight}
            onRegenerateInsight={onRegenerateInsight}
            pendingTasks={pendingTasks}
            onCompleteTask={onCompleteTask}
            onCreateNewTask={onCreateNewTask}
          >
            {panelChildren}
          </LeadContextPanel>
        </div>
        <div className="lg:col-span-7 min-h-[400px] lg:min-h-0">
          <TimelineSection leadId={lead.id} refreshKey={timelineRefreshKey} />
        </div>
      </div>
    </div>
  );
}
