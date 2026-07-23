import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Download, Loader2 } from "lucide-react";
import type { MaterialComEmp } from "@/hooks/useMateriaisFavoritos";
import { registrarMaterialRecente } from "@/hooks/useMateriaisFavoritos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCategoriaInfo } from "./CategoriaIcon";
import { MaterialPreviewDialog } from "./MaterialPreviewDialog";
import { useState } from "react";

const PREVIEWABLE = (link: MaterialComEmp) => {
  if (!link.storage_path) return false;
  const m = (link.mime_type || "").toLowerCase();
  if (m.startsWith("image/") || m.startsWith("video/") || m.startsWith("audio/") || m === "application/pdf") return true;
  const ext = link.storage_path.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return !!ext && ["png","jpg","jpeg","webp","gif","avif","mp4","webm","mov","m4v","pdf","mp3","wav","ogg","m4a"].includes(ext);
};

interface Props {
  items: MaterialComEmp[];
  loading?: boolean;
  emptyLabel: string;
}

export function MaterialListaCompact({ items, loading, emptyLabel }: Props) {
  const [previewLink, setPreviewLink] = useState<MaterialComEmp | null>(null);

  const getSignedUrl = async (link: MaterialComEmp, download = false): Promise<string | null> => {
    if (!link.storage_path) return link.url || null;
    try {
      const { data, error } = await supabase.functions.invoke("materiais-signed-read", {
        body: { storage_path: link.storage_path, material_id: link.id, download, filename: link.titulo },
      });
      if (error) throw error;
      const url = (data as any)?.url || (data as any)?.signed_url;
      return url || null;
    } catch (e: any) {
      toast({ title: "Erro ao obter link", description: e.message, variant: "destructive" });
      return null;
    }
  };

  const openLink = async (link: MaterialComEmp) => {
    registrarMaterialRecente(link.id, PREVIEWABLE(link) ? "preview" : "abrir");
    if (PREVIEWABLE(link)) { setPreviewLink(link); return; }
    const url = await getSignedUrl(link, false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const copyLink = async (link: MaterialComEmp) => {
    const url = await getSignedUrl(link, false);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    registrarMaterialRecente(link.id, "copiar");
    toast({ title: "Link copiado" });
  };
  const downloadLink = async (link: MaterialComEmp) => {
    registrarMaterialRecente(link.id, "download");
    if (!link.storage_path) { if (link.url) window.open(link.url, "_blank", "noopener,noreferrer"); return; }
    const url = await getSignedUrl(link, true);
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.rel = "noopener noreferrer"; a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border/60 rounded-xl py-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((m) => {
          const info = getCategoriaInfo(m.categoria);
          const Icon = info.icon;
          return (
            <div key={m.id} className="group flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors">
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <button
                type="button"
                onClick={() => openLink(m)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm font-medium text-foreground truncate">{m.titulo}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {m.materiais_empreendimentos?.nome ?? "—"} • {info.label}
                </p>
              </button>
              <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar" onClick={() => copyLink(m)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                {m.storage_path && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar" onClick={() => downloadLink(m)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir" onClick={() => openLink(m)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <MaterialPreviewDialog
        open={!!previewLink}
        onOpenChange={(o) => !o && setPreviewLink(null)}
        link={previewLink as any}
      />
    </>
  );
}
