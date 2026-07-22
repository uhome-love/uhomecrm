import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/fmtMoney";
import { Users } from "lucide-react";

export type ResumoEquipe = {
  equipe: string;
  count: number;
  vgv: number;
  corretores: { nome: string; count: number; vgv: number }[];
};

export function PdnResumoEquipes({
  equipes, filtroCorretor, onChangeCorretor,
}: {
  equipes: ResumoEquipe[];
  filtroCorretor: string;
  onChangeCorretor: (v: string) => void;
}) {
  if (equipes.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-primary" /> Resumo por corretor
        {filtroCorretor !== "todos" && (
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => onChangeCorretor("todos")}>
            Limpar filtro de corretor
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {equipes.map(t => (
          <div key={t.equipe}>
            <div className="mb-2 flex items-center justify-between border-b pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.equipe === "Sem equipe" ? "Sem equipe" : `Equipe ${t.equipe}`} · {t.count} negócio{t.count > 1 ? "s" : ""}
              </span>
              <span className="text-xs font-semibold text-primary">{fmtMoney(t.vgv, "short")}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {t.corretores.map(c => {
                const active = filtroCorretor === c.nome;
                return (
                  <button
                    key={c.nome}
                    onClick={() => onChangeCorretor(active ? "todos" : c.nome)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:shadow-sm ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-muted/30"}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">{c.count} negócio{c.count > 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{fmtMoney(c.vgv, "short")}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
