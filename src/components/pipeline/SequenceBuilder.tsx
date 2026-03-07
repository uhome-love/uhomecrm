import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Trash2, Loader2, Zap, MessageSquare, FileText,
  Clock, ArrowDown, Mail, Phone, ChevronRight, Edit, GripVertical
} from "lucide-react";

interface Sequencia {
  id: string;
  nome: string;
  descricao: string | null;
  empreendimento: string | null;
  stage_gatilho: string;
  ativa: boolean;
  created_at: string;
}

interface Passo {
  id: string;
  sequencia_id: string;
  ordem: number;
  dias_apos_inicio: number;
  tipo: string;
  titulo: string;
  conteudo: string | null;
  canal: string;
  ativo: boolean;
}

const STAGE_GATILHOS = [
  { value: "novo_lead", label: "Novo Lead" },
  { value: "sem_contato", label: "Sem Contato" },
  { value: "contato_inicial", label: "Contato Inicial" },
  { value: "atendimento", label: "Atendimento" },
  { value: "qualificacao", label: "Qualificação" },
  { value: "possibilidade_visita", label: "Possibilidade de Visita" },
  { value: "visita_marcada", label: "Visita Marcada" },
  { value: "visita_realizada", label: "Visita Realizada" },
  { value: "negociacao", label: "Negociação" },
  { value: "proposta", label: "Proposta" },
];

const PASSO_TIPOS = [
  { value: "mensagem", label: "Mensagem", icon: MessageSquare },
  { value: "material", label: "Envio de Material", icon: FileText },
  { value: "lembrete", label: "Lembrete Follow-up", icon: Clock },
];

const CANAIS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "ligacao", label: "Ligação" },
];

