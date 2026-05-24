// ─────────────────────────────────────────────────────────────────
// DrawerLeadHeader — header editorial da coluna esquerda (v4)
//
// Avatar gradient com iniciais + nome 20/700 + pílulas (slots) +
// linhas de contato (📞 / ✉) com border-bottom sutil.
// ─────────────────────────────────────────────────────────────────
import { Phone, Mail, Pencil, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/leadHelpers";
import type { ReactNode } from "react";

interface Props {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  /** Conteúdo de pílulas (stage, status, etc) renderizado pelo pai pra preservar comportamento. */
  pills?: ReactNode;
  /** Pode editar nome/telefone (admin) */
  canEdit?: boolean;
  // edição de nome
  editingName: boolean;
  editName: string;
  setEditName: (v: string) => void;
  startEditName: () => void;
  cancelEditName: () => void;
  saveName: () => void;
  // edição de telefone
  editingPhone: boolean;
  editPhone: string;
  setEditPhone: (v: string) => void;
  startEditPhone: () => void;
  cancelEditPhone: () => void;
  savePhone: () => void;
  saving?: boolean;
}

export default function DrawerLeadHeader({
  nome, telefone, email, pills, canEdit,
  editingName, editName, setEditName, startEditName, cancelEditName, saveName,
  editingPhone, editPhone, setEditPhone, startEditPhone, cancelEditPhone, savePhone,
  saving,
}: Props) {
  const initials = getInitials(nome);

  return (
    <div className="pb-3 border-b border-border/50">
      {/* Linha 1: avatar + nome/pílulas */}
      <div className="flex items-start gap-3">
        <div
          className="h-14 w-14 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-[22px] shadow-sm"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7e22ce)", letterSpacing: "-0.5px" }}
          aria-label={`Avatar de ${nome}`}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") cancelEditName(); }}
                className="h-8 text-lg font-bold flex-1"
                autoFocus
                disabled={saving}
              />
              <Button size="sm" variant="ghost" onClick={saveName} disabled={saving} className="h-7 px-2 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓"}
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEditName} className="h-7 px-2 text-xs">✕</Button>
            </div>
          ) : (
            <h2
              className="text-[20px] font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
              style={{ letterSpacing: "-0.3px", lineHeight: 1.2 }}
              onClick={startEditName}
              title="Clique para editar"
            >
              {nome}
            </h2>
          )}

          {pills && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {pills}
            </div>
          )}
        </div>
      </div>

      {/* Linhas de contato */}
      <div className="mt-3 divide-y divide-border/40">
        {/* Telefone */}
        <div className="flex items-center gap-2 py-1.5 text-[13px]">
          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {editingPhone ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") savePhone(); if (e.key === "Escape") cancelEditPhone(); }}
                className="h-7 text-[13px] flex-1"
                placeholder="(00) 00000-0000"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={savePhone} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEditPhone}>Cancelar</Button>
            </div>
          ) : telefone ? (
            <>
              <a href={`tel:${telefone}`} className="text-foreground hover:text-primary transition-colors truncate flex-1">
                {telefone}
              </a>
              {canEdit && (
                <button onClick={startEditPhone} className="text-muted-foreground hover:text-foreground shrink-0">
                  <Pencil className="h-3 w-3" strokeWidth={1.5} />
                </button>
              )}
            </>
          ) : canEdit ? (
            <button onClick={startEditPhone} className="text-muted-foreground hover:text-foreground text-xs">
              Adicionar telefone
            </button>
          ) : (
            <span className="text-muted-foreground text-xs italic">Sem telefone</span>
          )}
        </div>

        {/* Email */}
        {email && (
          <div className="flex items-center gap-2 py-1.5 text-[13px]">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <a href={`mailto:${email}`} className="text-foreground hover:text-primary transition-colors truncate flex-1">
              {email}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
