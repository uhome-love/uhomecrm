import { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useDateFilter, type GlobalPeriod } from "@/contexts/DateFilterContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const periods: { key: GlobalPeriod; label: string }[] = [
  { key: "hoje", label: "Hoje" }, { key: "ontem", label: "Ontem" },
  { key: "semana", label: "Semana" }, { key: "mes", label: "Mês" },
  { key: "ultimos_30d", label: "30 dias" },
];

export default function MobilePeriodSelector() {
  const { period, label, range, setPeriod, setCustomRange } = useDateFilter();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(range.start);
  const [to, setTo] = useState(range.end);
  const openSelector = () => { setCustom(false); setFrom(range.start); setTo(range.end); setOpen(true); };
  return <>
    <Button variant="ghost" onClick={openSelector} aria-label="Selecionar período" className="h-11 min-w-0 justify-start gap-2 px-0 text-[13px] hover:bg-transparent">
      <CalendarDays className="text-primary" /><span className="truncate">{label}</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="[&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center" >
        <DialogTitle className="pr-8 text-left text-xl tracking-normal">Selecionar período</DialogTitle>
        <DialogDescription className="sr-only">Período dos indicadores do Painel</DialogDescription>
        <div>
          {periods.map((p) => <Button key={p.key} variant="ghost" className="h-[49px] w-full justify-between rounded-none border-t border-border px-1 text-sm font-normal" onClick={() => { setPeriod(p.key); setOpen(false); }}>
            {p.label}{period === p.key && <Check className="text-primary" />}
          </Button>)}
          <Button variant="ghost" className="h-[49px] w-full justify-between rounded-none border-t border-border px-1 text-sm font-normal" onClick={() => setCustom(true)}>Personalizado{period === "custom" && <Check className="text-primary" />}</Button>
        </div>
        {custom && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!from || !to) return; setCustomRange({ start: from, end: to }); setOpen(false); }}>
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 space-y-2 text-xs text-muted-foreground">De<Input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} required className="h-11 min-w-0 text-base" /></label>
            <label className="min-w-0 space-y-2 text-xs text-muted-foreground">Até<Input type="date" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} required className="h-11 min-w-0 text-base" /></label>
          </div>
          <Button type="submit" disabled={!from || !to} className="h-11 w-full">Aplicar</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}