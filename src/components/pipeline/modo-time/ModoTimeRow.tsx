/**
 * ModoTimeRow — linha individual da tabela do Modo Time.
 *
 * Click na linha → callback que filtra o Kanban pelo corretor e troca a aba.
 */
import { type TimeAgregadoRow } from "@/hooks/useTimeAgregado";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  row: TimeAgregadoRow;
  onClick: (corretorId: string) => void;
}

function formatVgv(v: number): string {
  if (!v) return "—";
  return fmtMoney(v, "short");
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1).replace(".", ",")}%`;
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ModoTimeRow({ row, onClick }: Props) {
  const numCell = (n: number, danger?: boolean, warn?: boolean) => (
    <td
      className={`px-4 py-3 text-sm tabular-nums text-right ${
        danger && n > 0
          ? "text-red-600 font-semibold"
          : warn && n > 0
          ? "text-amber-600 font-semibold"
          : "text-neutral-700"
      }`}
    >
      {n}
    </td>
  );

  return (
    <tr
      onClick={() => onClick(row.corretor_id)}
      className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {row.avatar_url ? (
            <img
              src={row.avatar_url}
              alt={row.nome}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#3B52CC] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
              {getInitials(row.nome)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#0A0E1A] truncate">{row.nome}</div>
            {row.alerta_principal && (
              <div className="text-[11px] text-red-600 font-medium truncate mt-0.5">
                ⚠ {row.alerta_principal}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-right text-neutral-700">
        {row.total_leads}
        <span className="text-neutral-400"> / {row.total_recebidos}</span>
      </td>
      {numCell(row.sem_tarefa, false, true)}
      {numCell(row.atrasados, true)}
      {numCell(row.em_dia)}
      {numCell(row.para_hoje, false, true)}
      {numCell(row.negocios)}
      <td className="px-4 py-3 text-sm tabular-nums text-right text-neutral-700">
        {formatVgv(row.vgv_pipeline)}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-right text-neutral-700">
        {formatPct(row.conversao_pct)}
      </td>
    </tr>
  );
}
