import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, Clock, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const HORARIOS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30",
];

interface Reserva {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  responsavel: string;
  assunto: string | null;
  created_at: string;
}

export default function RhSalaReuniao() {
  const { user } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState<Reserva | null>(null);

  // Form
  const [data, setData] = useState(selectedDate);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("10:00");
  const [responsavel, setResponsavel] = useState("");
  const [assunto, setAssunto] = useState("");

  const fetchReservas = async () => {
    const { data: res, error } = await supabase
      .from("sala_reuniao_reservas" as any)
      .select("*")
      .eq("data", selectedDate)
      .order("hora_inicio");
    if (!error) setReservas((res || []) as any);
  };

  useEffect(() => { fetchReservas(); }, [selectedDate]);

  const openAdd = () => {
    setEditingReserva(null);
    setData(selectedDate);
    setHoraInicio("09:00");
    setHoraFim("10:00");
    setResponsavel("");
    setAssunto("");
    setDialogOpen(true);
  };

  const openEdit = (r: Reserva) => {
    setEditingReserva(r);
    setData(r.data);
    setHoraInicio(r.hora_inicio);
    setHoraFim(r.hora_fim);
    setResponsavel(r.responsavel);
    setAssunto(r.assunto || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!responsavel.trim()) { toast.error("Responsável é obrigatório"); return; }
    if (horaInicio >= horaFim) { toast.error("Horário de fim deve ser após o início"); return; }

    // Check overlap (exclude current reservation if editing)
    const overlap = reservas.some(r =>
      r.hora_inicio < horaFim && r.hora_fim > horaInicio &&
      (!editingReserva || r.id !== editingReserva.id)
    );
    if (overlap && data === selectedDate) { toast.error("Conflito de horário! Já existe reserva neste período."); return; }

    if (editingReserva) {
      const { error } = await supabase.from("sala_reuniao_reservas" as any).update({
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        responsavel: responsavel.trim(),
        assunto: assunto.trim() || null,
      }).eq("id", editingReserva.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Reserva atualizada!");
    } else {
      const { error } = await supabase.from("sala_reuniao_reservas" as any).insert({
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        responsavel: responsavel.trim(),
        assunto: assunto.trim() || null,
        created_by: user?.id,
      });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Reserva criada!");
    }

    setDialogOpen(false);
    setEditingReserva(null);
    setResponsavel(""); setAssunto("");
    if (data === selectedDate) fetchReservas();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sala_reuniao_reservas" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao cancelar"); return; }
    toast.success("Reserva cancelada");
    fetchReservas();
  };

  const isSlotOccupied = (hora: string) => {
    return reservas.find(r => r.hora_inicio <= hora && r.hora_fim > hora);
  };

  // Week navigation
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const base = new Date(selectedDate + "T12:00:00");
    const dayOfWeek = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">🏢 Sala de Reunião</h1>
          <p className="text-sm text-muted-foreground">Reservas e horários — Horário comercial (8h–18h)</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Nova Reserva
        </Button>
      </div>

      {/* Week selector */}
      <div className="flex gap-2">
        {weekDays.map(d => {
          const dt = new Date(d + "T12:00:00");
          const isSelected = d === selectedDate;
          return (
            <Button
              key={d}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className="flex-1 flex flex-col h-auto py-2"
              onClick={() => setSelectedDate(d)}
            >
              <span className="text-[10px] uppercase">{format(dt, "EEE", { locale: ptBR })}</span>
              <span className="text-lg font-bold">{format(dt, "dd")}</span>
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {format(new Date(selectedDate + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {HORARIOS.map(hora => {
              const reserva = isSlotOccupied(hora);
              const isStart = reserva && reserva.hora_inicio === hora;
              return (
                <div key={hora} className={`flex items-center gap-2 sm:gap-3 py-1.5 px-2 rounded ${reserva ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                  <span className="text-xs font-mono text-muted-foreground w-10 sm:w-12 shrink-0">{hora}</span>
                  {isStart ? (
                    <div className="flex-1 flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-2 sm:px-3 py-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{reserva.responsavel}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{reserva.hora_inicio} – {reserva.hora_fim}</span>
                          {reserva.assunto && <span className="truncate">· {reserva.assunto}</span>}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(reserva)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(reserva.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : reserva ? (
                    <div className="flex-1 border-l-2 border-primary/20 pl-3">
                      <span className="text-xs text-muted-foreground italic">Ocupado — {reserva.responsavel}</span>
                    </div>
                  ) : (
                    <div className="flex-1 border-l-2 border-transparent pl-3 cursor-pointer" onClick={openAdd}>
                      <span className="text-xs text-muted-foreground/30">Disponível</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReserva ? "Editar Reserva" : "Nova Reserva"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Data</Label><Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Select value={horaInicio} onValueChange={setHoraInicio}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">{HORARIOS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Select value={horaFim} onValueChange={setHoraFim}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">{HORARIOS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Responsável *</Label><Input value={responsavel} onChange={e => setResponsavel(e.target.value)} className="h-10" /></div>
            <div><Label className="text-xs">Assunto</Label><Input value={assunto} onChange={e => setAssunto(e.target.value)} className="h-10" placeholder="Opcional" /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>{editingReserva ? "Salvar" : "Reservar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
