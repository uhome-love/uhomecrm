import { useState } from "react";
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
} from "lucide-react";
import type { MaterialEmpreendimento, MaterialLink } from "@/hooks/useMateriais";
import { LinkFormDialog } from "./LinkFormDialog";
import { EmpreendimentoFormDialog } from "./EmpreendimentoFormDialog";
import { UploadMaterialDialog } from "./UploadMaterialDialog";
import { MaterialPreviewDialog } from "./MaterialPreviewDialog";
import { MaterialItem, isPreviewable } from "./MaterialItem";
import { FollowUpMaterialDialog } from "./FollowUpMaterialDialog";
import { useMateriaisMutations } from "@/hooks/useMateriaisMutations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  registrarMaterialRecente,
  useEmpreendimentoFavoritoIds,
  useToggleEmpreendimentoFavorito,
} from "@/hooks/useMateriaisFavoritos";
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
  const [followUp, setFollowUp] = useState<{ open: boolean; materiais: MaterialLink[] }>({
    open: false, materiais: [],
  });

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
              onClick={() => setFollowUp({ open: true, materiais: empreendimento.links })}
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

      {/* Grid de materiais */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
            {empreendimento.links.map((link) => (
              <MaterialItem
                key={link.id}
                link={link}
                canEdit={canEdit}
                onCopy={() => copyLink(link)}
                onDownload={() => downloadLink(link)}
                onOpen={() => openLink(link)}
                onFollowUp={() => setFollowUp({ open: true, materiais: [link] })}
                onEdit={canEdit ? () => setLinkDialog({ open: true, link }) : undefined}
                onDelete={canEdit ? () => setLinkToDelete(link) : undefined}
                onReprocess={canEdit ? () => reprocessIngest(link.id) : undefined}
              />
            ))}
          </div>
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
            onClick={() => setFollowUp({ open: true, materiais: empreendimento.links })}
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
        materiais={followUp.materiais}
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
