import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, CalendarDays, XCircle, MapPin, Clock, User, Building2, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VisitaPublicData {
  nome_cliente: string;
  empreendimento: string | null;
  data_visita: string;
  hora_visita: string | null;
  local_visita: string | null;
  status: string;
  confirmed_at: string | null;
  cancel_reason: string | null;
  corretor_nome: string | null;
  corretor_avatar: string | null;
}

const CANCEL_REASONS = [
  "Mudança de planos",
  "Problema pessoal",
  "Desisti do imóvel",
  "Já encontrei outro",
  "Horário não serve mais",
  "Outro motivo",
];

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "13:00", "13:30", "14:00",
  "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
];

export default function VisitaConfirmacao() {
  const { token } = useParams<{ token: string }>();
  const [visita, setVisita] = useState<VisitaPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [view, setView] = useState<"main" | "reschedule" | "cancel" | "done">("main");
  const [doneMessage, setDoneMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reschedule
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");

  // Cancel
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (token) loadVisita();
  }, [token]);

  async function loadVisita() {
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("visita-public", {
        body: { action: "get", token },
      });
      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
      } else {
        setVisita(data);
        // If already acted on, show appropriate state
        if (data.status === "confirmada" && data.confirmed_at) {
          setView("done");
          setDoneMessage("Sua presença já foi confirmada!");
        } else if (data.status === "cancelada") {
          setView("done");
          setDoneMessage("Esta visita foi cancelada.");
        }
      }
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados da visita");
    }
    setLoading(false);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("visita-public", {
        body: { action: "confirm", token },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setView("done");
      setDoneMessage(`Ótimo! Te esperamos em ${formatDate(visita!.data_visita)} às ${visita!.hora_visita || "—"}. Até lá! 🏠`);
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  async function handleReschedule() {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const nova_data = format(selectedDate, "yyyy-MM-dd");
      const { data, error: fnError } = await supabase.functions.invoke("visita-public", {
        body: { action: "reschedule", token, nova_data, nova_hora: selectedTime },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setView("done");
      setDoneMessage(`Visita reagendada para ${formatDate(nova_data)} às ${selectedTime}. Te esperamos! 📅`);
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  async function handleCancel() {
    if (!cancelReason) return;
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("visita-public", {
        body: { action: "cancel", token, motivo: cancelReason },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setView("done");
      setDoneMessage("Visita cancelada. Esperamos te ver em breve! 🙏");
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <img src="/images/uhomesales-logo.png" alt="Uhome" className="h-10 mb-6" />
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Link inválido</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
      </div>
    );
  }

  if (!visita) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center p-4 sm:p-6">
      {/* Header */}
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/images/uhomesales-logo.png" alt="Uhome" className="h-8 mx-auto mb-4" />
        </div>

        {/* Done state */}
        {view === "done" && (
          <Card className="border-primary/20">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Tudo certo!</h2>
              <p className="text-sm text-muted-foreground">{doneMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Main view */}
        {view === "main" && (
          <>
            <Card className="border-primary/20 mb-4">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h1 className="text-lg font-bold text-foreground">Sua visita está agendada!</h1>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatDate(visita.data_visita)} às {visita.hora_visita || "horário a confirmar"}
                      </p>
                    </div>
                  </div>

                  {visita.empreendimento && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm text-foreground">{visita.empreendimento}</p>
                    </div>
                  )}

                  {visita.local_visita && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm text-foreground">{visita.local_visita}</p>
                    </div>
                  )}

                  {visita.corretor_nome && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={visita.corretor_avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {visita.corretor_nome.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{visita.corretor_nome}</p>
                        <p className="text-[11px] text-muted-foreground">Seu corretor</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                className="w-full h-12 text-base gap-2"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Confirmar minha presença
              </Button>

              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                onClick={() => setView("reschedule")}
              >
                <CalendarDays className="h-4 w-4" />
                Preciso reagendar
              </Button>

              <Button
                variant="ghost"
                className="w-full h-10 text-destructive hover:text-destructive gap-2"
                onClick={() => setView("cancel")}
              >
                <XCircle className="h-4 w-4" />
                Não poderei comparecer
              </Button>
            </div>
          </>
        )}

        {/* Reschedule view */}
        {view === "reschedule" && (
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <h2 className="text-lg font-bold text-foreground mb-1">Reagendar visita</h2>
              <p className="text-xs text-muted-foreground mb-4">Escolha uma nova data e horário</p>

              <div className="mb-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) =>
                    isBefore(date, startOfDay(new Date())) ||
                    isBefore(addDays(new Date(), 7), date) ||
                    date.getDay() === 0
                  }
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto rounded-lg border border-border")}
                />
              </div>

              {selectedDate && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Horário</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIME_SLOTS.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={cn(
                          "px-2 py-1.5 rounded-md text-xs font-medium border transition-colors",
                          selectedTime === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setView("main")}>
                  Voltar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!selectedDate || !selectedTime || submitting}
                  onClick={handleReschedule}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancel view */}
        {view === "cancel" && (
          <Card className="border-destructive/20">
            <CardContent className="p-5">
              <h2 className="text-lg font-bold text-foreground mb-1">Cancelar visita</h2>
              <p className="text-xs text-muted-foreground mb-4">Lamentamos! Por favor, nos diga o motivo.</p>

              <div className="space-y-2 mb-4">
                {CANCEL_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setCancelReason(reason)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors",
                      cancelReason === reason
                        ? "bg-destructive/10 border-destructive/30 text-foreground font-medium"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setView("main"); setCancelReason(""); }}>
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  disabled={!cancelReason || submitting}
                  onClick={handleCancel}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancelar visita
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground mt-8">
          Uhome Sales · Sistema de gestão imobiliária
        </p>
      </div>
    </div>
  );
}
