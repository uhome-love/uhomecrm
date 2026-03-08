import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, FileSpreadsheet, Trash2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useVisitaToPdn } from "@/hooks/useVisitaToPdn";
import { useState } from "react";

const STATUS_BADGE_COLORS: Record<string, string> = {
  marcada: "bg-amber-100 text-amber-700 border-amber-300",
  confirmada: "bg-blue-100 text-blue-700 border-blue-300",
  realizada: "bg-green-100 text-green-700 border-green-300",
  reagendada: "bg-purple-100 text-purple-700 border-purple-300",
  cancelada: "bg-gray-100 text-gray-600 border-gray-300",
  no_show: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_EMOJIS: Record<string, string> = {
  marcada: "🟡", confirmada: "🔵", realizada: "✅", reagendada: "🔄", cancelada: "⚫", no_show: "❌",
};

const STATUS_LINE_COLORS: Record<string, string> = {
  marcada: "bg-amber-400",
  confirmada: "bg-blue-500",
  realizada: "bg-green-500",
  reagendada: "bg-purple-500",
  cancelada: "bg-gray-400",
  no_show: "bg-red-500",
};

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 13 && digits.startsWith("55")) return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  return phone;
}

interface Props {
  visita: Visita;
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onDelete?: (id: string) => void;
  showCorretor?: boolean;
  isPastPending?: boolean;
}

export default function VisitaRow({ visita: v, onUpdateStatus, onDelete, showCorretor, isPastPending }: Props) {
  const { convertToPdn } = useVisitaToPdn();
  const [hovered, setHovered] = useState(false);
  const hasPdn = !!(v as any).linked_pdn_id;

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/30",
        isPastPending && "bg-red-50/50"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Time */}
      <div className="w-12 shrink-0 text-center">
        <span className="text-sm font-bold font-mono text-foreground">
          {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
        </span>
      </div>

      {/* Status color line */}
      <div className={cn("w-0.5 h-8 rounded-full shrink-0", STATUS_LINE_COLORS[v.status] || "bg-gray-300")} />

      {/* Client + Phone */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{v.nome_cliente}</p>
        {v.telefone && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {formatPhone(v.telefone)}
          </p>
        )}
      </div>

      {/* Empreendimento */}
      <div className="w-32 shrink-0 hidden sm:block">
        <span className="text-xs text-muted-foreground truncate block">{v.empreendimento || "—"}</span>
      </div>

      {/* Corretor */}
      {showCorretor && (
        <div className="w-28 shrink-0 hidden md:block">
          <span className="text-xs text-muted-foreground truncate block">{v.corretor_nome || "—"}</span>
        </div>
      )}

      {/* PDN badge */}
      {hasPdn && (
        <Badge className="text-[9px] h-5 bg-emerald-100 text-emerald-700 border-emerald-300 shrink-0">PDN</Badge>
      )}

      {/* Status badge */}
      <div className="w-24 shrink-0">
        <Badge className={cn("text-[10px] px-2 py-0.5 border font-semibold", STATUS_BADGE_COLORS[v.status] || "bg-muted text-muted-foreground")}>
          {STATUS_EMOJIS[v.status]} {STATUS_LABELS[v.status]}
        </Badge>
      </div>

      {/* Inline quick actions */}
      <div className={cn("flex items-center gap-1 shrink-0 transition-opacity", hovered ? "opacity-100" : "opacity-0")}>
        {(v.status === "marcada" || v.status === "confirmada") && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-green-300 text-green-700 hover:bg-green-50" onClick={() => onUpdateStatus(v.id, "realizada")}>
              ✅
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-red-300 text-red-700 hover:bg-red-50" onClick={() => onUpdateStatus(v.id, "no_show")}>
              ❌
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => onUpdateStatus(v.id, "reagendada")}>
              🔄
            </Button>
          </>
        )}
      </div>

      {/* Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-xs">
          {Object.entries(STATUS_LABELS)
            .filter(([k]) => k !== v.status)
            .map(([k, label]) => (
              <DropdownMenuItem key={k} onClick={() => onUpdateStatus(v.id, k as VisitaStatus)} className="text-xs">
                {STATUS_EMOJIS[k]} {label}
              </DropdownMenuItem>
            ))}
          {v.status === "realizada" && !hasPdn && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => convertToPdn(v)} className="text-xs text-primary">
                <FileSpreadsheet className="h-3 w-3 mr-1.5" /> Enviar para PDN
              </DropdownMenuItem>
            </>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { if (window.confirm("Tem certeza?")) onDelete(v.id); }}
                className="text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1.5" /> Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
