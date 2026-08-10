import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Phone, MessageCircle, MapPin, StickyNote, Check, CalendarClock, X, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RegistrarAtividadeModal — Nova Gestão. Ação PRIMÁRIA de atualizar um lead.
 * Único modal de "⚡ Registrar atividade", aberto de vários lugares (menu ⋮ do
 * card, rodapé do card, modal do lead, pós-move). Oferta, sem travar:
 *   1) Registrar o que fez (⚡ atividade → carimba o toque, deixa o lead verde)
 *      + observação opcional
 *   2) Agendar o próximo passo (lembrete na agenda)
 * Nada é salvo até "Concluir"; "Pular"/fechar não salva. Regra de ouro: só a
 * atividade carimba o toque — o lembrete é post-it e não muda a cor.
 */

interface AtDef {
  tipo: string;
  label: string;
  icon: LucideIcon;
  /** conta como toque humano (carimba ultimo_toque_at via trigger)? nota NÃO conta. */
  toque: boolean;
}

const ATIVIDADES: AtDef[] = [
  { tipo: "ligacao", label: "Liguei", icon: Phone, toque: true },
  { tipo: "whatsapp", label: "WhatsApp", icon: MessageCircle, toque: true },
  { tipo: "visita", label: "Visita", icon: MapPin, toque: true },
  { tipo: "nota", label: "Nota", icon: StickyNote, toque: false },
];

const LEMBRETES: { label: string; dias: number }[] = [
  { label: "Amanhã", dias: 1 },
  { label: "Em 2 dias", dias: 2 },
  { label: "Semana que vem", dias: 7 },
];

