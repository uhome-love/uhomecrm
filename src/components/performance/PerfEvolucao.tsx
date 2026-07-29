import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { fmtMoney } from "@/lib/fmtMoney";
import type { PontoEvolucao } from "@/hooks/useEvolucaoSSOT";

interface Props {
  pontos: PontoEvolucao[];
  loading?: boolean;
  meses: number;
  onMesesChange: (n: number) => void;
}

export default function PerfEvolucao({ pontos, loading, meses, onMesesChange }: Props) {
  const ultimoIdx = pontos.length - 1;

  return (
    <div className="bg-muted/40 border border-border rounded-xl p-6 min-h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-lg text-foreground">Evolução de Performance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">VGV assinado por mês · fonte única (v_fato_venda)</p>
        </div>
        <select
          value={meses}
          onChange={(e) => onMesesChange(Number(e.target.value))}
          className="bg-transparent text-sm font-medium text-foreground border-none focus:ring-0 cursor-pointer outline-none"
        >
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
        </select>
      </div>

      <div className="flex-1 min-h-[280px]">
        {loading ? (
          <div className="h-[280px] flex items-end justify-between gap-4">
            {Array.from({ length: meses }).map((_, i) => (
              <div key={i} className="flex-1 rounded-t-lg bg-muted animate-pulse" style={{ height: `${30 + ((i * 17) % 60)}%` }} />
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pontos} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "hsl(var(--primary) / 0.06)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
                formatter={(v: number, name) =>
                  name === "vgv" ? [fmtMoney(v, "short"), "VGV assinado"] : [v, String(name)]
                }
              />
              <Bar dataKey="vgv" radius={[8, 8, 0, 0]} maxBarSize={64}>
                {pontos.map((_, i) => (
                  <Cell
                    key={i}
                    fill="hsl(var(--primary))"
                    fillOpacity={i === ultimoIdx ? 1 : 0.18 + (i / Math.max(1, ultimoIdx)) * 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
