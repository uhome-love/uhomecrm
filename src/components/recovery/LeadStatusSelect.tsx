import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { StatusRecuperacao } from "@/types/lead";

interface LeadStatusSelectProps {
  value?: StatusRecuperacao;
  onChange: (value: StatusRecuperacao) => void;
  compact?: boolean;
}

const STATUS_OPTIONS: { value: StatusRecuperacao; label: string; emoji: string; className: string }[] = [
  { value: "pendente", label: "Pendente", emoji: "⏳", className: "bg-muted text-muted-foreground" },
  { value: "contato_realizado", label: "Contato Realizado", emoji: "📞", className: "bg-info/15 text-info" },
  { value: "respondeu", label: "Respondeu", emoji: "💬", className: "bg-accent/15 text-accent" },
  { value: "reativado", label: "Reativado", emoji: "🔄", className: "bg-primary/15 text-primary" },
  { value: "sem_interesse", label: "Sem Interesse", emoji: "❌", className: "bg-warning/15 text-warning" },
  { value: "numero_invalido", label: "Nº Inválido", emoji: "📵", className: "bg-destructive/15 text-destructive" },
  { value: "recuperado", label: "RECUPERADO", emoji: "✅", className: "bg-success/15 text-success font-bold" },
];

export function LeadStatusBadge({ status }: { status?: StatusRecuperacao }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === (status || "pendente")) || STATUS_OPTIONS[0];
  return (
    <Badge variant="outline" className={`text-[10px] ${opt.className} border-current/20`}>
      {opt.emoji} {opt.label}
    </Badge>
  );
}

export default function LeadStatusSelect({ value, onChange, compact }: LeadStatusSelectProps) {
  const current = STATUS_OPTIONS.find((o) => o.value === (value || "pendente")) || STATUS_OPTIONS[0];

  return (
    <Select value={value || "pendente"} onValueChange={(v) => onChange(v as StatusRecuperacao)}>
      <SelectTrigger className={`${compact ? "h-7 text-[11px] w-[140px]" : "h-8 text-xs w-[160px]"} ${current.className} border-current/20`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-1.5">
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
