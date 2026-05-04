import { Trophy, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  hint?: string;
  /** Valor numérico/string para ordenação. Se omitido, coluna não é sortable. */
  sortValue?: (row: T) => number | string;
}

interface Props<T extends { user_id: string; nome: string; gerente_nome?: string | null }> {
  rows: T[];
  loading: boolean;
  columns: Column<T>[];
  primaryLabel: string;
  primaryRender: (row: T) => React.ReactNode;
  primarySortValue?: (row: T) => number | string;
  highlightUserId?: string;
  emptyText?: string;
  caption?: string;
}

const medals = ["🥇", "🥈", "🥉"];

export default function RankingTable<T extends { user_id: string; nome: string; gerente_nome?: string | null }>({
  rows, loading, columns, primaryLabel, primaryRender, primarySortValue,
  highlightUserId, emptyText = "Sem dados no período", caption,
}: Props<T>) {
  // sortKey === null => ordem padrão do hook (métrica principal)
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = sortKey === "__primary__"
      ? { sortValue: primarySortValue }
      : columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "desc" ? vb - va : va - vb;
      }
      return sortDir === "desc"
        ? String(vb).localeCompare(String(va))
        : String(va).localeCompare(String(vb));
    });
    return arr;
  }, [rows, sortKey, sortDir, columns, primarySortValue]);

  const toggleSort = (key: string, sortable: boolean) => {
    if (!sortable) return;
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortKey(null);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />;
  };

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground text-sm">Carregando ranking...</div>;
  }
  if (!rows.length) {
    return (
      <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
        <Trophy className="h-8 w-8 opacity-40" />
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {caption && (
        <div className="px-4 py-2 text-[11px] text-muted-foreground bg-muted/20 border-b border-border flex items-center justify-between">
          <span>{caption}</span>
          {sortKey && (
            <button
              onClick={() => setSortKey(null)}
              className="text-[10px] text-primary hover:underline"
            >
              Limpar ordenação
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left font-display text-xs font-semibold text-muted-foreground px-3 py-2.5 w-12">#</th>
              <th className="text-left font-display text-xs font-semibold text-muted-foreground px-3 py-2.5">Corretor</th>
              {columns.map(col => {
                const sortable = !!col.sortValue;
                const active = sortKey === col.key;
                return (
                  <th key={col.key}
                    onClick={() => toggleSort(col.key, sortable)}
                    className={`font-display text-xs font-semibold px-3 py-2.5 whitespace-nowrap select-none ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    } ${sortable ? "cursor-pointer hover:text-foreground" : ""} ${active ? "text-primary" : "text-muted-foreground"}`}
                    title={col.hint || (sortable ? "Clique para ordenar" : undefined)}>
                    <span className={`inline-flex items-center gap-1 ${
                      col.align === "right" ? "justify-end w-full" : col.align === "center" ? "justify-center w-full" : ""
                    }`}>
                      {col.label}
                      {sortable && <SortIcon active={active} dir={sortDir} />}
                    </span>
                  </th>
                );
              })}
              <th
                onClick={() => toggleSort("__primary__", !!primarySortValue)}
                className={`text-right font-display text-xs font-semibold px-3 py-2.5 whitespace-nowrap select-none ${
                  primarySortValue ? "cursor-pointer hover:text-primary/80" : ""
                } ${sortKey === "__primary__" ? "text-primary" : "text-primary/80"}`}
              >
                <span className="inline-flex items-center gap-1 justify-end w-full">
                  {primaryLabel}
                  {primarySortValue && <SortIcon active={sortKey === "__primary__" || sortKey === null} dir={sortKey === null ? "desc" : sortDir} />}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRows.map((row, i) => {
              const isMe = highlightUserId && row.user_id === highlightUserId;
              return (
                <motion.tr
                  key={row.user_id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3) }}
                  className={`${isMe ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/30"} transition-colors`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <span className="font-display font-bold text-sm">
                      {i < 3 ? <span className="text-base">{medals[i]}</span> : <span className="text-muted-foreground">{i + 1}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground truncate max-w-[200px]">
                      {row.nome}
                      {isMe && <span className="ml-1.5 text-[10px] text-primary font-bold">(você)</span>}
                    </div>
                    {row.gerente_nome && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{row.gerente_nome}</div>
                    )}
                  </td>
                  {columns.map(col => (
                    <td key={col.key}
                      className={`px-3 py-2.5 whitespace-nowrap ${
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      }`}>
                      {col.render(row)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center justify-center min-w-[60px] px-2.5 py-1 rounded-md bg-primary/10 text-primary font-display font-bold text-sm">
                      {primaryRender(row)}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
