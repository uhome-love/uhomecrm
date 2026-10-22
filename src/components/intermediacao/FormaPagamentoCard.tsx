import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  FORMAS_PAGAMENTO, calcularRepasse, construtoraDoEmpreendimento, type FormaPagamento,
} from "@/lib/intermediacaoPagamento";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FormaPagamentoCard({
  forma, onChange, empreendimento, credores, pctDesconto,
}: {
  forma: FormaPagamento | null;
  onChange: (f: FormaPagamento) => void;
  empreendimento: string;
  credores: ReadonlyArray<{ nome: string; total: number }>;
  pctDesconto: number;
}) {
  const isOpen = construtoraDoEmpreendimento(empreendimento) === "Open";
  const r = calcularRepasse(credores, forma ?? "zemo", pctDesconto);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">2. Forma de pagamento (obrigatória)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FORMAS_PAGAMENTO.map((f) => (
            <button
              key={f.value} type="button" onClick={() => onChange(f.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                forma === f.value ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted",
              )}
            >
              <span className="block text-xs text-muted-foreground">{f.label}</span>
              <span className="block text-sm font-semibold text-foreground">
                {f.value === "nota_fiscal" ? `Uhome recebe e repassa (−${pctDesconto}%)` : f.descricao}
              </span>
            </button>
          ))}
        </div>
        {isOpen && (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Open: já vem marcada como Nota fiscal, mas pode trocar para PIX (por exemplo, quando o cliente pagou a entrada).
          </p>
        )}
        {forma === "nota_fiscal" && r.bruto > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beneficiário</TableHead><TableHead>Bruto</TableHead>
                  <TableHead>−{pctDesconto}% NF</TableHead><TableHead>Recebe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.linhas.map((l) => (
                  <TableRow key={l.nome}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell>{brl(l.bruto)}</TableCell>
                    <TableCell className="text-destructive">−{brl(l.desconto)}</TableCell>
                    <TableCell className="font-semibold">{brl(l.liquido)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell><TableCell>{brl(r.bruto)}</TableCell>
                  <TableCell className="text-destructive">−{brl(r.desconto)}</TableCell><TableCell>{brl(r.liquido)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
