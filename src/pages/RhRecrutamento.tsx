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
import { UserPlus, Phone, Mail } from "lucide-react";
import { toast } from "sonner";


const ETAPAS = [
  { key: "novo_lead", label: "Novo Lead", color: "#3B82F6" },
  { key: "contato_iniciado", label: "Contato Iniciado", color: "#8B5CF6" },
  { key: "interessado", label: "Interessado", color: "#F59E0B" },
  { key: "entrevista_marcada", label: "Entrevista Marcada", color: "#F97316" },
  { key: "entrevista_realizada", label: "Entrevista Realizada", color: "#10B981" },
  { key: "contratado", label: "Contratado", color: "#22C55E" },
  { key: "sem_interesse", label: "Não Tem Interesse", color: "#EF4444" },
];

interface Candidato {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  observacoes: string | null;
  etapa: string;
  created_at: string;
}

export default function RhRecrutamento() {
  const { user } = useAuth();
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidato | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("whatsapp");
  const [observacoes, setObservacoes] = useState("");

  const fetchCandidatos = async () => {
    const { data, error } = await supabase.from("rh_candidatos" as any).select("*").order("created_at", { ascending: false });
    if (!error) setCandidatos((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchCandidatos(); }, []);

  const handleAdd = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const { error } = await supabase.from("rh_candidatos" as any).insert({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      origem,
      observacoes: observacoes.trim() || null,
      etapa: "novo_lead",
      created_by: user?.id,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Candidato adicionado!");
    setDialogOpen(false);
    setNome(""); setTelefone(""); setEmail(""); setOrigem("whatsapp"); setObservacoes("");
    fetchCandidatos();
  };

  const moveToEtapa = async (id: string, etapa: string) => {
    const { error } = await supabase.from("rh_candidatos" as any).update({ etapa, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Erro ao mover"); return; }
    fetchCandidatos();
  };

  const getCandidatosByEtapa = (etapa: string) => candidatos.filter(c => c.etapa === etapa);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">👥 Candidatos</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1">
          <UserPlus className="h-4 w-4" /> Novo Candidato
        </Button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "40vh" }}>
        {ETAPAS.map(etapa => {
          const items = getCandidatosByEtapa(etapa.key);
          return (
            <div key={etapa.key} className="min-w-[220px] max-w-[220px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: etapa.color }} />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">{etapa.label}</span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map(c => (
                  <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow bg-card" onClick={() => setDetailCandidate(c)}>
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                      {c.telefone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.telefone}
                        </p>
                      )}
                      {c.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {c.email}
                        </p>
                      )}
                      {c.origem && <Badge variant="outline" className="text-[10px]">{c.origem}</Badge>}
                    </CardContent>
                  </Card>
                ))}
                {items.length === 0 && (
                  <div className="border border-dashed border-border rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">Nenhum candidato</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>


      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Candidato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} className="h-9" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">E-mail</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="h-9" /></div>
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Observações</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailCandidate} onOpenChange={() => setDetailCandidate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{detailCandidate?.nome}</DialogTitle></DialogHeader>
          {detailCandidate && (
            <div className="space-y-3">
              {detailCandidate.telefone && <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" /> {detailCandidate.telefone}</p>}
              {detailCandidate.email && <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" /> {detailCandidate.email}</p>}
              {detailCandidate.origem && <p className="text-sm text-muted-foreground">Origem: <Badge variant="outline">{detailCandidate.origem}</Badge></p>}
              {detailCandidate.observacoes && <p className="text-sm text-muted-foreground bg-muted p-2 rounded">{detailCandidate.observacoes}</p>}
              <div>
                <Label className="text-xs font-bold">Mover para etapa:</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ETAPAS.filter(e => e.key !== detailCandidate.etapa).map(e => (
                    <Button
                      key={e.key} size="sm" variant="outline" className="text-xs h-7"
                      style={{ borderColor: e.color, color: e.color }}
                      onClick={() => { moveToEtapa(detailCandidate.id, e.key); setDetailCandidate(null); }}
                    >
                      {e.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
