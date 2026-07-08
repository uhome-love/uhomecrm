import { useMemo, useState } from "react";
import { usePdn, PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Download, Plus, Trash2, AlertTriangle, TrendingUp, FileSignature,
  ClipboardList, Loader2,
} from "lucide-react";

// ─── Opções de mês (últimos 12) ───────────────────────────────────────────────
function buildMonthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

// Célula editável simples (input com commit no blur)
function EditableCell({
  value, onCommit, type = "text", placeholder, className = "",
}: {
  value: string | number;
  onCommit: (v: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(String(value ?? ""));
  return (
    <Input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== String(value ?? "")) onCommit(local); }}
      className={`h-8 border-transparent bg-transparent px-2 hover:border-border focus:border-primary ${className}`}
    />
  );
}

export default function PdnGestor() {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [mes, setMes] = useState(monthOptions[0].value);
  const [filtroRisco, setFiltroRisco] = useState(false);
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");

  const { rows, resumo, loading, saveOverride, addManualRow, updateManualRow, deleteRow } = usePdn(mes);

  const corretores = useMemo(() => {
    const set = new Set(rows.map(r => r.corretor).filter(c => c && c !== "—"));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filtroRisco && !r.emRisco) return false;
      if (filtroCorretor !== "todos" && r.corretor !== filtroCorretor) return false;
      return true;
    });
  }, [rows, filtroRisco, filtroCorretor]);

  function exportCSV() {
    const header = ["Grupo", "Nome", "Data", "Empreendimento", "Construtora", "VGV", "Status", "Corretor", "Equipe", "Observação"];
    const lines = filtered.map(r => [
      r.grupo, r.nome, r.data, r.empreendimento, r.construtora, r.vgv, r.situacaoLabel, r.corretor, r.equipe, r.observacoes,
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `PDN_${mes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <ClipboardList className="h-5 w-5 text-primary" /> PDN — Plano de Negócios
          </h1>
          <p className="text-sm text-muted-foreground">Sua planilha de negócios do mês, integrada ao pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1.5 h-4 w-4" /> Exportar</Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="VGV Total" value={fmtMoney(resumo.vgvTotal, "short")} accent="text-foreground" />
        <SummaryCard label="Assinados" value={fmtMoney(resumo.byGrupo.assinado.vgv, "short")} sub={`${resumo.byGrupo.assinado.count} negócios`} accent="text-emerald-500" icon={<FileSignature className="h-4 w-4" />} />
        <SummaryCard label="Gerados" value={fmtMoney(resumo.byGrupo.gerado.vgv, "short")} sub={`${resumo.byGrupo.gerado.count} contratos`} accent="text-violet-500" />
        <SummaryCard label="Forecast ponderado" value={fmtMoney(resumo.forecast, "short")} accent="text-primary" icon={<TrendingUp className="h-4 w-4" />} />
        <SummaryCard label="Em risco" value={String(resumo.emRisco)} sub="parados +7d" accent="text-amber-500" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filtroRisco ? "default" : "outline"} size="sm" onClick={() => setFiltroRisco(v => !v)}>
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Em risco
        </Button>
        <Select value={filtroCorretor} onValueChange={setFiltroCorretor}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Corretor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os corretores</SelectItem>
            {corretores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="space-y-5">
          {PDN_GRUPOS.map(g => (
            <GrupoTable
              key={g.key}
              grupo={g.key}
              label={g.label}
              cor={g.cor}
              rows={filtered.filter(r => r.grupo === g.key)}
              onAdd={() => addManualRow(g.key)}
              onSaveOverride={saveOverride}
              onUpdateManual={updateManualRow}
              onDelete={deleteRow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon?: React.ReactNode;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon && <span className={accent}>{icon}</span>}
      </div>
      <div className={`mt-1 text-lg font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function GrupoTable({
  grupo, label, cor, rows, onAdd, onSaveOverride, onUpdateManual, onDelete,
}: {
  grupo: PdnGrupo;
  label: string;
  cor: string;
  rows: PdnRow[];
  onAdd: () => void;
  onSaveOverride: (row: PdnRow, patch: Partial<Pick<PdnRow, "construtora" | "observacoes" | "proximaAcao">>) => void;
  onUpdateManual: (id: string, patch: Record<string, any>) => void;
  onDelete: (id: string) => void;
}) {
  const subtotal = rows.reduce((s, r) => s + r.vgv, 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderLeft: `3px solid ${cor}` }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: cor }}>{fmtMoney(subtotal, "exact")}</span>
          <Button variant="ghost" size="sm" onClick={onAdd}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[160px]">Nome</TableHead>
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="min-w-[150px]">Empreendimento</TableHead>
              <TableHead className="min-w-[130px]">Construtora</TableHead>
              <TableHead className="w-[130px]">VGV</TableHead>
              <TableHead className="min-w-[120px]">Corretor</TableHead>
              <TableHead className="min-w-[180px]">Observação</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio neste grupo.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id} className={r.emRisco ? "bg-amber-500/5" : ""}>
                <TableCell className="font-medium">
                  {r.isManual ? (
                    <EditableCell value={r.nome} onCommit={(v) => onUpdateManual(r.id, { nome: v })} />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {r.emRisco && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                      {r.nome}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.isManual
                    ? <EditableCell type="date" value={r.data} onCommit={(v) => onUpdateManual(r.id, { data_visita: v })} />
                    : (r.data ? formatBRT(r.data, "dd/MM/yy") : "—")}
                </TableCell>
                <TableCell className="text-sm">
                  {r.isManual
                    ? <EditableCell value={r.empreendimento === "—" ? "" : r.empreendimento} onCommit={(v) => onUpdateManual(r.id, { empreendimento: v })} />
                    : r.empreendimento}
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={r.construtora}
                    placeholder="—"
                    onCommit={(v) => r.isManual ? onUpdateManual(r.id, { construtora: v }) : onSaveOverride(r, { construtora: v })}
                  />
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {r.isManual
                    ? <EditableCell type="number" value={r.vgv || ""} onCommit={(v) => onUpdateManual(r.id, { vgv: Number(v) || 0 })} />
                    : fmtMoney(r.vgv, "exact")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.isManual
                    ? <EditableCell value={r.corretor === "—" ? "" : r.corretor} onCommit={(v) => onUpdateManual(r.id, { corretor: v })} />
                    : r.corretor}
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={r.observacoes}
                    placeholder="—"
                    onCommit={(v) => r.isManual ? onUpdateManual(r.id, { observacoes: v }) : onSaveOverride(r, { observacoes: v })}
                  />
                </TableCell>
                <TableCell>
                  {r.isManual && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
