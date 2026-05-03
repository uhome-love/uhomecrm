import { Trophy } from "lucide-react";
import { motion } from "framer-motion";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  hint?: string;
}

interface Props<T extends { user_id: string; nome: string; gerente_nome?: string | null }> {
  rows: T[];
  loading: boolean;
  columns: Column<T>[];
  primaryLabel: string;
  primaryRender: (row: T) => React.ReactNode;
  highlightUserId?: string;
  emptyText?: string;
  caption?: string;
}

const medals = ["🥇", "🥈", "🥉"];

export default function RankingTable<T extends { user_id: string; nome: string; gerente_nome?: string | null }>({
  rows, loading, columns, scoreLabel, scoreRender, highlightUserId, emptyText = "Sem dados no período",
}: Props<T>) {
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left font-display text-xs font-semibold text-muted-foreground px-3 py-2.5 w-12">#</th>
              <th className="text-left font-display text-xs font-semibold text-muted-foreground px-3 py-2.5">Corretor</th>
              {columns.map(col => (
                <th key={col.key}
                  className={`font-display text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                  title={col.hint}>
                  {col.label}
                </th>
              ))}
              <th className="text-right font-display text-xs font-semibold text-primary px-3 py-2.5 whitespace-nowrap">
                {scoreLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => {
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
                      {scoreRender(row)}
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
