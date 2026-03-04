import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { ArrowRight, Wand2 } from "lucide-react";
import { toast } from "sonner";

const REQUIRED_FIELDS = [
  { key: "nome", label: "Nome", required: true },
  { key: "email", label: "E-mail", required: true },
  { key: "telefone", label: "Telefone", required: true },
  { key: "interesse", label: "Imóvel de Interesse", required: false },
  { key: "origem", label: "Origem do Lead", required: false },
  { key: "ultimoContato", label: "Último Contato", required: false },
  { key: "status", label: "Status", required: false },
] as const;

// Auto-mapping for Jetimob CSV columns
const JETIMOB_AUTO_MAP: Record<string, string[]> = {
  nome: ["fn", "first_name", "nome", "name"],
  email: ["email_1", "email", "e-mail"],
  telefone: ["phone_1", "telefone", "phone", "celular"],
  interesse: ["imovel_referencia_codigo", "imovel", "interesse", "property"],
  origem: ["origem", "source", "origin", "midia"],
  ultimoContato: ["event_time", "ultimo_contato", "last_contact", "data"],
  status: ["event_name", "status", "situacao"],
};

function autoMap(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  for (const [field, candidates] of Object.entries(JETIMOB_AUTO_MAP)) {
    for (const candidate of candidates) {
      const idx = lowerHeaders.indexOf(candidate.toLowerCase());
      if (idx !== -1) {
        result[field] = headers[idx];
        break;
      }
    }
  }
  return result;
}

interface ColumnMapperProps {
  csvHeaders: string[];
  onMappingComplete: (mapping: Record<string, string>) => void;
}

export default function ColumnMapper({ csvHeaders, onMappingComplete }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [autoMapped, setAutoMapped] = useState(false);

  useEffect(() => {
    const auto = autoMap(csvHeaders);
    if (Object.keys(auto).length > 0) {
      setMapping(auto);
      setAutoMapped(true);
      toast.success(`${Object.keys(auto).length} campos mapeados automaticamente!`);
    }
  }, [csvHeaders]);

  const handleConfirm = () => {
    onMappingComplete(mapping);
  };

  const requiredMapped = REQUIRED_FIELDS
    .filter((f) => f.required)
    .every((f) => mapping[f.key]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Mapear colunas
        </h3>
        {autoMapped && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            <Wand2 className="h-3 w-3" /> Auto-detectado
          </span>
        )}
      </div>
      <p className="mb-2 text-sm text-muted-foreground">
        Associe as colunas do seu CSV aos campos do sistema
      </p>
      <p className="mb-5 text-xs text-muted-foreground">
        * Campos obrigatórios
      </p>

      <div className="space-y-3">
        {REQUIRED_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-sm font-medium text-foreground">
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select
              value={mapping[field.key] || ""}
              onValueChange={(val) =>
                setMapping((prev) => ({ ...prev, [field.key]: val === "__none__" ? "" : val }))
              }
            >
              <SelectTrigger className={`w-full ${mapping[field.key] ? "border-accent/40" : ""}`}>
                <SelectValue placeholder="Selecione a coluna" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {!field.required && (
                  <SelectItem value="__none__" className="text-muted-foreground italic">
                    — Nenhuma —
                  </SelectItem>
                )}
                {csvHeaders.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <Button
        className="mt-6 w-full"
        disabled={!requiredMapped}
        onClick={handleConfirm}
      >
        Importar Leads
      </Button>
    </motion.div>
  );
}
