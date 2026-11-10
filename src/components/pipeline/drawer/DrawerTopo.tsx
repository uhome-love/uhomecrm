// ─────────────────────────────────────────────────────────────────
// DrawerTopo — topo único da ficha (largura total).
// Nome + etapa/situação/temperatura/saúde + linha de dados (produto ·
// origem · entrada · corretor) + contatos com copiar + ações compactas.
// ─────────────────────────────────────────────────────────────────
import { Copy, Loader2, Pencil, UserRound } from "lucide-react";
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
  /** Nome do corretor responsável (linha de contato). */
  responsavel?: string | null;
  /** Extra no fim da linha de situação (ex.: último movimento de etapa). */
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
    <div className="flex flex-col min-w-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className="h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center shrink-0 bg-primary text-primary-foreground font-semibold text-base md:text-lg"
          aria-hidden
        >
          {getInitials(p.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0 min-h-9">
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
                className="text-[17px] md:text-[19px] font-bold text-foreground flex-1 min-w-0 leading-tight break-words tracking-tight outline-none focus:outline-none cursor-pointer hover:text-primary transition-colors"
                data-lead-titulo
                tabIndex={-1}
                onClick={p.startEditName}
                title="Clique para editar o nome"
              >
                {p.nome}
              </h2>
            )}
            {p.actions && <div className="hidden md:flex items-center gap-1.5 shrink-0">{p.actions}</div>}
          </div>
        </div>
      </div>
      <div className="min-w-0 mt-1 md:-mt-2.5 md:pl-[60px]">
          {(p.pills || p.metaExtra) && (
            <div className="mt-0.5 flex items-center gap-1 min-[380px]:gap-1.5 flex-wrap md:flex-nowrap min-w-0 max-[380px]:[&_.rounded-full]:px-2 max-[380px]:[&_.rounded-full]:gap-0.5">
              {p.pills}
              {p.metaExtra && <div className="flex min-w-0 flex-1 basis-full md:basis-auto items-center md:pl-1">{p.metaExtra}</div>}
            </div>
          )}

          <div className="mt-0.5 flex flex-col md:flex-row md:items-center gap-x-3 gap-y-0 md:gap-y-1 md:flex-wrap text-[12px]">
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
                <button onClick={() => copiar(p.telefone!, "Telefone")} aria-label="Copiar telefone" className="shrink-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground h-10 w-10 -my-2.5 -mx-3 md:h-auto md:w-auto md:m-0 md:p-0.5">
                  <Copy className="h-3 w-3" />
                </button>
                {p.canEdit && (
                  <button onClick={p.startEditPhone} aria-label="Editar telefone" className="shrink-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground h-10 w-10 -my-2.5 -mx-3 md:h-auto md:w-auto md:m-0 md:p-0.5">
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                {p.localTelefone && (
                  <span className="ml-1 inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                    DDD {p.localTelefone.ddd} · {p.localTelefone.uf}
                  </span>
                )}
              </span>
            ) : p.canEdit ? (
              <button onClick={p.startEditPhone} className="text-muted-foreground hover:text-foreground">Adicionar telefone</button>
            ) : (
              <span className="text-muted-foreground italic">Sem telefone</span>
            )}
            <div className="flex items-center gap-3 min-w-0 md:contents">
            {p.email && (
              <span className="inline-flex items-center gap-1 text-foreground/80 min-w-0 flex-1 md:flex-none">
                <a href={`mailto:${p.email}`} className="hover:text-primary truncate min-w-0 md:max-w-[240px]">{p.email}</a>
                <button onClick={() => copiar(p.email!, "E-mail")} aria-label="Copiar e-mail" className="shrink-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground h-10 w-10 -my-2.5 -mx-3 md:h-auto md:w-auto md:m-0 md:p-0.5">
                  <Copy className="h-3 w-3" />
                </button>
              </span>
            )}
            {p.responsavel && (
              <span className="inline-flex items-center gap-1 text-foreground/80 shrink-0 md:shrink md:min-w-0">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-label="Responsável" />
                <span className="whitespace-nowrap md:truncate">{p.responsavel}</span>
              </span>
            )}
            </div>
          </div>
      </div>
    </div>
  );
}
