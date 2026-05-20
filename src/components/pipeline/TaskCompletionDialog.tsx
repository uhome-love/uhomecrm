import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, Plus, X, Phone, MessageCircle, ClipboardList,
  FileText, Home, Sparkles, Calendar, Clock,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { dateToBRT } from "@/lib/utils";

const TIPO_BUTTONS = [
  { value: "ligar",            label: "Ligar",      Icon: Phone },
  { value: "whatsapp",         label: "WhatsApp",   Icon: MessageCircle },
  { value: "follow_up",        label: "Follow-up",  Icon: ClipboardList },
  { value: "enviar_proposta",  label: "Proposta",   Icon: FileText },
  { value: "marcar_visita",    label: "Visita",     Icon: Home },
] as const;

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefaTitulo: string;
  leadNome?: string;
  onConfirm: (
    obs: string,
    novaTarefa?: { tipo: string; vence_em: string; hora_vencimento: string; obs: string }
  ) => void;
}

const today = () => new Date();
const quickDates = () => [
  { label: "Hoje +2h",   d: today(),               h: format(new Date(Date.now() + 2 * 3600_000), "HH:mm") },
  { label: "Amanhã 10h", d: addDays(today(), 1),   h: "10:00" },
  { label: "+2 dias",    d: addDays(today(), 2),   h: "10:00" },
  { label: "+7 dias",    d: addDays(today(), 7),   h: "10:00" },
];

export default function TaskCompletionDialog({
  open, onOpenChange, tarefaTitulo, leadNome, onConfirm,
}: TaskCompletionDialogProps) {
  const [obs, setObs] = useState("");
  const [criarNova, setCriarNova] = useState(false);
  const [novoTipo, setNovoTipo] = useState<string>("follow_up");
  const [novoData, setNovoData] = useState(dateToBRT(addDays(new Date(), 1)));
  const [novoHora, setNovoHora] = useState("10:00");
  const [novoObs, setNovoObs] = useState("");

  const reset = () => {
    setObs("");
    setCriarNova(false);
    setNovoTipo("follow_up");
    setNovoData(dateToBRT(addDays(new Date(), 1)));
    setNovoHora("10:00");
    setNovoObs("");
  };

  const handleConcluirSemNova = () => { onConfirm(obs); reset(); };
  const handleConcluirComNova = () => {
    onConfirm(obs, { tipo: novoTipo, vence_em: novoData, hora_vencimento: novoHora, obs: novoObs });
    reset();
  };

  const applyQuick = (d: Date, h: string) => {
    setNovoData(dateToBRT(d));
    setNovoHora(h);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        className="max-w-[520px] p-0 gap-0 border-0 overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0E1428 0%, #0A0E1A 100%)",
          color: "#fff",
        }}
      >
        {/* HEADER */}
        <div
          className="p-5 pb-4 relative"
          style={{
            background: "linear-gradient(135deg, rgba(79,70,229,0.18), rgba(124,58,237,0.10))",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-xl text-white leading-tight"
                style={{ fontFamily: "var(--font-focus-display, inherit)" }}
              >
                Tarefa concluída
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {tarefaTitulo}{leadNome ? <> · <span className="text-indigo-300">{leadNome}</span></> : null}
              </p>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4">
          {/* Observação */}
          <div>
            <label className="text-[11px] uppercase tracking-wide font-semibold text-indigo-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> O que aconteceu?
            </label>
            <Textarea
              placeholder="Ex: Cliente atendeu, pediu para ligar amanhã às 14h..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              className="resize-none text-sm bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-indigo-500/40"
            />
          </div>

          {/* Toggle Nova Tarefa */}
          {!criarNova ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setCriarNova(true)}
                className="flex-1 gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                <Plus className="w-4 h-4" /> Criar próxima tarefa
              </Button>
              <Button
                onClick={handleConcluirSemNova}
                className="flex-1 gap-2 border-0 text-white"
                style={{ background: "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))" }}
              >
                <CheckCircle2 className="w-4 h-4" /> Concluir
              </Button>
            </div>
          ) : (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(79,70,229,0.25)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-indigo-300 flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Próxima ação
                </span>
                <button
                  onClick={() => setCriarNova(false)}
                  className="text-gray-500 hover:text-white p-1 rounded-md transition-colors"
                  aria-label="Cancelar próxima tarefa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tipo */}
              <div className="flex flex-wrap gap-1.5">
                {TIPO_BUTTONS.map(({ value, label, Icon }) => {
                  const active = novoTipo === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setNovoTipo(value)}
                      className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                      style={
                        active
                          ? {
                              background: "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
                              color: "#fff",
                              border: "1px solid transparent",
                            }
                          : {
                              background: "rgba(255,255,255,0.04)",
                              color: "#cbd5e1",
                              border: "1px solid rgba(255,255,255,0.08)",
                            }
                      }
                    >
                      <Icon className="w-3 h-3" /> {label}
                    </button>
                  );
                })}
              </div>

              {/* Quick dates */}
              <div className="flex flex-wrap gap-1.5">
                {quickDates().map((q) => (
                  <button
                    key={q.label}
                    onClick={() => applyQuick(q.d, q.h)}
                    className="text-[11px] px-2 py-1 rounded-md transition-colors text-indigo-200 hover:text-white"
                    style={{
                      background: "rgba(79,70,229,0.10)",
                      border: "1px solid rgba(79,70,229,0.25)",
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Date/time inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data
                  </label>
                  <Input
                    type="date"
                    value={novoData}
                    onChange={(e) => setNovoData(e.target.value)}
                    className="h-9 text-xs bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Horário
                  </label>
                  <Input
                    type="time"
                    value={novoHora}
                    onChange={(e) => setNovoHora(e.target.value)}
                    className="h-9 text-xs bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              <Textarea
                placeholder="Observação da próxima tarefa (opcional)..."
                value={novoObs}
                onChange={(e) => setNovoObs(e.target.value)}
                rows={2}
                className="resize-none text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-indigo-500/40"
              />

              <Button
                onClick={handleConcluirComNova}
                disabled={!novoData}
                className="w-full gap-2 border-0 text-white disabled:opacity-50"
                style={{ background: "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))" }}
              >
                <CheckCircle2 className="w-4 h-4" /> Concluir e agendar próxima
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
