/** Depois de escolher a origem: Listas escolhe campanhas; Bolsão escolhe empreendimentos. Vazio = todos. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCampanhasDisponiveis } from "@/hooks/useCampanhasDisponiveis";
import { cn } from "@/lib/utils";
import { ORIGEM_INFO, type OrigemOA } from "./tipos";

interface Opcao { id: string; nome: string; total: number }

function lerSalvo(chave: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(chave) || "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
}

export default function FiltroOrigem({ origem, onFechar, onComecar }: { origem: OrigemOA | null; onFechar: () => void; onComecar: (o: OrigemOA, ids: string[], todosIds: string[]) => void }) {
  const chave = origem ? `oa2_filtro_${origem}` : "";
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (origem) setSel(lerSalvo(chave)); }, [origem, chave]);

  const { campanhas, statsMap, isLoading: carregandoListas } = useCampanhasDisponiveis();
  const bolsao = useQuery({
    queryKey: ["bolsao-contagens", origem],
    enabled: origem === "estagnados" || origem === "descartados",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bolsao_contagens", { p_porta: origem as string });
      if (error) throw error;
      return (data ?? []) as { empreendimento: string; total: number }[];
    },
  });

  const opcoes: Opcao[] = origem === "listas"
    ? campanhas.map((c) => ({ id: c.id, nome: c.nome, total: statsMap[c.id]?.naFila ?? 0 })).filter((o) => o.total > 0)
    : (bolsao.data ?? []).map((c) => ({ id: c.empreendimento, nome: c.empreendimento, total: Number(c.total) })).sort((a, b) => b.total - a.total);
  const carregando = origem === "listas" ? carregandoListas : bolsao.isLoading;
  const validos = sel.filter((s) => opcoes.some((o) => o.id === s));
  const total = (validos.length ? opcoes.filter((o) => validos.includes(o.id)) : opcoes).reduce((s, o) => s + o.total, 0);
  const alternar = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const comecar = () => {
    if (!origem) return;
    try { localStorage.setItem(chave, JSON.stringify(validos)); } catch { /* ignore */ }
    onComecar(origem, validos, opcoes.map((o) => o.id));
  };

  return (
    <Dialog open={!!origem} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle>{origem ? `${ORIGEM_INFO[origem].emoji} ${ORIGEM_INFO[origem].titulo}` : ""}</DialogTitle>
          <DialogDescription>{origem === "listas" ? "Escolha as campanhas ou ligue em todas." : "Escolha os empreendimentos ou ligue em todos."}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50dvh] overflow-y-auto p-5">
          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : opcoes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente disponível aqui agora.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSel([])} className={cn("rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-fast", validos.length === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                Todos
              </button>
              {opcoes.map((o) => {
                const ativo = validos.includes(o.id);
                return (
                  <button key={o.id} type="button" onClick={() => alternar(o.id)} aria-pressed={ativo}
                    className={cn("flex max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors duration-fast", ativo ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                    <span className="truncate">{o.nome}</span>
                    <span className={cn("text-xs font-semibold tabular-nums", ativo ? "opacity-90" : "text-muted-foreground")}>{o.total.toLocaleString("pt-BR")}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 p-4">
          <span className="text-sm text-muted-foreground"><b className="text-foreground tabular-nums">{total.toLocaleString("pt-BR")}</b> clientes</span>
          <Button size="lg" onClick={comecar} disabled={carregando || total === 0} className="gap-2">
            <Phone className="h-4 w-4" aria-hidden /> Começar a ligar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
