import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { fmtMoney } from "@/lib/fmtMoney";
import { useMetricasDetalhe, type DetalheTipo } from "@/hooks/useMetricasDetalhe";

export const TIPO_LABEL: Record<DetalheTipo, string> = {
  vendas: "Vendas assinadas",
  vgv: "VGV assinado",
  visitas_realizadas: "Visitas realizadas",
  visitas_marcadas: "Visitas marcadas",
  visitas_no_show: "No-shows",
  leads: "Leads recebidos",
};

export function fmtDataCurta(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: DetalheTipo | null;
  start: string;
  end: string;
  gerenteId?: string | null;
  userId?: string | null;
  /** exibe coluna corretor (esconder quando já filtrado por 1 corretor) */
  mostrarCorretor?: boolean;
}

export function DetalheLista({
  tipo,
  start,
  end,
  gerenteId,
  userId,
  mostrarCorretor = true,
}: Omit<Props, "open" | "onOpenChange">) {
  const { data = [], isLoading, error } = useMetricasDetalhe({ tipo, start, end, gerenteId, userId });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-sm text-destructive">Não foi possível carregar os detalhes.</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Nada no período.</p>;

  return (
    <div className="space-y-1.5">
      {data.map((item) => (
        <div key={`${item.id}-${item.data_ref}`} className="rounded-lg border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{item.titulo}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {item.subtitulo || "—"}
                {mostrarCorretor && item.corretor_nome ? ` · ${item.corretor_nome}` : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              {item.valor !== null && (
                <p className="text-sm font-bold tabular-nums text-foreground">{fmtMoney(item.valor, "short")}</p>
              )}
              <p className="text-[11px] text-muted-foreground tabular-nums">{fmtDataCurta(item.data_ref)}</p>
            </div>
          </div>
          {item.status && (
            <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {item.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PerfDrilldownSheet({ open, onOpenChange, tipo, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{tipo ? TIPO_LABEL[tipo] : "Detalhe"}</SheetTitle>
          <SheetDescription>
            Itens que compõem o número no período selecionado (máx. 300).
          </SheetDescription>
        </SheetHeader>
        {tipo && <DetalheLista tipo={tipo} {...rest} />}
      </SheetContent>
    </Sheet>
  );
}
