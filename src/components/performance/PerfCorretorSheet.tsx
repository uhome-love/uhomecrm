import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtMoney } from "@/lib/fmtMoney";
import type { MetricaCorretor } from "@/lib/metricasSSOT";
import { DetalheLista } from "./PerfDrilldownSheet";
import type { DetalheTipo } from "@/hooks/useMetricasDetalhe";

interface Props {
  corretor: MetricaCorretor | null;
  onOpenChange: (v: boolean) => void;
  start: string;
  end: string;
  periodoLabel: string;
}

const ABAS: { key: DetalheTipo; label: string }[] = [
  { key: "vendas", label: "Vendas" },
  { key: "visitas_realizadas", label: "Visitas" },
  { key: "visitas_no_show", label: "No-show" },
  { key: "leads", label: "Leads" },
];

export default function PerfCorretorSheet({ corretor, onOpenChange, start, end, periodoLabel }: Props) {
  const [aba, setAba] = useState<DetalheTipo>("vendas");
  const l = corretor;

  const conv = l && l.visitas_realizadas > 0 ? (l.vendas / l.visitas_realizadas) * 100 : 0;
  const noShow =
    l && l.visitas_realizadas + l.visitas_no_show > 0
      ? (l.visitas_no_show / (l.visitas_realizadas + l.visitas_no_show)) * 100
      : 0;

  return (
    <Sheet open={!!l} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {l && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                {l.corretor_nome || "Sem nome"}
                {!l.corretor_ativo && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    inativo
                  </span>
                )}
              </SheetTitle>
              <SheetDescription>
                {(l.equipe || "Sem equipe") + " · " + periodoLabel}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { label: "VGV assinado", value: fmtMoney(l.vgv_assinado, "short") },
                { label: "Vendas", value: String(l.vendas) },
                { label: "Visitas realizadas", value: String(l.visitas_realizadas) },
                { label: "Leads recebidos", value: l.leads_recebidos.toLocaleString("pt-BR") },
                { label: "Conversão visita→venda", value: `${conv.toFixed(1)}%` },
                { label: "No-show", value: `${noShow.toFixed(0)}%` },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className="text-lg font-bold tabular-nums text-foreground mt-1">{k.value}</p>
                </div>
              ))}
            </div>

            <Tabs value={aba} onValueChange={(v) => setAba(v as DetalheTipo)}>
              <TabsList className="w-full">
                {ABAS.map((a) => (
                  <TabsTrigger key={a.key} value={a.key} className="flex-1 text-xs">
                    {a.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {ABAS.map((a) => (
                <TabsContent key={a.key} value={a.key} className="mt-4">
                  {aba === a.key && (
                    <DetalheLista
                      tipo={a.key}
                      start={start}
                      end={end}
                      userId={l.corretor_auth_id}
                      mostrarCorretor={false}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
