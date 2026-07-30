import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { fmtMoney as _fmt } from "@/lib/fmtMoney";

export const fmtMoney = (v: number) => _fmt(v, "short");
export const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
export const num1 = (v: number | null) => (v == null ? "—" : v.toFixed(1));
export const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  atividade: "Atividade",
  mudanca_etapa: "Mudança de etapa",
};

export const GRUPO_COR: Record<string, string> = {
  qualificado: "#10b981",
  desqualificado: "#ef4444",
  pendente: "#f59e0b",
  neutro: "#9ca3af",
};

export const th: React.CSSProperties = { textAlign: "right", padding: "6px 8px", fontSize: 11, color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" };
export const thL: React.CSSProperties = { ...th, textAlign: "left" };
export const td: React.CSSProperties = { textAlign: "right", padding: "6px 8px", fontSize: 12, color: "#111827", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
export const tdL: React.CSSProperties = { ...td, textAlign: "left" };

export function taxaColor(v: number | null): string {
  if (v == null) return "#9ca3af";
  if (v >= 0.6) return "#10b981";
  if (v >= 0.35) return "#f59e0b";
  return "#ef4444";
}

/** Card branco padrão, com título e conteúdo opcionalmente colapsável. */
export function Card({
  title, note, children, collapsible = false, defaultOpen = true, right, forceOpen = false,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  right?: ReactNode;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || !collapsible || open;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isOpen ? 10 : 0 }}>
        {collapsible && !forceOpen && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Recolher" : "Expandir"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#6b7280", display: "flex" }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <div
          onClick={collapsible && !forceOpen ? () => setOpen((o) => !o) : undefined}
          style={{ fontSize: 13, fontWeight: 600, color: "#111827", cursor: collapsible && !forceOpen ? "pointer" : "default" }}
        >
          {title}
        </div>
        {note && <Hint text={note} />}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>{right}</div>
      </div>
      {isOpen && children}
    </div>
  );
}

/** Ícone de ajuda com tooltip nativo — tira o texto explicativo do fluxo visual. */
export function Hint({ text }: { text: string }) {
  return (
    <span title={text} style={{ display: "inline-flex", color: "#c7c7d1", cursor: "help" }}>
      <HelpCircle size={13} />
    </span>
  );
}

export function EmptyState({ label = "Sem dados no período." }: { label?: string }) {
  return <div style={{ fontSize: 12, color: "#9ca3af", padding: "10px 2px" }}>{label}</div>;
}

export function TopNSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "4px 6px", fontSize: 11, color: "#6b7280", background: "#fff" }}
    >
      <option value="10">Top 10</option>
      <option value="25">Top 25</option>
      <option value="9999">Tudo</option>
    </select>
  );
}

export function ToggleBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer",
        background: active ? "#eef2ff" : "#fff", color: active ? "#4338ca" : "#6b7280",
      }}
    >
      {children}
    </button>
  );
}

/** Cabeçalho clicável de coluna ordenável. */
export function SortTh({
  label, col, sort, onSort, align = "right", title,
}: {
  label: string; col: string; sort: { col: string; dir: "asc" | "desc" }; onSort: (c: string) => void; align?: "left" | "right"; title?: string;
}) {
  const active = sort.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      title={title}
      style={{ ...(align === "left" ? thL : th), cursor: "pointer", color: active ? "#4338ca" : "#6b7280" }}
    >
      {label}{active ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );
}

export function sortRows<T>(rows: T[], col: string, dir: "asc" | "desc", get: (r: T, c: string) => number | string | null): T[] {
  const mult = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = get(a, col);
    const vb = get(b, col);
    if (typeof va === "string" || typeof vb === "string") {
      return String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR") * mult;
    }
    return ((va ?? -1) - (vb ?? -1)) * mult;
  });
}