/** hoje em BRT + N dias → 'yyyy-MM-dd'. */
function dataBRT(dias: number): string {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setDate(brt.getDate() + dias);
  const y = brt.getFullYear();
  const m = String(brt.getMonth() + 1).padStart(2, "0");
  const d = String(brt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface Props {
  lead: { id: string; nome: string } | null;
  /** linha de apoio sob o nome. Default: "registre o contato e agende o próximo passo (opcional)". */
  subtitulo?: string;
  onClose: () => void;
  /** chamado após salvar com sucesso (para refetch da lista, etc). */
  onSaved?: () => void;
}

export default function RegistrarAtividadeModal({ lead, subtitulo, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [ativSel, setAtivSel] = useState<AtDef | null>(null);
  const [obs, setObs] = useState("");
  const [lembreteSel, setLembreteSel] = useState<{ label: string; data: string; hora: string } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customData, setCustomData] = useState("");
  const [customHora, setCustomHora] = useState("09:00");
  const [busy, setBusy] = useState(false);

  // Hora padrão dos atalhos (Amanhã/2 dias/Semana): 09:00 → o push toca de manhã,
  // não à meia-noite. Só "Escolher data" deixa ajustar a hora (compromisso marcado).
  const HORA_PADRAO = "09:00";

  if (!lead) return null;

  const limpar = () => {
    setAtivSel(null);
    setObs("");
    setLembreteSel(null);
    setCustomOpen(false);
    setCustomData("");
    setCustomHora(HORA_PADRAO);
  };

  const fechar = () => {
    limpar();
    onClose();
  };

  // Observação é OBRIGATÓRIA quando se registra uma atividade — é o que alimenta
  // o histórico do lead. Só agendar lembrete (sem atividade) não exige.
  const obsFaltando = !!ativSel && !obs.trim();

  // Salva o que estiver selecionado (atividade + obs + lembrete) e fecha.
  const concluir = async () => {
    if (busy) return;
    const textoObs = obs.trim();
    // obs escrita sem tipo escolhido → vira uma nota
    const ativ = ativSel ?? (textoObs ? ATIVIDADES.find((a) => a.tipo === "nota")! : null);

    if (ativ && !textoObs) {
      toast.error("Escreva uma observação para registrar a atividade.");
      return;
    }
    if (!ativ && !lembreteSel) { fechar(); return; }

    setBusy(true);
    try {
      if (ativ && user) {
        const { error } = await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: lead.id,
          tipo: ativ.tipo,
          titulo: ativ.label,
          descricao: textoObs || null,
          created_by: user.id,
        });
        if (error) throw error;
      }
      if (lembreteSel && user) {
        const { error } = await supabase.from("pipeline_tarefas").insert({
          pipeline_lead_id: lead.id,
          tipo: "lembrete",
          titulo: "Próximo contato",
          vence_em: lembreteSel.data,
          hora_vencimento: lembreteSel.hora,
          responsavel_id: user.id,
          created_by: user.id,
        });
        if (error) throw error;
      }
    } catch {
      setBusy(false);
      toast.error("Não foi possível salvar. Tenta de novo.");
      return;
    }
    setBusy(false);

    if (ativ && lembreteSel) toast.success(`⚡ ${ativ.label} · 📅 ${lembreteSel.label}`);
    else if (ativ) toast.success(ativ.toque ? `⚡ ${ativ.label} registrado` : `${ativ.label} salva`);
    else if (lembreteSel) toast.success(`📅 Lembrete: ${lembreteSel.label}`);
    // Recarrega o board para a cor do card refletir o toque na hora (o trigger
    // do banco já carimbou ultimo_toque_at). Mesmo mecanismo usado pós-move.
    window.dispatchEvent(new CustomEvent("pipeline-reload"));
    onSaved?.();
    fechar();
  };

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
            <Zap className="h-4 w-4 text-primary" strokeWidth={2.2} /> {lead.nome}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {subtitulo ?? "registre o contato e agende o próximo passo (opcional)"}
          </div>
        </div>

        {/* Registrar o que fez */}
        <div className="px-5 pt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Registrei</div>
          <div className="grid grid-cols-4 gap-2">
            {ATIVIDADES.map((a) => {
              const Icon = a.icon;
              const on = ativSel?.tipo === a.tipo;
              return (
                <button
                  key={a.tipo}
                  type="button"
                  disabled={busy}
                  onClick={() => setAtivSel(on ? null : a)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-colors",
                    on
                      ? "border-success-500/50 bg-success-500/10 text-success-700 dark:text-success-500"
                      : "border-border text-foreground hover:border-primary/50 hover:bg-primary/[0.04]"
                  )}
                >
                  {on ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" strokeWidth={1.9} />}
                  {a.label}
                </button>
              );
            })}
          </div>

          {/* Observação — obrigatória ao registrar atividade (alimenta o histórico) */}
          <div className="mt-2.5">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Observação{ativSel && <span className="text-destructive">*</span>}
            </div>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="O que aconteceu? Ex: falei com ele, marcou de retornar amanhã"
              className={cn(
                "w-full resize-none rounded-xl border bg-card px-3 py-2 text-[13px] leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1",
                obsFaltando
                  ? "border-destructive/60 focus:border-destructive focus:ring-destructive/30"
                  : "border-border focus:border-primary/60 focus:ring-primary/30"
              )}
            />
            {obsFaltando && (
              <div className="mt-1 text-[11.5px] font-medium text-destructive">
                Escreva o que aconteceu para registrar.
              </div>
            )}
          </div>
        </div>

        {/* Agendar próximo passo */}
        <div className="px-5 pb-4 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Próximo passo
          </div>
          <div className="flex flex-wrap gap-2">
            {LEMBRETES.map((l) => {
              const on = lembreteSel?.label === l.label;
              return (
                <button
                  key={l.label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCustomOpen(false);
                    setLembreteSel(on ? null : { label: l.label, data: dataBRT(l.dias), hora: HORA_PADRAO });
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/50 hover:bg-primary/[0.04]"
                  )}
                >
                  {l.label}
                </button>
              );
            })}
            <button
              type="button"
              disabled={busy}
              onClick={() => setCustomOpen((v) => !v)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                customOpen
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:border-primary/50 hover:bg-primary/[0.04]"
              )}
            >
              Escolher data
            </button>
          </div>
          {customOpen && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customData}
                min={dataBRT(0)}
                onChange={(e) => {
                  setCustomData(e.target.value);
                  if (e.target.value) {
                    setLembreteSel({
                      label: new Date(e.target.value + "T00:00:00").toLocaleDateString("pt-BR") + ` ${customHora}`,
                      data: e.target.value,
                      hora: customHora,
                    });
                  }
                }}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-[13px]"
              />
              <input
                type="time"
                value={customHora}
                title="Hora do lembrete (opcional)"
                onChange={(e) => {
                  const h = e.target.value || HORA_PADRAO;
                  setCustomHora(h);
                  if (customData) {
                    setLembreteSel({
                      label: new Date(customData + "T00:00:00").toLocaleDateString("pt-BR") + ` ${h}`,
                      data: customData,
                      hora: h,
                    });
                  }
                }}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-[13px]"
              />
              {lembreteSel && customOpen && (
                <span className="text-[12px] font-semibold text-primary">✓ {lembreteSel.label}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button type="button" onClick={fechar} disabled={busy} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            <X className="h-4 w-4" /> Pular
          </button>
          <button type="button" onClick={concluir} disabled={busy || obsFaltando} className="rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy ? "Salvando…" : "Concluir"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
