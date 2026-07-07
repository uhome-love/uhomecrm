import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/fmtMoney";
import type { ResultadoSimulacao } from "@/lib/financiamento";
import { ChevronDown, ChevronUp } from "lucide-react";

export function TabelaParcelas({ resultado }: { resultado: ResultadoSimulacao }) {
  const [verTodas, setVerTodas] = useState(false);

  // Resumo: 1ª, primeiras 3, marcos anuais (a cada 12), e última.
  const total = resultado.parcelas.length;
  const marcos = new Set<number>([1, 2, 3, total]);
  for (let n = 12; n <= total; n += 12) marcos.add(n);
  const linhas = verTodas ? resultado.parcelas : resultado.parcelas.filter((p) => marcos.has(p.numero));

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Parcela</th>
              <th className="px-3 py-2 text-right font-medium">Prestação</th>
              <th className="px-3 py-2 text-right font-medium">Juros</th>
              <th className="px-3 py-2 text-right font-medium">Amortização</th>
              <th className="px-3 py-2 text-right font-medium">Saldo devedor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((p) => (
              <tr key={p.numero} className="border-t border-border/60">
                <td className="px-3 py-2 font-medium">{p.numero}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtMoney(p.prestacao, "exact")}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{fmtMoney(p.juros, "exact")}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{fmtMoney(p.amortizacao, "exact")}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(p.saldoDevedor, "exact")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border p-2 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setVerTodas((v) => !v)}>
          {verTodas ? (
            <><ChevronUp className="h-4 w-4 mr-1" /> Ver resumo</>
          ) : (
            <><ChevronDown className="h-4 w-4 mr-1" /> Ver todas as {total} parcelas</>
          )}
        </Button>
      </div>
    </div>
  );
}