export default function SequenceBuilder() {
  const { user } = useAuth();
  const [sequencias, setSequencias] = useState<Sequencia[]>([]);
  const [selectedSeq, setSelectedSeq] = useState<Sequencia | null>(null);
  const [passos, setPassos] = useState<Passo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addPassoOpen, setAddPassoOpen] = useState(false);

  // New sequence form
  const [seqForm, setSeqForm] = useState({ nome: "", descricao: "", empreendimento: "", stage_gatilho: "novo_lead" });

  // New step form
  const [passoForm, setPassoForm] = useState({ dias_apos_inicio: 0, tipo: "mensagem", titulo: "", conteudo: "", canal: "whatsapp" });

  const loadSequencias = useCallback(async () => {
    const { data } = await supabase
      .from("pipeline_sequencias")
      .select("*")
      .order("created_at", { ascending: false });
    setSequencias((data || []) as Sequencia[]);
    setLoading(false);
  }, []);

  const loadPassos = useCallback(async (seqId: string) => {
    const { data } = await supabase
      .from("pipeline_sequencia_passos")
      .select("*")
      .eq("sequencia_id", seqId)
      .order("ordem");
    setPassos((data || []) as Passo[]);
  }, []);

  useEffect(() => { loadSequencias(); }, [loadSequencias]);
  useEffect(() => { if (selectedSeq) loadPassos(selectedSeq.id); }, [selectedSeq, loadPassos]);

  const handleCreateSeq = async () => {
    if (!user || !seqForm.nome) return;
    const { error } = await supabase.from("pipeline_sequencias").insert({
      nome: seqForm.nome,
      descricao: seqForm.descricao || null,
      empreendimento: seqForm.empreendimento || null,
      stage_gatilho: seqForm.stage_gatilho,
      criado_por: user.id,
    });
    if (error) { toast.error("Erro ao criar sequência"); return; }
    toast.success("Sequência criada!");
    setAddOpen(false);
    setSeqForm({ nome: "", descricao: "", empreendimento: "", stage_gatilho: "novo_lead" });
    loadSequencias();
  };

  const handleAddPasso = async () => {
    if (!selectedSeq || !passoForm.titulo) return;
    const { error } = await supabase.from("pipeline_sequencia_passos").insert({
      sequencia_id: selectedSeq.id,
      ordem: passos.length,
      dias_apos_inicio: passoForm.dias_apos_inicio,
      tipo: passoForm.tipo,
      titulo: passoForm.titulo,
      conteudo: passoForm.conteudo || null,
      canal: passoForm.canal,
    });
    if (error) { toast.error("Erro ao adicionar passo"); return; }
    toast.success("Passo adicionado!");
    setAddPassoOpen(false);
    setPassoForm({ dias_apos_inicio: 0, tipo: "mensagem", titulo: "", conteudo: "", canal: "whatsapp" });
    loadPassos(selectedSeq.id);
  };

  const handleDeletePasso = async (id: string) => {
    await supabase.from("pipeline_sequencia_passos").delete().eq("id", id);
    if (selectedSeq) loadPassos(selectedSeq.id);
  };

  const handleToggleSeq = async (seq: Sequencia) => {
    await supabase.from("pipeline_sequencias").update({ ativa: !seq.ativa } as any).eq("id", seq.id);
    loadSequencias();
  };

  const handleDeleteSeq = async (id: string) => {
    await supabase.from("pipeline_sequencias").delete().eq("id", id);
    if (selectedSeq?.id === id) { setSelectedSeq(null); setPassos([]); }
    loadSequencias();
    toast.success("Sequência removida");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex gap-4 h-full min-h-[500px]">
      {/* Left panel: Sequences list */}
      <div className="w-72 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Sequências</h3>
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" /> Nova
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="space-y-2 pr-2">
            {sequencias.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma sequência criada</p>
            )}
            {sequencias.map(seq => (
              <Card
                key={seq.id}
                className={`p-3 cursor-pointer transition-all hover:shadow-md ${selectedSeq?.id === seq.id ? "ring-2 ring-primary border-primary" : ""}`}
                onClick={() => setSelectedSeq(seq)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold truncate">{seq.nome}</h4>
                    {seq.empreendimento && (
                      <Badge variant="outline" className="text-[9px] mt-1">{seq.empreendimento}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={seq.ativa ? "default" : "secondary"} className="text-[9px] px-1.5">
                      {seq.ativa ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Badge variant="secondary" className="text-[9px]">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    {STAGE_GATILHOS.find(s => s.value === seq.stage_gatilho)?.label || seq.stage_gatilho}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel: Steps editor */}
      <div className="flex-1 min-w-0">
        {!selectedSeq ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Zap className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Selecione uma sequência para editar</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">{selectedSeq.nome}</h3>
                {selectedSeq.descricao && <p className="text-xs text-muted-foreground">{selectedSeq.descricao}</p>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Ativa</Label>
                  <Switch checked={selectedSeq.ativa} onCheckedChange={() => handleToggleSeq(selectedSeq)} />
                </div>
                <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => handleDeleteSeq(selectedSeq.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Steps timeline */}
            <div className="space-y-1">
              {passos.map((passo, idx) => {
                const TipoIcon = PASSO_TIPOS.find(t => t.value === passo.tipo)?.icon || MessageSquare;
                return (
                  <div key={passo.id} className="group">
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <TipoIcon className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{passo.titulo}</span>
                          <Badge variant="secondary" className="text-[9px]">Dia {passo.dias_apos_inicio}</Badge>
                          <Badge variant="outline" className="text-[9px]">{passo.canal}</Badge>
                        </div>
                        {passo.conteudo && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{passo.conteudo}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => handleDeletePasso(passo.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {idx < passos.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button variant="outline" size="sm" onClick={() => setAddPassoOpen(true)} className="gap-1.5 w-full border-dashed">
              <Plus className="h-3.5 w-3.5" /> Adicionar Passo
            </Button>
          </div>
        )}
      </div>

      {/* New Sequence Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Nova Sequência
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={seqForm.nome} onChange={e => setSeqForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Nutrição Casa Tua" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={seqForm.descricao} onChange={e => setSeqForm(p => ({ ...p, descricao: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Empreendimento</Label>
                <Input value={seqForm.empreendimento} onChange={e => setSeqForm(p => ({ ...p, empreendimento: e.target.value }))} placeholder="Opcional" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Gatilho (Etapa)</Label>
                <Select value={seqForm.stage_gatilho} onValueChange={v => setSeqForm(p => ({ ...p, stage_gatilho: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_GATILHOS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSeq} disabled={!seqForm.nome}>Criar Sequência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Step Dialog */}
      <Dialog open={addPassoOpen} onOpenChange={setAddPassoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Novo Passo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={passoForm.titulo} onChange={e => setPassoForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Mensagem de boas-vindas" className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Dia</Label>
                <Input type="number" min={0} value={passoForm.dias_apos_inicio} onChange={e => setPassoForm(p => ({ ...p, dias_apos_inicio: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={passoForm.tipo} onValueChange={v => setPassoForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PASSO_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={passoForm.canal} onValueChange={v => setPassoForm(p => ({ ...p, canal: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Conteúdo / Mensagem</Label>
              <Textarea value={passoForm.conteudo} onChange={e => setPassoForm(p => ({ ...p, conteudo: e.target.value }))} placeholder="Texto da mensagem ou instruções..." className="mt-1" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPassoOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddPasso} disabled={!passoForm.titulo}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
