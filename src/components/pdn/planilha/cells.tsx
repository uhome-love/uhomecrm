import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import type { PdnRow } from "@/hooks/usePdn";
import { publicarNoLead } from "@/components/pdn/drawer/publish";

// ─── Status: opções fixas (com cores) + livre ─────────────────────────────────
export const STATUS_OPTS: { grupo: string; items: string[] }[] = [
  { grupo: "Comercial", items: ["Aguardando docs", "Em aprovação", "Negociando", "Proposta", "Follow up"] },
  { grupo: "Contrato", items: ["Em confecção", "Gerado", "Assinado"] },
];

export const STATUS_COLOR: Record<string, string> = {
  "Aguardando docs": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "Em aprovação": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "Negociando": "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  "Proposta": "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  "Follow up": "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "Em confecção": "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "Gerado": "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  "Assinado": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export function statusChipClass(s: string) {
  return STATUS_COLOR[s] || "bg-muted text-muted-foreground";
}

// ─── Guarda: evita que o clique/close de um popover inline (Status/Obs/Empr)
// vaze para a TableRow e abra o drawer sem querer. Ativa por 400ms após close.
let __pdnSuppressRowOpenUntil = 0;
export function suppressPdnRowOpen() {
  __pdnSuppressRowOpenUntil = Date.now() + 400;
}
export function isPdnRowOpenSuppressed() {
  return Date.now() < __pdnSuppressRowOpenUntil;
}

// ─── Célula editável simples (input com commit no blur) ───────────────────────
export function EditableCell({
  value, onCommit, type = "text", placeholder, className = "",
}: {
  value: string | number;
  onCommit: (v: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(String(value ?? ""));
  useEffect(() => { setLocal(String(value ?? "")); }, [value]);
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

// ─── Seletor de Status (presets + livre) ──────────────────────────────────────
export function StatusSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) suppressPdnRowOpen(); }}>
      <PopoverTrigger asChild>
        <button className="w-full text-left" onClick={(e) => e.stopPropagation()}>
          {value
            ? <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusChipClass(value)}`}>{value}</span>
            : <span className="text-sm text-muted-foreground">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          {STATUS_OPTS.map(g => (
            <div key={g.grupo}>
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.grupo}</div>
              <div className="flex flex-wrap gap-1">
                {g.items.map(s => (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onChange(s); suppressPdnRowOpen(); setOpen(false); }}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${value === s ? "ring-2 ring-primary " : ""}${statusChipClass(s)}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t pt-2">
            <Input
              value={custom}
              placeholder="Status personalizado…"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onChange(custom.trim()); setCustom(""); suppressPdnRowOpen(); setOpen(false); } }}
              className="h-8"
            />
          </div>
          {value && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={(e) => { e.stopPropagation(); onChange(""); suppressPdnRowOpen(); setOpen(false); }}>
              Limpar status
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Observação multilinha (popover com textarea + salvar/publicar) ───────────
export function ObsSelector({
  value, onChange, pipelineLeadId, row,
}: {
  value: string;
  onChange: (v: string) => void;
  pipelineLeadId?: string | null;
  row?: PdnRow;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value ?? "");
  const [publishing, setPublishing] = useState(false);
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  const commit = () => { if (local !== (value ?? "")) onChange(local); suppressPdnRowOpen(); setOpen(false); };
  const commitAndPublish = async () => {
    if (!pipelineLeadId) return;
    const clean = local.trim();
    if (!clean) { toast.info("Escreva algo antes de publicar"); return; }
    setPublishing(true);
    try {
      if (local !== (value ?? "")) onChange(local);
      await publicarNoLead(pipelineLeadId, "observacao", clean, row);
      suppressPdnRowOpen();
      setOpen(false);
    } finally { setPublishing(false); }
  };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o && !publishing) commit(); else if (o) setOpen(true); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="line-clamp-4 w-full whitespace-pre-wrap break-words text-left text-sm text-muted-foreground hover:text-foreground"
        >
          {value ? value : <span className="text-muted-foreground/60">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Textarea
          autoFocus
          value={local}
          placeholder="Anotações do gestor…"
          onChange={(e) => setLocal(e.target.value)}
          className="min-h-[120px] resize-y text-sm"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {pipelineLeadId ? "Publicar também avisa o corretor no histórico do lead." : "Sem lead vinculado — só grava no PDN."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); commit(); }} disabled={publishing}>Salvar</Button>
            {pipelineLeadId && (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); commitAndPublish(); }} disabled={publishing || !local.trim()}>
                {publishing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Megaphone className="mr-1 h-3 w-3" />}
                Salvar e publicar
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Célula editável com quebra de linha (empreendimento) ─────────────────────
export function EditableWrapCell({ value, onCommit, placeholder }: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  const commit = () => { if (local !== (value ?? "")) onCommit(local); suppressPdnRowOpen(); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) commit(); else setOpen(true); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-full whitespace-pre-wrap break-words text-left text-sm hover:text-foreground"
        >
          {value ? value : <span className="text-muted-foreground/60">{placeholder || "—"}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Textarea
          autoFocus
          value={local}
          placeholder={placeholder || "Empreendimento…"}
          onChange={(e) => setLocal(e.target.value)}
          className="min-h-[70px] resize-y text-sm"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); commit(); }}>Salvar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
