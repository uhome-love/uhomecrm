import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Power, PowerOff } from "lucide-react";
import {
  useEmpreendimentosCanonicos,
  useLeadsPorEmpreendimento,
  useSetEmpreendimentoAtivo,
  useSegmentos,
  useSetEmpreendimentoSegmento,
} from "@/hooks/useFocoCorretores";
import { EmpreendimentosNaoResolvidosCard } from "./EmpreendimentosNaoResolvidosCard";
import { cn } from "@/lib/utils";


/**
 * Aba CEO — liga/desliga empreendimentos.
 * Só empreendimentos ATIVOS aparecem na alocação de corretor.
 */
export function FocoEmpreendimentosTab() {
  const { data: all = [], isLoading } = useEmpreendimentosCanonicos({ includeInactive: true });
  const { data: leadCounts = {} } = useLeadsPorEmpreendimento(30);
  const { mutate: setAtivo, isPending } = useSetEmpreendimentoAtivo();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | "ativos" | "inativos">("todos");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((e) => {
      if (filter === "ativos" && !e.ativo) return false;
      if (filter === "inativos" && e.ativo) return false;
      if (!s) return true;
      return e.nome.toLowerCase().includes(s) || (e.segmento_nome || "").toLowerCase().includes(s);
    });
  }, [all, q, filter]);

  const totalAtivos = all.filter((e) => e.ativo).length;
  const totalInativos = all.length - totalAtivos;

  const desativarSemLeads = () => {
    const candidatos = all.filter((e) => e.ativo && (leadCounts[e.id] || 0) === 0);
    if (candidatos.length === 0) return;
    if (!confirm(`Desativar ${candidatos.length} empreendimento(s) sem leads nos últimos 30d?`)) return;
    candidatos.forEach((e) => setAtivo({ id: e.id, ativo: false }));
  };

  return (
    <div className="space-y-3">
      <EmpreendimentosNaoResolvidosCard />
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empreendimento…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 text-xs">
            {(["todos", "ativos", "inativos"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md transition capitalize",
                  filter === f ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                )}
              >
                {f} {f === "ativos" && `(${totalAtivos})`}{f === "inativos" && `(${totalInativos})`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={desativarSemLeads} disabled={isPending}>
            Desativar sem leads (30d)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum empreendimento</div>
          ) : (
            <div className="divide-y">
              {filtered.map((e) => {
                const leads30d = leadCounts[e.id] || 0;
                return (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium truncate", !e.ativo && "text-muted-foreground line-through")}>
                          {e.nome}
                        </span>
                        {e.segmento_nome && (
                          <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                            {e.segmento_nome}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 w-24 text-right">
                      {leads30d} lead{leads30d === 1 ? "" : "s"} 30d
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {e.ativo ? (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                          <Power className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <PowerOff className="h-3 w-3" /> Inativo
                        </span>
                      )}
                      <Switch
                        checked={e.ativo}
                        disabled={isPending}
                        onCheckedChange={(v) => setAtivo({ id: e.id, ativo: v })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground px-1">
        Empreendimentos inativos <b>não aparecem</b> na aba Alocação (mas continuam visíveis em Dados para histórico).
      </p>
    </div>
  );
}
