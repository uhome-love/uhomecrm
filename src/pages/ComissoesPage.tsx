import { useState } from "react";
import { formatCurrencyInput, parseCurrencyToNumber, numberToRawCurrency } from "@/utils/currencyFormat";
import { useComissaoFaixas } from "@/hooks/useBackofficeData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, Edit2, Plus, Trash2, Loader2, AlertTriangle, Target } from "lucide-react";
import { toast } from "sonner";

export default function ComissoesPage() {
  const { faixas, isLoading, upsertFaixa, deleteFaixa } = useComissaoFaixas();
  const [editOpen, setEditOpen] = useState(false);
  const [editFaixa, setEditFaixa] = useState<any>(null);

  // Get team members and their VGV
  const { data: corretores = [] } = useQuery({
    queryKey: ["comissoes-corretores"],
    queryFn: async () => {
      const { data: members } = await supabase
        .from("team_members")
        .select("id, nome, user_id")
        .eq("status", "ativo");

      if (!members) return [];

      // Get pagadorias for each
      const { data: pags } = await supabase
        .from("pagadoria_credores" as any)
        .select("credor_id, valor, pagadoria_id");

      const vgvMap: Record<string, number> = {};
      const comissaoMap: Record<string, { pago: number; pendente: number }> = {};

      (pags || []).forEach((p: any) => {
        if (p.credor_id) {
          vgvMap[p.credor_id] = (vgvMap[p.credor_id] || 0) + Number(p.valor || 0);
        }
      });

      return members.map(m => ({
        ...m,
        vgv_acumulado: vgvMap[m.user_id || m.id] || 0,
        comissao_paga: 0,
        comissao_pendente: vgvMap[m.user_id || m.id] || 0,
      }));
    },
  });

  const getFaixaAtual = (vgv: number) => {
    const sorted = [...faixas].sort((a, b) => b.vgv_min - a.vgv_min);
    return sorted.find(f => vgv >= f.vgv_min) || faixas[0];
  };

  const getProximaFaixa = (vgv: number) => {
    const sorted = [...faixas].sort((a, b) => a.vgv_min - b.vgv_min);
    return sorted.find(f => f.vgv_min > vgv);
  };

  const handleSaveFaixa = async () => {
    if (!editFaixa) return;
    try {
      await upsertFaixa.mutateAsync(editFaixa);
      toast.success("Faixa salva!");
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> Controle de Comissões
          </h1>
          <p className="text-sm text-muted-foreground">Faixas, VGV acumulado e comissões por corretor</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEditFaixa({ nome: "", vgv_min: 0, vgv_max: null, percentual: 30 }); setEditOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Faixa
        </Button>
      </div>

      {/* Faixas reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tabela de Faixas de Comissão</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : (
            <div className="flex gap-3 flex-wrap">
              {faixas.map((f: any) => (
                <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-sm">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {f.vgv_max
                      ? `R$ ${Number(f.vgv_min).toLocaleString("pt-BR")} – ${Number(f.vgv_max).toLocaleString("pt-BR")}`
                      : `Acima de R$ ${Number(f.vgv_min).toLocaleString("pt-BR")}`
                    }
                  </span>
                  <span className="font-bold text-primary">→ {f.percentual}%</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditFaixa(f); setEditOpen(true); }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Corretores */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Por Corretor</h2>
        {corretores.map((c: any) => {
          const faixa = getFaixaAtual(c.vgv_acumulado);
          const proxima = getProximaFaixa(c.vgv_acumulado);
          const progPct = proxima ? Math.min(100, (c.vgv_acumulado / proxima.vgv_min) * 100) : 100;
          const falta = proxima ? proxima.vgv_min - c.vgv_acumulado : 0;

          return (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      VGV acumulado 2025: <strong className="text-foreground">R$ {Number(c.vgv_acumulado).toLocaleString("pt-BR")}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{faixa?.percentual || 0}%</p>
                    <p className="text-xs text-muted-foreground">faixa atual</p>
                  </div>
                </div>
                {proxima && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progresso para {proxima.percentual}%</span>
                      <span>Falta R$ {falta.toLocaleString("pt-BR")}</span>
                    </div>
                    <Progress value={progPct} className="h-2" />
                    {falta <= 200000 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <Target className="h-3 w-3" /> Próximo(a) de mudar de faixa!
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Faixa Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editFaixa?.id ? "Editar Faixa" : "Nova Faixa"}</DialogTitle>
          </DialogHeader>
          {editFaixa && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editFaixa.nome} onChange={e => setEditFaixa((f: any) => ({ ...f, nome: e.target.value }))} /></div>
              <div><Label>VGV Mínimo (R$)</Label><Input value={formatCurrencyInput(numberToRawCurrency(editFaixa.vgv_min))} onChange={e => setEditFaixa((f: any) => ({ ...f, vgv_min: parseCurrencyToNumber(e.target.value) }))} inputMode="numeric" /></div>
              <div><Label>VGV Máximo (R$) — vazio = ilimitado</Label><Input value={editFaixa.vgv_max != null ? formatCurrencyInput(numberToRawCurrency(editFaixa.vgv_max)) : ""} onChange={e => { const v = e.target.value; setEditFaixa((f: any) => ({ ...f, vgv_max: v ? parseCurrencyToNumber(v) : null })); }} inputMode="numeric" /></div>
              <div><Label>Percentual (%)</Label><Input type="number" step="0.5" value={editFaixa.percentual} onChange={e => setEditFaixa((f: any) => ({ ...f, percentual: Number(e.target.value) }))} /></div>
              <div className="flex justify-between">
                {editFaixa.id && (
                  <Button variant="destructive" size="sm" onClick={async () => { await deleteFaixa.mutateAsync(editFaixa.id); setEditOpen(false); toast.success("Faixa removida"); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                )}
                <Button onClick={handleSaveFaixa} className="ml-auto">Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
