/**
 * Share dropdown for property cards — Copy link, WhatsApp, Copy data.
 * Uses PUBLIC_DOMAIN for canonical share URLs.
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

interface SharePropertyButtonProps {
  codigo: string;
  titulo: string;
  bairro: string;
  preco: string;
  tipo?: string;
  quartos?: number | null;
  className?: string;
}

export default function SharePropertyButton({ codigo, titulo, bairro, preco, tipo, quartos, className }: SharePropertyButtonProps) {
  if (!codigo) return null;

  // Generate uhome.com.br-compatible slug URL
  const slugType = (tipo || "imovel").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const slugBairro = (bairro || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const shareSlug = quartos && quartos > 0
    ? `${slugType}-${quartos}-quarto${quartos > 1 ? "s" : ""}-${slugBairro}-${codigo}`
    : `${slugType}-para-venda-${slugBairro}-${codigo}`;
  const shareUrl = `https://uhome.com.br/imovel/${shareSlug}`;

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
