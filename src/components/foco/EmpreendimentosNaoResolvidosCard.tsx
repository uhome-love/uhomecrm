import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, AlertTriangle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpreendimentosCanonicos } from "@/hooks/useFocoCorretores";

type NaoResolvido = {
  texto: string;
  tipo: string;
  leads_count: number;
  ultimo_lead_at: string;
};

type IaSuggestion = {
  empreendimento_id: string | null;
  empreendimento_nome: string | null;
  confianca: "alta" | "media" | "baixa";
  motivo: string;
};

export function EmpreendimentosNaoResolvidosCard() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<NaoResolvido | null>(null);
  const [manualEmpId, setManualEmpId] = useState<string>("");
  const [suggestion, setSuggestion] = useState<IaSuggestion | null>(null);
  const [loadingIa, setLoadingIa] = useState(false);

  const { data: emps = [] } = useEmpreendimentosCanonicos({ includeInactive: false });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["empreendimentos-nao-resolvidos"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_empreendimentos_nao_resolvidos", { p_dias: 30 });
      if (error) throw error;
      return (data as NaoResolvido[]) || [];
    },
    refetchInterval: 5 * 60_000,
  });

  const vincular = useMutation({
    mutationFn: async ({ texto, tipo, empId }: { texto: string; tipo: string; empId: string }) => {
      const { data, error } = await supabase.rpc("vincular_alias_com_backfill", {
        p_texto: texto,
        p_tipo: tipo,
        p_empreendimento_id: empId,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`Vinculado! ${data?.backfilled_leads || 0} lead(s) recuperados.`);
      qc.invalidateQueries({ queryKey: ["empreendimentos-nao-resolvidos"] });
      setSelected(null);
      setSuggestion(null);
      setManualEmpId("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao vincular"),
  });

  const openModal = async (row: NaoResolvido) => {
    setSelected(row);
    setSuggestion(null);
    setManualEmpId("");
    setLoadingIa(true);
    try {
      const { data, error } = await supabase.functions.invoke("homi-suggest-empreendimento-match", {
        body: { texto: row.texto },
      });
      if (error) throw error;
      const s = data as IaSuggestion;
      setSuggestion(s);
      if (s.empreendimento_id) setManualEmpId(s.empreendimento_id);
    } catch {
      setSuggestion({ empreendimento_id: null, empreendimento_nome: null, confianca: "baixa", motivo: "IA indisponível" });
    }
    setLoadingIa(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground text-center">
          ✅ Todos os leads dos últimos 30 dias estão vinculados a empreendimentos canônicos.
        </CardContent>
      </Card>
    );
  }

  const confiancaColor = (c: string) =>
    c === "alta" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : c === "media" ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
        : "bg-muted text-muted-foreground";

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Empreendimentos sem match
            <Badge variant="secondary" className="text-[10px]">{rows.length}</Badge>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Textos de campanhas/anúncios que apareceram nos últimos 30 dias e não bateram com nenhum empreendimento canônico.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {rows.map((r) => (
              <div key={`${r.tipo}-${r.texto}`} className="flex items-center gap-2 p-2 rounded border border-border hover:bg-accent/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] px-1 shrink-0">{r.tipo}</Badge>
                    <span className="text-xs font-medium truncate">{r.texto}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{r.leads_count} lead{r.leads_count > 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(r.ultimo_lead_at), { locale: ptBR, addSuffix: true })}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openModal(r)} className="gap-1 h-7 text-[11px]">
                  <Link2 className="h-3 w-3" /> Vincular
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Vincular a um empreendimento</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="p-2 rounded bg-muted text-xs">
                <div className="text-[10px] text-muted-foreground mb-0.5">Texto bruto ({selected.tipo})</div>
                <div className="font-mono break-all">{selected.texto}</div>
              </div>

              <div className="p-3 rounded border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Sugestão da IA</span>
                  {suggestion && (
                    <Badge className={`text-[9px] ${confiancaColor(suggestion.confianca)}`}>
                      {suggestion.confianca}
                    </Badge>
                  )}
                </div>
                {loadingIa ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Analisando...
                  </div>
                ) : suggestion?.empreendimento_id ? (
                  <div className="text-xs">
                    <div className="font-medium">{suggestion.empreendimento_nome}</div>
                    {suggestion.motivo && <div className="text-[10px] text-muted-foreground mt-0.5">{suggestion.motivo}</div>}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    Sem sugestão confiável. Selecione manualmente abaixo.
                    {suggestion?.motivo && <div className="mt-0.5">{suggestion.motivo}</div>}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Empreendimento canônico</label>
                <Select value={manualEmpId} onValueChange={setManualEmpId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emps.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-sm">
                        {e.nome} {e.segmento_nome && <span className="text-muted-foreground">· {e.segmento_nome}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button
              disabled={!manualEmpId || vincular.isPending}
              onClick={() => selected && vincular.mutate({ texto: selected.texto, tipo: selected.tipo, empId: manualEmpId })}
            >
              {vincular.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Vincular e reprocessar leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
