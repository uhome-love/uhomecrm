import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, Download, LayoutGrid, RefreshCw, Table as TableIcon, Target, Archive,
} from "lucide-react";

export type PdnView = "planilha" | "kanban" | "meta" | "arquivados";

export function PdnHeader({
  mes, monthOptions, onChangeMes,
  view, onChangeView,
  refreshing, onRefresh, onExport,
}: {
  mes: string;
  monthOptions: { value: string; label: string }[];
  onChangeMes: (v: string) => void;
  view: PdnView;
  onChangeView: (v: PdnView) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <div className="-mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background px-4 py-2.5 shadow-sm md:-mx-6 md:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" /> PDN — Plano de Negócios
        </h1>
        <p className="text-sm text-muted-foreground">
          Planilha de gestão do mês, integrada ao pipeline. Status e observações são internos (não aparecem para o corretor).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={mes} onValueChange={onChangeMes}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center rounded-lg border p-0.5">
          <Button variant={view === "planilha" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => onChangeView("planilha")}>
            <TableIcon className="mr-1.5 h-4 w-4" /> Planilha
          </Button>
          <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => onChangeView("kanban")}>
            <LayoutGrid className="mr-1.5 h-4 w-4" /> Kanban
          </Button>
          <Button variant={view === "meta" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => onChangeView("meta")}>
            <Target className="mr-1.5 h-4 w-4" /> Meta
          </Button>
          <Button variant={view === "arquivados" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => onChangeView("arquivados")}>
            <Archive className="mr-1.5 h-4 w-4" /> Arquivados
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar
        </Button>
      </div>
    </div>
  );
}
