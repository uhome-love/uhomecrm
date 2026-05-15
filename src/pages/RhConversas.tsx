import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPOS = [
  { value: "feedback", label: "Feedback", color: "#4969FF" },
  { value: "pdi", label: "PDI", color: "#8B5CF6" },
  { value: "conflito", label: "Conflito", color: "#EF4444" },
  { value: "onboarding", label: "Onboarding", color: "#10B981" },
  { value: "desligamento", label: "Desligamento", color: "#F59E0B" },
  { value: "outro", label: "Outro", color: "#6B7280" },
];

interface Conversa {
  id: string;
  colaborador_nome: string;
  data_conversa: string;
  tipo: string;
  resumo: string | null;
  created_at: string;
}

export default function RhConversas() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; nome: string }[]>([]);

  // Form
  const [colaboradorId, setColaboradorId] = useState("");
  const [colaboradorNome, setColaboradorNome] = useState("");
  const [dataConversa, setDataConversa] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [tipo, setTipo] = useState("feedback");
  const [resumo, setResumo] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const [r1, r2] = await Promise.all([
        supabase.from("rh_conversas" as any).select("*").order("data_conversa", { ascending: false }),
        supabase.from("profiles").select("id, nome").order("nome"),
      ]);
      if (!r1.error) setConversas((r1.data || []) as any);
      if (!r2.error) setProfiles((r2.data || []) as any);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleAdd = async () => {
    if (!colaboradorNome.trim()) { toast.error("Selecione o colaborador"); return; }
    const { error } = await supabase.from("rh_conversas" as any).insert({
      colaborador_id: colaboradorId || null,
      colaborador_nome: colaboradorNome.trim(),
      data_conversa: dataConversa,
      tipo,
      resumo: resumo.trim() || null,
      created_by: user?.id,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Conversa registrada!");
    setDialogOpen(false);
    setColaboradorId(""); setColaboradorNome(""); setResumo(""); setTipo("feedback");
    const { data } = await supabase.from("rh_conversas" as any).select("*").order("data_conversa", { ascending: false });
    if (data) setConversas(data as any);
  };

  const getTipoInfo = (t: string) => TIPOS.find(tp => tp.value === t) || TIPOS[5];

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">💬 Conversas 1:1</h1>
          <p className="text-sm text-muted-foreground">Registros de reuniões com corretores e gerentes</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Nova Conversa
        </Button>
      </div>

      <div className="space-y-3">
        {conversas.map(c => {
          const tipoInfo = getTipoInfo(c.tipo);
          return (
            <Card key={c.id} className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: tipoInfo.color }}>
                      {c.colaborador_nome?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.colaborador_nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: tipoInfo.color, color: tipoInfo.color }}>{tipoInfo.label}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(c.data_conversa + "T12:00:00"), "dd/MM/yyyy")}
                        </span>
                      </div>
                      {c.resumo && <p className="text-sm text-muted-foreground mt-2 bg-muted p-2 rounded">{c.resumo}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {conversas.length === 0 && !loading && (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa registrada</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Conversa 1:1</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Colaborador *</Label>
              <Select value={colaboradorId} onValueChange={v => {
                setColaboradorId(v);
                const p = profiles.find(p => p.id === v);
                if (p) setColaboradorNome(p.nome);
              }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Data</Label><Input type="date" value={dataConversa} onChange={e => setDataConversa(e.target.value)} className="h-9" /></div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Resumo da conversa</Label><Textarea value={resumo} onChange={e => setResumo(e.target.value)} className="h-24" placeholder="O que foi discutido..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
