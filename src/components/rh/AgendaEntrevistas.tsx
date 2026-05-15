import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Candidato {
  id: string;
  nome: string;
  etapa: string;
}

interface Entrevista {
  id: string;
  candidato_id: string;
  data_entrevista: string;
  local: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  candidato_nome?: string;
  candidato_etapa?: string;
}

interface Props {
  candidatos: Candidato[];
  onKanbanUpdate: () => void;
}

export default function AgendaEntrevistas({ candidatos, onKanbanUpdate }: Props) {
  const { user } = useAuth();
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [candidatoId, setCandidatoId] = useState("");
  const [dataEntrevista, setDataEntrevista] = useState("");
  const [horaEntrevista, setHoraEntrevista] = useState("10:00");
  const [local, setLocal] = useState("Escritório");
  const [observacoes, setObservacoes] = useState("");

  const fetchEntrevistas = async () => {
    const { data, error } = await supabase
      .from("rh_entrevistas" as any)
      .select("*")
      .order("data_entrevista", { ascending: true });
    if (!error && data) {
      const mapped = (data as any[]).map((e: any) => {
        const cand = candidatos.find(c => c.id === e.candidato_id);
        return {
          ...e,
          candidato_nome: cand?.nome || "Candidato removido",
          candidato_etapa: cand?.etapa,
        };
      });
      setEntrevistas(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (candidatos.length >= 0) fetchEntrevistas();
  }, [candidatos]);

  const handleAdd = async () => {
    if (!candidatoId || !dataEntrevista) {
      toast.error("Selecione candidato e data");
      return;
    }
    const dateTime = `${dataEntrevista}T${horaEntrevista}:00`;

    // Insert interview
    const { error } = await supabase.from("rh_entrevistas" as any).insert({
      candidato_id: candidatoId,
      data_entrevista: dateTime,
      local: local.trim() || "Escritório",
      observacoes: observacoes.trim() || null,
      status: "agendada",
      created_by: user?.id,
    });
    if (error) { toast.error("Erro: " + error.message); return; }

    // Update kanban to "entrevista_marcada"
    await supabase
      .from("rh_candidatos" as any)
      .update({ etapa: "entrevista_marcada", updated_at: new Date().toISOString() })
      .eq("id", candidatoId);

    toast.success("Entrevista agendada!");
    setDialogOpen(false);
    setCandidatoId("");
    setDataEntrevista("");
    setHoraEntrevista("10:00");
    setLocal("Escritório");
    setObservacoes("");
    fetchEntrevistas();
    onKanbanUpdate();
  };

  const marcarRealizada = async (entrevista: Entrevista) => {
    await supabase
      .from("rh_entrevistas" as any)
      .update({ status: "realizada", updated_at: new Date().toISOString() })
      .eq("id", entrevista.id);

    await supabase
      .from("rh_candidatos" as any)
      .update({ etapa: "entrevista_realizada", updated_at: new Date().toISOString() })
      .eq("id", entrevista.candidato_id);

    toast.success("Entrevista marcada como realizada!");
    fetchEntrevistas();
    onKanbanUpdate();
  };

  const marcarNaoCompareceu = async (entrevista: Entrevista) => {
    await supabase
      .from("rh_entrevistas" as any)
      .update({ status: "nao_compareceu", updated_at: new Date().toISOString() })
      .eq("id", entrevista.id);

    await supabase
      .from("rh_candidatos" as any)
      .update({ etapa: "sem_interesse", updated_at: new Date().toISOString() })
      .eq("id", entrevista.candidato_id);

    toast.success("Candidato marcado como não compareceu");
    fetchEntrevistas();
    onKanbanUpdate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "agendada": return <Badge className="bg-blue-500/15 text-blue-600 border-blue-200 text-[10px]"><Clock className="h-3 w-3 mr-1" />Agendada</Badge>;
      case "realizada": return <Badge className="bg-green-500/15 text-green-600 border-green-200 text-[10px]"><Check className="h-3 w-3 mr-1" />Realizada</Badge>;
      case "nao_compareceu": return <Badge className="bg-red-500/15 text-red-600 border-red-200 text-[10px]"><X className="h-3 w-3 mr-1" />Não compareceu</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const agendadas = entrevistas.filter(e => e.status === "agendada");
  const concluidas = entrevistas.filter(e => e.status !== "agendada");

  // Candidatos available for scheduling (not already with pending interview)
  const candidatosDisponiveis = candidatos.filter(c =>
    !agendadas.some(e => e.candidato_id === c.id) &&
    !["contratado", "sem_interesse"].includes(c.etapa)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Agenda de Entrevistas
          </CardTitle>
          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3 w-3" /> Agendar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Agendadas */}
        {agendadas.length === 0 && concluidas.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma entrevista agendada</p>
        )}

        {agendadas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Próximas</p>
            {agendadas.map(e => {
              const date = parseISO(e.data_entrevista);
              const overdue = isPast(date) && e.status === "agendada";
              return (
                <div
                  key={e.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${overdue ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.candidato_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {getDateLabel(e.data_entrevista)} às {format(date, "HH:mm")} · {e.local}
                    </p>
                    {e.observacoes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-green-300 text-green-600 hover:bg-green-50"
                      onClick={() => marcarRealizada(e)}
                    >
                      <Check className="h-3 w-3" /> Realizada
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => marcarNaoCompareceu(e)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Concluídas */}
        {concluidas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</p>
            {concluidas.slice(0, 5).map(e => {
              const date = parseISO(e.data_entrevista);
              return (
                <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{e.candidato_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {e.local}
                    </p>
                  </div>
                  {getStatusBadge(e.status)}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog Agendar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Entrevista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Candidato *</Label>
              <Select value={candidatoId} onValueChange={setCandidatoId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {candidatosDisponiveis.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={dataEntrevista} onChange={e => setDataEntrevista(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Hora</Label>
                <Input type="time" value={horaEntrevista} onChange={e => setHoraEntrevista(e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Local</Label>
              <Input value={local} onChange={e => setLocal(e.target.value)} className="h-9" placeholder="Escritório" />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="h-16" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd}>Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
