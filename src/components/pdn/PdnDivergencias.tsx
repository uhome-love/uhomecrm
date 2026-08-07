import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DivergenciaRow, DivergenciaTipo } from "@/hooks/pdn/usePdnDivergencias";

const GRUPOS: { tipo: DivergenciaTipo; label: string; hint: string; acao?: string }[] = [
  { tipo: "lead_arquivado", label: "Negócio ativo em lead arquivado", hint: "Não aparece no PDN — desarquive o lead ou encerre o negócio.", acao: "Desarquivar lead" },
  { tipo: "fase_divergente", label: "Fase do negócio ≠ etapa do lead", hint: "PDN segue a etapa do lead; Vendas/Negócios seguem a fase.", acao: "Alinhar fase" },
  { tipo: "negocio_sem_lead", label: "Negócio sem lead vinculado", hint: "Invisível no PDN — vincule o negócio a um lead." },
  { tipo: "lead_sem_negocio", label: "Lead em etapa de negócio sem negócio criado", hint: "Sem VGV no PDN — crie o negócio no lead.", acao: "Criar negócio" },
];

interface Props {
  rows: DivergenciaRow[];
  onOpenLead?: (leadId: string) => void;
  onCorrigir?: (row: DivergenciaRow) => Promise<boolean>;
}

export function PdnDivergencias({ rows, onOpenLead, onCorrigir }: Props) {
  // Reconciliação é bloco fixo do topo: abre expandido para o gestor resolver antes de operar.
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const byTipo = useMemo(() => {
    const map: Record<string, DivergenciaRow[]> = {};
    for (const r of rows) (map[r.tipo] ||= []).push(r);
    return map;
  }, [rows]);

  if (rows.length === 0) return null;

  const rowKey = (r: DivergenciaRow, i: number) => `${r.tipo}-${r.negocioId ?? r.pipelineLeadId ?? i}`;

  const handleCorrigir = async (r: DivergenciaRow, key: string) => {
    if (!onCorrigir) return;
    setBusy(key);
    try {
      const ok = await onCorrigir(r);
      if (ok) toast.success("Divergência corrigida");
      else toast.error("Não foi possível corrigir automaticamente");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 p-4">
      <button
        className="flex w-full items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <AlertTriangle className="h-4 w-4" />
        Reconciliação — PDN x Negócios
        <Badge variant="outline" className="ml-1">{rows.length}</Badge>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {GRUPOS.map(g => {
            const list = byTipo[g.tipo] || [];
            if (list.length === 0) return null;
            return (
              <div key={g.tipo}>
                <div className="mb-1 text-xs font-semibold text-foreground">
                  {g.label} <span className="text-muted-foreground">({list.length})</span>
                </div>
                <p className="mb-1.5 text-[11px] text-muted-foreground">{g.hint}</p>
                <div className="space-y-1">
                  {list.map((r, i) => {
                    const key = rowKey(r, i);
                    return (
                      <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">{r.nome}</span>
                          <span className="text-muted-foreground"> · {r.detalhe}</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                          {g.acao && onCorrigir && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              disabled={busy === key}
                              onClick={() => handleCorrigir(r, key)}
                            >
                              {busy === key
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Wrench className="h-3.5 w-3.5" />}
                              {g.acao}
                            </Button>
                          )}
                          {r.pipelineLeadId && onOpenLead && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onOpenLead(r.pipelineLeadId as string)}>
                              <ExternalLink className="h-3.5 w-3.5" /> Abrir
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
