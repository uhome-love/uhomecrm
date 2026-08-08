import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight,
  RotateCcw, Trash2, TrendingDown, Undo2,
} from "lucide-react";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { ColumnsMenu, type PdnColKey } from "@/components/pdn/ColumnsMenu";
import { MoneyInput } from "@/components/pdn/MoneyInput";
import { EditableWrapCell, ObsSelector, StatusSelector, isPdnRowOpenSuppressed } from "./cells";
import { GRUPO_LABEL_UI, PREV_GRUPO, type SortKey } from "./constants";
import { MobileCard } from "./PdnMobileCard";

function ResizableHead({ colKey, width, onResize, label, sortActive, dir, onSort }: {
  colKey: string;
  width: number;
  onResize: (key: string, w: number) => void;
  label: string;
  sortActive?: boolean;
  dir?: "asc" | "desc";
  onSort?: () => void;
}) {
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => onResize(colKey, startW + (ev.clientX - startX));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  };
  return (
    <TableHead className="relative select-none">
      {onSort ? (
        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onSort}>
          {label}
          {sortActive ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </button>
      ) : (
        <span>{label}</span>
      )}
      <span
        onMouseDown={startResize}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
        title="Arraste para redimensionar"
      />
    </TableHead>
  );
}

export function GrupoBloco({
  grupo, label, cor, rows, collapsed, onToggleCollapse, extraLabel, sortKey, sortDir, onSort,
  isMobile, colWidths, onColResize, onSave, onSaveNegocio, onRemove, onQueda, onReativar,
  onMudarEtapa, onAvisar, onOpenRow,
  visibleCols, onChangeCols, selectedIds, onToggleSelected, onGroupSelect,
}: {
  grupo: PdnGrupo;
  label: string;
  cor: string;
  rows: PdnRow[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  extraLabel?: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  isMobile: boolean;
  colWidths: Record<string, number>;
  onColResize: (key: string, w: number) => void;
  onSave: (row: PdnRow, patch: Partial<Pick<PdnRow, "status" | "observacoes" | "empreendimento" | "vgv">>) => void;
  onSaveNegocio: (row: PdnRow, patch: { vgv?: number; empreendimento?: string }) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  onOpenRow: (row: PdnRow) => void;
  visibleCols: Record<PdnColKey, boolean>;
  onChangeCols: (cols: Record<PdnColKey, boolean>) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onGroupSelect: (ids: string[], selected: boolean) => void;
}) {
  const isCaidos = grupo === "caidos";
  const subtotal = rows.reduce((s, r) => s + r.vgv, 0);
  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
  const someSelected = rows.some(r => selectedIds.has(r.id));

  // Abre o drawer se o clique não veio de um campo editável ou ação (marcados com data-no-row-open).
  const handleRowClick = (r: PdnRow, e: React.MouseEvent) => {
    if (isPdnRowOpenSuppressed()) return;
    if ((e.target as HTMLElement).closest("[data-no-row-open]")) return;
    onOpenRow(r);
  };

  // Ordem das colunas: nome (fixo), data, empreendimento, vgv, corretor, status, obs, ações (fixo).
  const cols: PdnColKey[] = ["data", "empreendimento", "vgv", "corretor", "status", "obs"];
  const visibleColCount = 1 + cols.filter(c => visibleCols[c]).length + 1; // nome + ações
  const emptyColSpan = 1 /*checkbox*/ + visibleColCount;

  return (
    <Card className={`overflow-hidden ${isCaidos ? "border-red-500/40" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleCollapse}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleCollapse(); } }}
        className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 ${isCaidos ? "bg-red-500/5" : ""}`}
        style={{ borderLeft: `3px solid ${cor}` }}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <span className={`text-sm font-semibold ${isCaidos ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{label}</span>
          <Badge variant={isCaidos ? "destructive" : "secondary"}>{rows.length}</Badge>
          {extraLabel && <span className="text-xs text-muted-foreground">· {extraLabel}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: cor }}>{fmtMoney(subtotal, "exact")}</span>
          {!isMobile && (
            <span onClick={(e) => e.stopPropagation()}>
              <ColumnsMenu cols={visibleCols} onChange={onChangeCols} />
            </span>
          )}
        </div>
      </div>

      {!collapsed && (
        isMobile ? (
          <div className="divide-y">
            {rows.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio neste grupo.</div>
            ) : rows.map(r => (
              <MobileCard
                key={r.id}
                r={r}
                onSave={onSave}
                onRemove={onRemove}
                onQueda={onQueda}
                onReativar={onReativar}
                onMudarEtapa={onMudarEtapa}
                onAvisar={onAvisar}
                onOpenRow={onOpenRow}
                selected={selectedIds.has(r.id)}
                onToggleSelected={() => onToggleSelected(r.id)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table style={{ tableLayout: "fixed", width: "100%", minWidth: 980 }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: colWidths.nome }} />
                {visibleCols.data && <col style={{ width: colWidths.data }} />}
                {visibleCols.empreendimento && <col style={{ width: colWidths.empreendimento }} />}
                {visibleCols.vgv && <col style={{ width: colWidths.vgv }} />}
                {visibleCols.corretor && <col style={{ width: colWidths.corretor }} />}
                {visibleCols.status && <col style={{ width: colWidths.status }} />}
                {visibleCols.obs && <col style={{ width: colWidths.obs }} />}
                <col style={{ width: 120 }} />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected ? true : (someSelected ? "indeterminate" : false)}
                      onCheckedChange={(v) => onGroupSelect(rows.map(r => r.id), v === true)}
                      aria-label="Selecionar todos deste grupo"
                    />
                  </TableHead>
                  <ResizableHead colKey="nome" width={colWidths.nome} onResize={onColResize} label="Nome" sortActive={sortKey === "nome"} dir={sortDir} onSort={() => onSort("nome")} />
                  {visibleCols.data && <ResizableHead colKey="data" width={colWidths.data} onResize={onColResize} label="Data" sortActive={sortKey === "data"} dir={sortDir} onSort={() => onSort("data")} />}
                  {visibleCols.empreendimento && <ResizableHead colKey="empreendimento" width={colWidths.empreendimento} onResize={onColResize} label="Empreendimento" />}
                  {visibleCols.vgv && <ResizableHead colKey="vgv" width={colWidths.vgv} onResize={onColResize} label="VGV" sortActive={sortKey === "vgv"} dir={sortDir} onSort={() => onSort("vgv")} />}
                  {visibleCols.corretor && <ResizableHead colKey="corretor" width={colWidths.corretor} onResize={onColResize} label="Corretor" sortActive={sortKey === "corretor"} dir={sortDir} onSort={() => onSort("corretor")} />}
                  {visibleCols.status && <ResizableHead colKey="status" width={colWidths.status} onResize={onColResize} label="Status" sortActive={sortKey === "status"} dir={sortDir} onSort={() => onSort("status")} />}
                  {visibleCols.obs && <ResizableHead colKey="obs" width={colWidths.obs} onResize={onColResize} label="Observação" />}
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={emptyColSpan} className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio neste grupo.</TableCell></TableRow>
                ) : rows.map(r => {
                  const selected = selectedIds.has(r.id);
                  return (
                    <TableRow
                      key={r.id}
                      onClick={(e) => handleRowClick(r, e)}
                      className={`group cursor-pointer ${r.emRisco ? "bg-amber-500/5" : ""} ${selected ? "bg-primary/5" : ""} ${r.caiu ? "opacity-70" : ""} even:bg-muted/10 hover:bg-muted/30`}
                    >
                      <TableCell data-no-row-open>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => onToggleSelected(r.id)}
                          aria-label="Selecionar linha"
                        />
                      </TableCell>
                      <TableCell className="py-2 font-medium">
                        <div className="flex w-full items-center gap-1.5 text-left hover:text-primary" title="Abrir detalhes">
                          {r.emRisco && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          <span className="truncate underline-offset-2 group-hover:underline">{r.nome}</span>
                        </div>
                        <div className="mt-1" data-no-row-open>
                          <Select value={r.grupo} onValueChange={(v) => onMudarEtapa(r, v as PdnGrupo)}>
                            <SelectTrigger className="h-6 border-transparent bg-transparent px-1 text-[11px] text-muted-foreground hover:border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PDN_GRUPOS.map(g => <SelectItem key={g.key} value={g.key} className="text-xs">{g.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>

                      {visibleCols.data && (
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {r.data ? formatBRT(r.data, "dd/MM/yy") : "—"}
                        </TableCell>
                      )}
                      {visibleCols.empreendimento && (
                        <TableCell className="py-2 text-sm" data-no-row-open>
                          {r.negocioId ? (
                            <EditableWrapCell
                              value={r.empreendimento === "—" ? "" : r.empreendimento}
                              placeholder="Empreendimento…"
                              onCommit={(v) => onSaveNegocio(r, { empreendimento: v })}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground/70" title="Sem negócio vinculado — abra o lead para criar o negócio">
                              {r.empreendimento === "—" ? "—" : r.empreendimento}
                            </span>
                          )}
                        </TableCell>
                      )}
                      {visibleCols.vgv && (
                        <TableCell className="py-2 text-sm font-medium" data-no-row-open>
                          {r.negocioId ? (
                            <MoneyInput value={r.vgv || 0} onCommit={(v) => onSaveNegocio(r, { vgv: v })} />
                          ) : (
                            <span className="tabular-nums text-muted-foreground/70" title="Sem negócio vinculado — abra o lead para criar o negócio">
                              {r.vgv > 0 ? fmtMoney(r.vgv, "short") : "—"}
                            </span>
                          )}
                        </TableCell>
                      )}
                      {visibleCols.corretor && (
                        <TableCell className="py-2 text-sm text-muted-foreground">{r.corretor}</TableCell>
                      )}
                      {visibleCols.status && (
                        <TableCell className="py-2" data-no-row-open>
                          <StatusSelector value={r.status} onChange={(v) => onSave(r, { status: v })} />
                        </TableCell>
                      )}
                      {visibleCols.obs && (
                        <TableCell className="py-2" data-no-row-open>
                          {r.caiu && r.motivoQueda
                            ? <div className="text-xs"><span className="font-medium text-red-600 dark:text-red-400">Queda:</span> {r.motivoQueda}</div>
                            : <ObsSelector value={r.observacoes} pipelineLeadId={r.pipelineLeadId} row={r} onChange={(v) => onSave(r, { observacoes: v })} />}
                        </TableCell>
                      )}
                      <TableCell data-no-row-open>
                        <div className="flex items-center justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                          {r.caiu ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-600" title="Reativar" onClick={() => onReativar(r)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" title="Marcar como caiu" onClick={() => onQueda(r)}>
                              <TrendingDown className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(() => {
                            const prev = PREV_GRUPO[r.grupo];
                            const canRegress = !r.caiu && prev && (r.pipelineLeadId || r.negocioId);
                            if (canRegress) {
                              return (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                                  title={`Regredir para ${GRUPO_LABEL_UI[prev!]} (avisa o corretor)`}
                                  onClick={() => onMudarEtapa(r, prev!)}
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </Button>
                              );
                            }
                            return (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Marcar como caiu / descartar" onClick={() => onRemove(r)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </Card>
  );
}
