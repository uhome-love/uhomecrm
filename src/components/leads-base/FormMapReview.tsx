import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormMap, useSalvarFormMap, useEmpreendimentosCanonicos } from "@/hooks/useBaseLeads";

interface FormRow {
  id: string;
  formulario: string;
  empreendimento_canonico_id: string | null;
  empreendimento_texto: string | null;
  extinto: boolean;
  revisado: boolean;
  total_leads: number;
}

const EXTINTO = "__extinto__";

export function FormMapReview() {
  const [pendentes, setPendentes] = useState(true);
  const { data, isLoading } = useFormMap(pendentes);
  const { data: emps } = useEmpreendimentosCanonicos();
  const salvar = useSalvarFormMap();
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  const rows = (data ?? []) as unknown as FormRow[];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Cada formulário do histórico precisa apontar para um empreendimento canônico — ou ser marcado como
          produto extinto (fica na base, fora da Oferta Ativa).
        </p>
        <div className="flex gap-1">
          <Button variant={pendentes ? "default" : "outline"} size="sm" onClick={() => setPendentes(true)}>
            Pendentes
          </Button>
          <Button variant={!pendentes ? "default" : "outline"} size="sm" onClick={() => setPendentes(false)}>
            Todos
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Formulário de origem</th>
              <th className="text-right font-semibold px-3 py-2">Leads</th>
              <th className="text-left font-semibold px-3 py-2 w-[280px]">Empreendimento canônico</th>
              <th className="text-right font-semibold px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Nada pendente — todos os formulários estão mapeados.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const valor = escolhas[r.id] ?? (r.extinto ? EXTINTO : r.empreendimento_canonico_id ?? "");
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="font-medium break-words max-w-[420px]">{r.formulario}</div>
                    {r.revisado && (
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        Revisado
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.total_leads}</td>
                  <td className="px-3 py-2">
                    <Select value={valor} onValueChange={(v) => setEscolhas((s) => ({ ...s, [r.id]: v }))}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecionar…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        <SelectItem value={EXTINTO}>
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle size={12} /> Produto extinto
                          </span>
                        </SelectItem>
                        {(emps ?? []).map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={!valor || salvar.isPending}
                      onClick={() =>
                        salvar.mutate({
                          id: r.id,
                          formulario: r.formulario,
                          empreendimento_canonico_id: valor === EXTINTO ? null : valor,
                          extinto: valor === EXTINTO,
                        })
                      }
                    >
                      <Check size={14} /> Salvar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FormMapReview;
