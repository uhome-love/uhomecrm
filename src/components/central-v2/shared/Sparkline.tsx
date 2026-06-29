import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  data: number[];
  /** Cor base: usa o primário por padrão. Aceita "success" | "danger". */
  tone?: "primary" | "success" | "danger";
  height?: number;
}

const TONE_VAR: Record<NonNullable<Props["tone"]>, string> = {
  primary: "var(--primary-500)",
  success: "var(--success-500)",
  danger: "var(--danger-500)",
};

/**
 * Sparkline minimalista para o rodapé de um KPI card.
 * Renderiza nada quando há menos de 2 pontos (evita linha plana sem sentido).
 */
export function Sparkline({ data, tone = "primary", height = 34 }: Props) {
  if (!data || data.filter((v) => Number.isFinite(v)).length < 2) return null;
  const color = `hsl(${TONE_VAR[tone]})`;
  const id = `spark-${tone}`;
  const series = data.map((value, i) => ({ i, value: Number(value) || 0 }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
