import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Phone, MessageCircle, MapPin, StickyNote, Check, CalendarClock, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AtividadePosMovePopup — Nova Gestão.
 * Aparece leve DEPOIS de mover um lead (o move já aconteceu). Oferta, sem travar:
 *   1) Registrar o que fez (⚡ atividade → carimba o toque, deixa o lead verde)
 *   2) Agendar o próximo passo (lembrete na agenda)
 * Tudo opcional — "Pular" fecha. Registrar/agendar dá feedback e fecha sozinho.
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
  etapaNome?: string;
  onClose: () => void;
}

export default function AtividadePosMovePopup({ lead, etapaNome, onClose }: Props) {
  const { user } = useAuth();
  const [registrada, setRegistrada] = useState<string | null>(null);
  const [lembrete, setLembrete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customData, setCustomData] = useState("");

  if (!lead) return null;

  const registrar = async (a: AtDef) => {
    if (!user || busy) return;
    setBusy(true);
    const { error } = await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: lead.id,
      tipo: a.tipo,
      titulo: a.label,
      created_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error("Não foi possível registrar."); return; }
    setRegistrada(a.tipo);
    toast.success(a.toque ? `⚡ ${a.label} registrado` : `${a.label} salva`);
  };

  const agendar = async (label: string, dataStr: string) => {
    if (!user || busy) return;
    setBusy(true);
    const { error } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: lead.id,
      tipo: "lembrete",
      titulo: "Próximo contato",
      vence_em: dataStr,
      responsavel_id: user.id,
      created_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error("Não foi possível agendar."); return; }
    setLembrete(label);
    toast.success(`📅 Lembrete: ${label}`);
  };

  const fechar = () => {
    setRegistrada(null);
    setLembrete(null);
    setCustomOpen(false);
    setCustomData("");
    onClose();
  };

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <div className="text-[15px] font-bold text-foreground">{lead.nome}</div>
          <div className="text-xs text-muted-foreground">
            movido{etapaNome ? ` para ${etapaNome}` : ""} · registre e agende o próximo passo (opcional)
          </div>
        </div>

        {/* Registrar o que fez */}
        <div className="px-5 pt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Registrei</div>
          <div className="grid grid-cols-4 gap-2">
            {ATIVIDADES.map((a) => {
              const Icon = a.icon;
              const on = registrada === a.tipo;
              return (
                <button
                  key={a.tipo}
                  type="button"
                  disabled={busy}
                  onClick={() => registrar(a)}
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
        </div>

        {/* Agendar próximo passo */}
        <div className="px-5 pb-4 pt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Próximo passo
          </div>
          <div className="flex flex-wrap gap-2">
            {LEMBRETES.map((l) => {
              const on = lembrete === l.label;
              return (
                <button
                  key={l.label}
                  type="button"
                  disabled={busy}
                  onClick={() => agendar(l.label, dataBRT(l.dias))}
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
              className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.04]"
            >
              Escolher data
            </button>
          </div>
          {customOpen && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={customData}
                min={dataBRT(0)}
                onChange={(e) => setCustomData(e.target.value)}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-[13px]"
              />
              <button
                type="button"
                disabled={!customData || busy}
                onClick={() => agendar(new Date(customData + "T00:00:00").toLocaleDateString("pt-BR"), customData)}
                className="rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                Agendar
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button type="button" onClick={fechar} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" /> Pular
          </button>
          <button type="button" onClick={fechar} className="rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground hover:bg-primary/90">
            Concluir
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
