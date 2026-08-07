import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, RotateCcw } from "lucide-react";
import { fmtMoney } from "@/lib/fmtMoney";
import type { PdnRow } from "@/hooks/usePdn";

export function ArquivadosView({
  caidosRows, onRestaurar, onReativar, onOpen,
}: {
  caidosRows: PdnRow[];
  onRestaurar: (r: PdnRow) => void;
  onReativar: (r: PdnRow) => void;
  onOpen: (r: PdnRow) => void;
}) {
  const groups = [
    { title: "Caídos / Descartados / Inativados", rows: caidosRows, action: "reativar" as const },
  ];
  const total = caidosRows.length;
  if (total === 0) {
    return (
      <Card className="border-dashed py-16 text-center text-sm text-muted-foreground">
        <Archive className="mx-auto mb-2 h-6 w-6 opacity-50" />
        Nenhum negócio arquivado neste mês.
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map(g => g.rows.length > 0 && (
        <Card key={g.title} className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Archive className="h-4 w-4" /> {g.title} <Badge variant="outline">{g.rows.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {g.rows.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <button className="min-w-0 text-left hover:text-primary" onClick={() => onOpen(r)}>
                  <span className="font-medium">{r.nome}</span>
                  <span className="text-muted-foreground"> · {r.empreendimento !== "—" ? r.empreendimento : "sem empreendimento"} · {fmtMoney(r.vgv, "short")} · {r.corretor}</span>
                  {r.motivoQueda && <div className="text-xs text-red-600 dark:text-red-400">Motivo: {r.motivoQueda}</div>}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => g.action === "reativar" ? onReativar(r) : onRestaurar(r)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {g.action === "reativar" ? "Reativar" : "Restaurar"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
