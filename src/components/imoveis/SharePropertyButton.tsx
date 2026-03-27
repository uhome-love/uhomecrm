/**
 * Share dropdown for property cards — Copy link, WhatsApp, Copy data.
 * Uses the broker's personalized URL when slug_ref is available.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Link2, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { gerarSlugUhome } from "@/services/siteImoveis";
import { useBrokerSlug } from "@/hooks/useBrokerSlug";

interface SharePropertyButtonProps {
  codigo: string;
  titulo: string;
  bairro: string;
  preco: string;
  tipo?: string;
  quartos?: number | null;
  slug?: string | null;
  className?: string;
}

export default function SharePropertyButton({ codigo, titulo, bairro, preco, tipo, quartos, slug: dbSlug, className }: SharePropertyButtonProps) {
  const slugRef = useBrokerSlug();

  if (!codigo) return null;

  const slug = gerarSlugUhome({ tipo: tipo || "imovel", quartos: quartos ?? null, bairro, codigo, slug: dbSlug });
  const shareUrl = slugRef
    ? `https://uhome.com.br/c/${slugRef}/imovel/${slug}`
    : `https://uhome.com.br/imovel/${slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado!");
  };

  const copyData = () => {
    const text = [titulo, bairro, preco, `Cód. ${codigo}`, shareUrl].filter(Boolean).join(" · ");
    navigator.clipboard.writeText(text);
    toast.success("Dados copiados!");
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    [titulo, bairro, preco, shareUrl].filter(Boolean).join(" - ")
  )}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className || "h-6 w-6 text-muted-foreground hover:text-primary"} title="Compartilhar">
          <Share2 className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={copyLink} className="gap-2 text-xs cursor-pointer">
          <Link2 className="h-3.5 w-3.5" /> Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2 text-xs cursor-pointer">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyData} className="gap-2 text-xs cursor-pointer">
          <Copy className="h-3.5 w-3.5" /> Copiar dados
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
