import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, MoreVertical, Pencil, Plus, Trash2, Upload, Star, Copy, Sparkles,
  Image as ImageIcon, Video as VideoIcon, FileText, Music, Link2, Files,
} from "lucide-react";
import type { MaterialEmpreendimento, MaterialLink } from "@/hooks/useMateriais";
import { LinkFormDialog } from "./LinkFormDialog";
import { EmpreendimentoFormDialog } from "./EmpreendimentoFormDialog";
import { UploadMaterialDialog } from "./UploadMaterialDialog";
import { MaterialPreviewDialog } from "./MaterialPreviewDialog";
import { MaterialItem, isPreviewable, getMediaKind, type MediaKind } from "./MaterialItem";
import { FollowUpMaterialDialog } from "./FollowUpMaterialDialog";
import { useMateriaisMutations } from "@/hooks/useMateriaisMutations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  registrarMaterialRecente,
  useEmpreendimentoFavoritoIds,
  useToggleEmpreendimentoFavorito,
} from "@/hooks/useMateriaisFavoritos";
import { getCategoriaInfo } from "./CategoriaIcon";
import { cn } from "@/lib/utils";

interface Props {
  empreendimento: MaterialEmpreendimento;
  canEdit: boolean;
}

export function MateriaisEmpreendimentoPanel({ empreendimento, canEdit }: Props) {
  const { deleteEmpreendimento, deleteLink } = useMateriaisMutations();
  const { data: favEmpIds } = useEmpreendimentoFavoritoIds();
  const toggleFavEmp = useToggleEmpreendimentoFavorito();
  const isFav = !!favEmpIds?.has(empreendimento.id);

  const [editEmp, setEditEmp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; link: MaterialLink | null }>({
    open: false, link: null,
  });
  const [linkToDelete, setLinkToDelete] = useState<MaterialLink | null>(null);
  const [previewLink, setPreviewLink] = useState<MaterialLink | null>(null);
  const [followUp, setFollowUp] = useState<{ open: boolean; preSelectedIds: string[] }>({
    open: false, preSelectedIds: [],
  });
  const [kindFilter, setKindFilter] = useState<MediaKind | "all">("all");

  const getSignedUrl = async (link: MaterialLink, download = false): Promise<string | null> => {
    if (!link.storage_path) return link.url || null;
    try {
      const { data, error } = await supabase.functions.invoke("materiais-signed-read", {
        body: { storage_path: link.storage_path, material_id: link.id, download, filename: link.titulo },
      });
      if (error) throw error;
      const url = (data as any)?.url || (data as any)?.signed_url;
      if (!url) throw new Error("Sem URL");
      return url;
    } catch (e: any) {
      toast({ title: "Erro ao obter link", description: e.message, variant: "destructive" });
      return null;
    }
  };

  const openLink = async (link: MaterialLink) => {
    registrarMaterialRecente(link.id, isPreviewable(link) ? "preview" : "abrir");
    if (isPreviewable(link)) { setPreviewLink(link); return; }
    const url = await getSignedUrl(link, false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadLink = async (link: MaterialLink) => {
    registrarMaterialRecente(link.id, "download");
    if (!link.storage_path) {
      if (link.url) window.open(link.url, "_blank", "noopener,noreferrer");
      return;
    }
    const url = await getSignedUrl(link, true);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.rel = "noopener noreferrer"; a.click();
  };

  const copyLink = async (link: MaterialLink) => {
    const url = await getSignedUrl(link, false);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      registrarMaterialRecente(link.id, "copiar");
      toast({ title: "Link copiado", description: link.storage_path ? "Válido por 10 minutos." : undefined });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const copyAllLinks = async () => {
    const lines: string[] = [`*${empreendimento.nome}*`, ""];
    for (const link of empreendimento.links) {
      const url = await getSignedUrl(link, false);
      if (url) lines.push(`• ${link.titulo}\n  ${url}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: `${empreendimento.links.length} links copiados` });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const reprocessIngest = async (materialId: string) => {
    try {
      await supabase.functions.invoke("materiais-ingest", { body: { material_id: materialId } });
      toast({ title: "Reprocessando com IA..." });
    } catch (e: any) {
      toast({ title: "Erro ao reprocessar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header do painel — compacto */}
      <div className="flex items-center gap-3 pb-2.5 mb-2.5 border-b border-border/60">
        {empreendimento.logo_url ? (
          <img
            src={empreendimento.logo_url}
            alt={empreendimento.nome}
            className="h-10 w-10 rounded-md object-cover border border-border/60 flex-shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground text-lg leading-tight truncate">{empreendimento.nome}</h2>
          <p className="text-xs text-muted-foreground">
            {empreendimento.links.length} {empreendimento.links.length === 1 ? "material" : "materiais"}
          </p>
        </div>
        {empreendimento.links.length > 0 && (
          <>
            <Button variant="outline" size="sm" className="h-8 hidden sm:inline-flex" onClick={copyAllLinks}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-primary border-primary/40 hover:bg-primary/10 hidden sm:inline-flex"
              onClick={() => setFollowUp({ open: true, preSelectedIds: empreendimento.links.map((l) => l.id) })}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Follow-up IA
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", isFav && "text-yellow-500")}
          title={isFav ? "Remover dos favoritos" : "Favoritar empreendimento"}
          onClick={() => toggleFavEmp.mutate({ empreendimentoId: empreendimento.id, isFav })}
        >
          <Star className={cn("h-4 w-4", isFav && "fill-yellow-500")} />
        </Button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditEmp(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar empreendimento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Enviar arquivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinkDialog({ open: true, link: null })}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar link
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Excluir empreendimento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Lista agrupada por categoria + filtros por tipo */}
      <div className="flex-1">
        {empreendimento.links.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhum material cadastrado para este empreendimento.
            {canEdit && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Enviar arquivo
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLinkDialog({ open: true, link: null })}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar link
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Chips de filtro por tipo de mídia */}
            <KindFilterBar
              links={empreendimento.links}
              active={kindFilter}
              onChange={setKindFilter}
            />

            <GroupedMaterialList
              links={
                kindFilter === "all"
                  ? empreendimento.links
                  : empreendimento.links.filter((l) => getMediaKind(l) === kindFilter)
              }
              canEdit={canEdit}
              onCopy={copyLink}
              onDownload={downloadLink}
              onOpen={openLink}
              onFollowUp={(link) => setFollowUp({ open: true, preSelectedIds: [link.id] })}
              onEdit={(link) => setLinkDialog({ open: true, link })}
              onDelete={(link) => setLinkToDelete(link)}
              onReprocess={(link) => reprocessIngest(link.id)}
            />
          </>
        )}
      </div>

      {/* Footer com ações agregadas — só mobile (no desktop ficam no header) */}
      {empreendimento.links.length > 0 && (
        <div className="pt-3 mt-3 border-t border-border/60 flex flex-col gap-2 sm:hidden">
          <Button variant="default" size="sm" onClick={copyAllLinks}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar todos os links
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-primary border-primary/40 hover:bg-primary/10"
            onClick={() => setFollowUp({ open: true, preSelectedIds: empreendimento.links.map((l) => l.id) })}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Gerar follow-up com IA
          </Button>
        </div>
      )}

      <EmpreendimentoFormDialog
        open={editEmp}
        onOpenChange={setEditEmp}
        empreendimento={empreendimento}
      />
      <LinkFormDialog
        open={linkDialog.open}
        onOpenChange={(o) => setLinkDialog((s) => ({ ...s, open: o }))}
        empreendimentoId={empreendimento.id}
        link={linkDialog.link}
      />
      <UploadMaterialDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        empreendimentoId={empreendimento.id}
      />
      <MaterialPreviewDialog
        open={!!previewLink}
        onOpenChange={(o) => !o && setPreviewLink(null)}
        link={previewLink}
      />
      <FollowUpMaterialDialog
        open={followUp.open}
        onOpenChange={(o) => setFollowUp((s) => ({ ...s, open: o }))}
        empreendimentoNome={empreendimento.nome}
        todosMateriais={empreendimento.links}
        preSelectedIds={followUp.preSelectedIds}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empreendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove "{empreendimento.nome}" e todos os {empreendimento.links.length} links vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEmpreendimento.mutate(empreendimento.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!linkToDelete} onOpenChange={(o) => !o && setLinkToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>
              "{linkToDelete?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (linkToDelete) deleteLink.mutate(linkToDelete.id);
                setLinkToDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Filtro por tipo de mídia ----------
const KIND_CHIPS: Array<{ key: MediaKind; label: string; icon: any }> = [
  { key: "image", label: "Imagens", icon: ImageIcon },
  { key: "video", label: "Vídeos", icon: VideoIcon },
  { key: "pdf",   label: "PDFs",    icon: FileText },
  { key: "audio", label: "Áudios",  icon: Music },
  { key: "link",  label: "Links",   icon: Link2 },
  { key: "other", label: "Outros",  icon: Files },
];

function KindFilterBar({
  links, active, onChange,
}: { links: MaterialLink[]; active: MediaKind | "all"; onChange: (k: MediaKind | "all") => void }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: links.length };
    for (const l of links) {
      const k = getMediaKind(l);
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [links]);

  const visibleChips = KIND_CHIPS.filter((c) => (counts[c.key] || 0) > 0);
  if (visibleChips.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <button
        onClick={() => onChange("all")}
        className={cn(
          "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
          active === "all"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:border-primary/50",
        )}
      >
        Todos <span className="opacity-70">({counts.all})</span>
      </button>
      {visibleChips.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5",
            active === key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:border-primary/50",
          )}
        >
          <Icon className="h-3 w-3" />
          {label} <span className="opacity-70">({counts[key]})</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Lista agrupada por categoria ----------
function GroupedMaterialList({
  links, canEdit, onCopy, onDownload, onOpen, onFollowUp, onEdit, onDelete, onReprocess,
}: {
  links: MaterialLink[];
  canEdit: boolean;
  onCopy: (l: MaterialLink) => void;
  onDownload: (l: MaterialLink) => void;
  onOpen: (l: MaterialLink) => void;
  onFollowUp: (l: MaterialLink) => void;
  onEdit: (l: MaterialLink) => void;
  onDelete: (l: MaterialLink) => void;
  onReprocess: (l: MaterialLink) => void;
}) {
  const grupos = useMemo(() => {
    const m = new Map<string, MaterialLink[]>();
    for (const l of links) {
      const key = l.categoria || "outros";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    // Ordem: alfabética pelo label da categoria
    return Array.from(m.entries())
      .map(([key, items]) => ({ key, info: getCategoriaInfo(key), items }))
      .sort((a, b) => a.info.label.localeCompare(b.info.label));
  }, [links]);

  if (links.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Nenhum material nesse filtro.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map(({ key, info, items }) => {
        const Icon = info.icon;
        return (
          <section key={key}>
            <header className="flex items-center gap-2 mb-1.5 px-1">
              <Icon className={cn("h-3.5 w-3.5", info.color)} />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {info.label}
              </h3>
              <span className="text-[11px] text-muted-foreground/70">({items.length})</span>
              <div className="flex-1 h-px bg-border/60 ml-1" />
            </header>
            <div className="rounded-lg border border-border/50 divide-y divide-border/50 bg-card/40">
              {items.map((link) => (
                <MaterialItem
                  key={link.id}
                  link={link}
                  canEdit={canEdit}
                  onCopy={() => onCopy(link)}
                  onDownload={() => onDownload(link)}
                  onOpen={() => onOpen(link)}
                  onFollowUp={() => onFollowUp(link)}
                  onEdit={canEdit ? () => onEdit(link) : undefined}
                  onDelete={canEdit ? () => onDelete(link) : undefined}
                  onReprocess={canEdit ? () => onReprocess(link) : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
