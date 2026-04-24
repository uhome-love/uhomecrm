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
import { Building2, ExternalLink, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { MaterialEmpreendimento, MaterialLink } from "@/hooks/useMateriais";
import { getCategoriaInfo } from "./CategoriaIcon";
import { LinkFormDialog } from "./LinkFormDialog";
import { EmpreendimentoFormDialog } from "./EmpreendimentoFormDialog";
import { useMateriaisMutations } from "@/hooks/useMateriaisMutations";

interface Props {
  empreendimento: MaterialEmpreendimento;
  canEdit: boolean;
}

export function MaterialCard({ empreendimento, canEdit }: Props) {
  const { deleteEmpreendimento, deleteLink } = useMateriaisMutations();
  const [editEmp, setEditEmp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; link: MaterialLink | null }>({
    open: false, link: null,
  });
  const [linkToDelete, setLinkToDelete] = useState<MaterialLink | null>(null);

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
                      <li key={link.id} className="group flex items-center gap-2">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/60 transition-colors min-w-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{link.titulo}</span>
                        </a>
                        {canEdit && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
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
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          {canEdit && Object.keys(grouped).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setLinkDialog({ open: true, link: null })}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar link
            </Button>
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
