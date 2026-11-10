// ─────────────────────────────────────────────────────────────────
// DrawerTopo — topo único da ficha (largura total).
// Nome + etapa/situação/temperatura/saúde + linha de dados (produto ·
// origem · entrada · corretor) + contatos com copiar + ações compactas.
// ─────────────────────────────────────────────────────────────────
import { Copy, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/leadHelpers";
import type { ReactNode } from "react";
import type { LocalTelefone } from "@/lib/dddUf";

interface Props {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  pills?: ReactNode;
  meta: string[];
  actions?: ReactNode;
  canEdit?: boolean;
  editingName: boolean;
  editName: string;
  setEditName: (v: string) => void;
  startEditName: () => void;
  cancelEditName: () => void;
  saveName: () => void;
  editingPhone: boolean;
  editPhone: string;
  setEditPhone: (v: string) => void;
  startEditPhone: () => void;
  cancelEditPhone: () => void;
  savePhone: () => void;
  saving?: boolean;
  /** Chip "DDD 44 · Paraná" quando o telefone é de fora do RS. */
  localTelefone?: LocalTelefone | null;
  /** Extra no fim da linha de dados (ex.: último movimento de etapa). */
  metaExtra?: ReactNode;
}

function copiar(valor: string, rotulo: string) {
  void navigator.clipboard?.writeText(valor).then(
    () => toast.success(`${rotulo} copiado`),
    () => toast.error("Não foi possível copiar"),
  );
}

export function formatTelefoneBR(t?: string | null): string {
  const d = (t ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? "";
}

export default function DrawerTopo(p: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-5">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className="h-11 w-11 md:h-12 md:w-12 rounded-full flex items-center justify-center shrink-0 bg-primary text-primary-foreground font-semibold text-base md:text-lg"
          aria-hidden
        >
          {getInitials(p.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap min-w-0">
            {p.editingName ? (
              <div className="flex items-center gap-1.5 w-full">
                <Input value={p.editName} onChange={(e) => p.setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") p.saveName(); if (e.key === "Escape") p.cancelEditName(); }}
                  className="h-8 text-base font-bold flex-1" autoFocus disabled={p.saving} />
                <Button size="sm" variant="ghost" onClick={p.saveName} disabled={p.saving} className="h-7 px-2 text-xs">
                  {p.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={p.cancelEditName} className="h-7 px-2 text-xs">Cancelar</Button>
              </div>
            ) : (
              <h2
                className="text-[17px] md:text-[19px] font-bold text-foreground truncate max-w-full tracking-tight cursor-pointer hover:text-primary transition-colors"
                onClick={p.startEditName}
                title="Clique para editar o nome"
              >
                {p.nome}
              </h2>
            )}
            {!p.editingName && <div className="flex items-center gap-1.5 shrink-0">{p.pills}</div>}
          </div>

          {(p.meta.length > 0 || p.metaExtra) && (
            <div className="mt-0.5 flex items-center gap-2 min-w-0 text-[12px]">
              {p.meta.length > 0 && <p className="text-muted-foreground truncate min-w-0">{p.meta.join(" · ")}</p>}
              {p.metaExtra && <div className="hidden md:flex min-w-0 shrink items-center">{p.metaExtra}</div>}
            </div>
          )}

          <div className="mt-0.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px]">
            {p.editingPhone ? (
              <div className="flex items-center gap-1">
                <Input value={p.editPhone} onChange={(e) => p.setEditPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") p.savePhone(); if (e.key === "Escape") p.cancelEditPhone(); }}
                  className="h-7 w-40 text-[12px]" placeholder="(00) 00000-0000" autoFocus />
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={p.savePhone} disabled={p.saving}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={p.cancelEditPhone}>Cancelar</Button>
              </div>
            ) : p.telefone ? (
              <span className="inline-flex items-center gap-1 text-foreground/80">
                <a href={`tel:${p.telefone}`} className="hover:text-primary tabular-nums">{formatTelefoneBR(p.telefone)}</a>
                <button onClick={() => copiar(p.telefone!, "Telefone")} aria-label="Copiar telefone" className="text-muted-foreground hover:text-foreground p-0.5">
                  <Copy className="h-3 w-3" />
                </button>
                {p.canEdit && (
                  <button onClick={p.startEditPhone} aria-label="Editar telefone" className="text-muted-foreground hover:text-foreground p-0.5">
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                {p.localTelefone && (
                  <span className="ml-1 inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                    DDD {p.localTelefone.ddd} · {p.localTelefone.nome}
                  </span>
                )}
              </span>
            ) : p.canEdit ? (
              <button onClick={p.startEditPhone} className="text-muted-foreground hover:text-foreground">Adicionar telefone</button>
            ) : (
              <span className="text-muted-foreground italic">Sem telefone</span>
            )}
            {p.email && (
              <span className="inline-flex items-center gap-1 text-foreground/80 min-w-0">
                <a href={`mailto:${p.email}`} className="hover:text-primary truncate max-w-[240px]">{p.email}</a>
                <button onClick={() => copiar(p.email!, "E-mail")} aria-label="Copiar e-mail" className="text-muted-foreground hover:text-foreground p-0.5">
                  <Copy className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          {p.metaExtra && <div className="mt-1 flex md:hidden min-w-0">{p.metaExtra}</div>}
        </div>
      </div>
      {p.actions && <div className="hidden md:flex items-center gap-1.5 shrink-0">{p.actions}</div>}
    </div>
  );
}
