import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, ExternalLink, MoreVertical, Pencil, Plus, RefreshCw, Share2, Trash2, Upload, Download, Copy, MessageCircle } from "lucide-react";
import type { MaterialEmpreendimento, MaterialLink } from "@/hooks/useMateriais";
import { getCategoriaInfo } from "./CategoriaIcon";
import { LinkFormDialog } from "./LinkFormDialog";
import { EmpreendimentoFormDialog } from "./EmpreendimentoFormDialog";
import { GerarLinkDialog } from "./GerarLinkDialog";
import { UploadMaterialDialog } from "./UploadMaterialDialog";
import { MaterialPreviewDialog } from "./MaterialPreviewDialog";
import { useMateriaisMutations } from "@/hooks/useMateriaisMutations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PREVIEWABLE = (link: MaterialLink) => {
  if (!link.storage_path) return false;
  const m = (link.mime_type || "").toLowerCase();
  if (m.startsWith("image/") || m.startsWith("video/") || m.startsWith("audio/") || m === "application/pdf") return true;
  const ext = link.storage_path.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return !!ext && ["png","jpg","jpeg","webp","gif","avif","mp4","webm","mov","m4v","pdf","mp3","wav","ogg","m4a"].includes(ext);
};

interface Props {
  empreendimento: MaterialEmpreendimento;
  canEdit: boolean;
}

export function MaterialCard({ empreendimento, canEdit }: Props) {
  const { deleteEmpreendimento, deleteLink } = useMateriaisMutations();
  const [editEmp, setEditEmp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; link: MaterialLink | null }>({
    open: false, link: null,
  });
  const [linkToDelete, setLinkToDelete] = useState<MaterialLink | null>(null);
  const [previewLink, setPreviewLink] = useState<MaterialLink | null>(null);

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
    if (PREVIEWABLE(link)) {
      setPreviewLink(link);
      return;
    }
    const url = await getSignedUrl(link, false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadLink = async (link: MaterialLink) => {
    if (!link.storage_path) {
      // link externo — apenas abre
      if (link.url) window.open(link.url, "_blank", "noopener,noreferrer");
      return;
    }
    const url = await getSignedUrl(link, true);
    if (!url) return;
    // Força navegação para disparar download com Content-Disposition
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    a.click();
  };

  const copyLink = async (link: MaterialLink) => {
    const url = await getSignedUrl(link, false);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: link.storage_path ? "Válido por 10 minutos." : undefined });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const shareWhatsapp = async (link: MaterialLink) => {
    const url = await getSignedUrl(link, false);
    if (!url) return;
    const text = `${link.titulo}\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const reprocessIngest = async (materialId: string) => {
    try {
      await supabase.functions.invoke("materiais-ingest", { body: { material_id: materialId } });
      toast({ title: "Reprocessando com IA..." });
    } catch (e: any) {
      toast({ title: "Erro ao reprocessar", description: e.message, variant: "destructive" });
    }
  };

  // Group links by categoria
  const grouped = empreendimento.links.reduce((acc, link) => {
    (acc[link.categoria] ??= []).push(link);
    return acc;
  }, {} as Record<string, MaterialLink[]>);

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {empreendimento.logo_url ? (
              <img
                src={empreendimento.logo_url}
                alt={empreendimento.nome}
                className="h-12 w-12 rounded-lg object-cover border border-border/60 flex-shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{empreendimento.nome}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {empreendimento.links.length} {empreendimento.links.length === 1 ? "material" : "materiais"}
              </p>
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditEmp(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
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
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum material cadastrado.
              {canEdit && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 block mx-auto"
                  onClick={() => setLinkDialog({ open: true, link: null })}
                >
                  + Adicionar primeiro link
                </Button>
              )}
            </div>
          ) : (
            Object.entries(grouped).map(([cat, links]) => {
              const info = getCategoriaInfo(cat);
              const Icon = info.icon;
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{info.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {links.map((link) => (
                      <li key={link.id} className="group flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openLink(link)}
                            className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/60 transition-colors min-w-0 text-left"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{link.titulo}</span>
                            {link.ingest_status === "processing" && (
                              <span className="text-[10px] text-muted-foreground" title="Processando IA">⏳</span>
                            )}
                            {link.ingest_status === "error" && canEdit && (
                              <span className="text-[10px] text-destructive" title={link.ingest_error ?? "Erro"}>⚠</span>
                            )}
                            {link.ingest_status === "done" && (link.tags?.length ?? 0) > 0 && (
                              <span className="text-[10px] text-primary" title="IA pronta">✨</span>
                            )}
                            {link.origem === "upload" && (
                              <span className="ml-auto text-[10px] text-muted-foreground uppercase">arquivo</span>
                            )}
                          </button>
                          <div className="flex items-center gap-0.5">
                            {/* Ações rápidas — visíveis para todos */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-60 group-hover:opacity-100 transition-opacity"
                              title="Copiar link"
                              onClick={() => copyLink(link)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {link.storage_path && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-60 group-hover:opacity-100 transition-opacity"
                                title="Baixar"
                                onClick={() => downloadLink(link)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 opacity-60 group-hover:opacity-100 transition-opacity"
                              title="Enviar no WhatsApp"
                              onClick={() => shareWhatsapp(link)}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                            {canEdit && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 border-l border-border/60 ml-1 pl-1">
                                {link.storage_path && (link.ingest_status === "error" || link.ingest_status === "done") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Reprocessar IA"
                                    onClick={() => reprocessIngest(link.id)}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setLinkDialog({ open: true, link })}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setLinkToDelete(link)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        {(link.tags?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 pl-6">
                            {link.tags!.slice(0, 4).map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          {Object.keys(grouped).length > 0 && (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setShareOpen(true)}
                disabled={empreendimento.links.length === 0}
              >
                <Share2 className="h-3.5 w-3.5 mr-1.5" /> Gerar link comercial
              </Button>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLinkDialog({ open: true, link: null })}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
      <GerarLinkDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        empreendimento={empreendimento}
      />
      <UploadMaterialDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        empreendimentoId={empreendimento.id}
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
            <AlertDialogTitle>Excluir link?</AlertDialogTitle>
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
    </>
  );
}
