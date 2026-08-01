import { Timer, RefreshCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCampanhasOA, useEncerrarCampanhasExpiradas, useEncerrarCampanha } from "@/hooks/useBaseLeads";
import { formatBRT } from "@/lib/brtTime";

interface Row {
  lista_id: string;
  nome: string | null;
  empreendimento: string | null;
  status: string | null;
  liberada_em: string | null;
  expira_em: string | null;
  encerrada_em: string | null;
  liberados: number | null;
  aproveitados: number | null;
  na_fila: number | null;
  descartados: number | null;
  tentativas: number | null;
  conversao_pct: number | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  liberada: "default",
  encerrada: "secondary",
  arquivada: "outline",
  pendente: "outline",
};

export function CampanhasPanel() {
  const { data, isLoading } = useCampanhasOA();
  const encerrar = useEncerrarCampanhasExpiradas();
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.status !== "arquivada");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Campanhas temporárias geradas da Base Única. Ao expirar, os leads não trabalhados voltam para a base.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={encerrar.isPending} onClick={() => encerrar.mutate()}>
          <RefreshCcw size={14} /> Encerrar vencidas
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Campanha</th>
              <th className="text-left font-semibold px-3 py-2">Status</th>
              <th className="text-left font-semibold px-3 py-2">Janela</th>
              <th className="text-right font-semibold px-3 py-2">Liberados</th>
              <th className="text-right font-semibold px-3 py-2">Na fila</th>
              <th className="text-right font-semibold px-3 py-2">Tentativas</th>
              <th className="text-right font-semibold px-3 py-2">Aproveitados</th>
              <th className="text-right font-semibold px-3 py-2">Conversão</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma campanha ativa. Crie uma a partir da aba “Base de leads”.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.lista_id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.nome ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{r.empreendimento ?? "—"}</div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[r.status ?? ""] ?? "outline"} className="text-[10px]">
                    {r.status ?? "—"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Timer size={12} />
                    {r.liberada_em ? formatBRT(r.liberada_em, "dd/MM HH:mm") : "—"}
                    {" → "}
                    {r.expira_em ? formatBRT(r.expira_em, "dd/MM HH:mm") : "sem prazo"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.liberados ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.na_fila ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.tentativas ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  {r.aproveitados ?? 0}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.conversao_pct ?? 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CampanhasPanel;
