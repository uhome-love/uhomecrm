import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, Users, FileText, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Comissao {
  id: string;
  pipeline_lead_id: string;
  corretor_id: string;
  papel: string;
  percentual: number;
  valor_comissao: number | null;
  registrado_por: string;
  created_at: string;
}

const PAPEL_MAP: Record<string, { label: string; color: string }> = {
  principal: { label: "Principal", color: "bg-primary/10 text-primary border-primary/30" },
  parceiro: { label: "Parceiro", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  captador: { label: "Captador", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
};

interface Props {
  pipelineLeadId: string;
  valorEstimado: number | null;
  corretorNomes: Record<string, string>;
}

export default function OpportunityPropostasTab({ pipelineLeadId, valorEstimado, corretorNomes }: Props) {
  const { user } = useAuth();
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newComissao, setNewComissao] = useState({ corretor_id: "", papel: "principal", percentual: 6 });

  const loadComissoes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pipeline_comissoes")
      .select("*")
      .eq("pipeline_lead_id", pipelineLeadId)
      .order("created_at", { ascending: true });
    setComissoes((data || []) as Comissao[]);
    setLoading(false);
  }, [pipelineLeadId]);

  useEffect(() => { loadComissoes(); }, [loadComissoes]);

  const handleAdd = async () => {
    if (!user || !newComissao.corretor_id) return;
    setSaving(true);
    const valorCalc = valorEstimado ? (valorEstimado * newComissao.percentual) / 100 : null;
    const { error } = await supabase.from("pipeline_comissoes").insert({
      pipeline_lead_id: pipelineLeadId,
      corretor_id: newComissao.corretor_id,
      papel: newComissao.papel,
      percentual: newComissao.percentual,
      valor_comissao: valorCalc,
      registrado_por: user.id,
    });
    if (error) {
      toast.error("Erro ao registrar comissão");
    } else {
      toast.success("Comissão registrada");
      setShowAdd(false);
      setNewComissao({ corretor_id: "", papel: "principal", percentual: 6 });
      loadComissoes();
    }
    setSaving(false);
  };

  const totalPercent = comissoes.reduce((s, c) => s + c.percentual, 0);
  const totalValor = comissoes.reduce((s, c) => s + (c.valor_comissao || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Clock className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const corretorEntries = Object.entries(corretorNomes).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <h4 className="text-[11px] font-bold text-primary flex items-center gap-1.5 mb-2">
          <DollarSign className="h-3.5 w-3.5" /> Resumo Financeiro
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="text-[10px] text-muted-foreground">VGV Estimado</span>
            <p className="text-sm font-bold text-foreground">
              {valorEstimado ? `R$ ${valorEstimado.toLocaleString("pt-BR")}` : "—"}
            </p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Comissão Total</span>
            <p className="text-sm font-bold text-foreground">{totalPercent.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Valor Comissão</span>
            <p className="text-sm font-bold text-primary">
              {totalValor > 0 ? `R$ ${totalValor.toLocaleString("pt-BR")}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Comissões list */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Participantes ({comissoes.length})
        </h4>
        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>

      {showAdd && (
        <div className="border border-primary/30 rounded-lg p-3 space-y-2 bg-primary/5">
          <div>
            <Label className="text-[10px]">Corretor</Label>
            <Select value={newComissao.corretor_id} onValueChange={v => setNewComissao(p => ({ ...p, corretor_id: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {corretorEntries.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Papel</Label>
              <Select value={newComissao.papel} onValueChange={v => setNewComissao(p => ({ ...p, papel: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                  <SelectItem value="captador">Captador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Percentual (%)</Label>
              <Input type="number" step="0.5" className="h-8 text-xs" value={newComissao.percentual} onChange={e => setNewComissao(p => ({ ...p, percentual: Number(e.target.value) }))} />
            </div>
          </div>
          <Button size="sm" className="w-full h-8 text-xs" onClick={handleAdd} disabled={saving || !newComissao.corretor_id}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Registrar Comissão"}
          </Button>
        </div>
      )}

      {comissoes.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <FileText className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <span className="text-xs text-muted-foreground">Nenhuma comissão registrada</span>
        </div>
      ) : (
        <div className="space-y-2">
          {comissoes.map(c => {
            const papelInfo = PAPEL_MAP[c.papel] || PAPEL_MAP.principal;
            return (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {corretorNomes[c.corretor_id] || "Corretor"}
                    </span>
                    <Badge variant="outline" className={`text-[9px] h-4 ${papelInfo.color}`}>
                      {papelInfo.label}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {c.percentual}%
                    {c.valor_comissao ? ` • R$ ${c.valor_comissao.toLocaleString("pt-BR")}` : ""}
                    {" • "}
                    {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
