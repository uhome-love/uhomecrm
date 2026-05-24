/**
 * ModoTimeTabela — tabela 9 colunas (Corretor, Leads, Sem tarefa, Atrasados,
 * Em dia, Hoje, Negócios, VGV, Conv.) com sort por coluna client-side.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type TimeAgregadoRow } from "@/hooks/useTimeAgregado";
import ModoTimeRow from "./ModoTimeRow";

type SortKey =
  | "nome"
  | "total_leads"
  | "sem_tarefa"
  | "atrasados"
  | "em_dia"
  | "para_hoje"
  | "negocios"
  | "vgv_pipeline"
  | "conversao_pct";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "left" | "right" }[] = [
  { key: "nome", label: "Corretor", align: "left" },
  { key: "total_leads", label: "Ativos / Recebidos", align: "right" },
  { key: "sem_tarefa", label: "Sem tarefa", align: "right" },
  { key: "atrasados", label: "Atrasados", align: "right" },
  { key: "em_dia", label: "Em dia", align: "right" },
  { key: "para_hoje", label: "Hoje", align: "right" },
  { key: "negocios", label: "Negócios", align: "right" },
  { key: "vgv_pipeline", label: "VGV", align: "right" },
  { key: "conversao_pct", label: "Conv.", align: "right" },
];

interface Props {
  rows: TimeAgregadoRow[];
  onRowClick: (corretorId: string) => void;
}

export default function ModoTimeTabela({ rows, onRowClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("atrasados");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const cp = [...rows];
    cp.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return cp;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b-2 border-neutral-200">
            <tr>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
                      active ? "text-[#4969FF]" : "text-neutral-500 hover:text-neutral-700"
                    } ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${
                        col.align === "right" ? "justify-end w-full" : ""
                      }`}
                    >
                      {col.label}
                      {active &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <ModoTimeRow key={row.corretor_id} row={row} onClick={onRowClick} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-sm text-neutral-500">
                  Nenhum corretor no time ativo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
