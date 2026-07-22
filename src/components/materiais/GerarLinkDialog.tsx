import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Share2, Loader2, ExternalLink, Sparkles, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCategoriaInfo } from "./CategoriaIcon";
import type { MaterialEmpreendimento, MaterialLink } from "@/hooks/useMateriais";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empreendimento: MaterialEmpreendimento;
  leadId?: string | null;
  leadNome?: string | null;
}

type Tom = "amigavel" | "consultivo" | "urgencia";
interface MensagemIA { titulo: string; texto: string; }

const SITE_BASE_URL = "https://uhomesales.com";

// Map categoria → asset kind (foto/video/planta/pdf/link)
function categoriaToKind(cat: string): "foto" | "video" | "planta" | "pdf" | "link" {
  const c = cat.toLowerCase();
  if (c.includes("foto") || c.includes("imagem") || c.includes("galeria")) return "foto";
  if (c.includes("video") || c.includes("vídeo") || c.includes("tour")) return "video";
  if (c.includes("planta")) return "planta";
  if (c.includes("pdf") || c.includes("apresenta") || c.includes("book")) return "pdf";
  return "link";
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function GerarLinkDialog({ open, onOpenChange, empreendimento, leadId, leadNome }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaTom, setIaTom] = useState<Tom>("amigavel");
  const [iaMensagens, setIaMensagens] = useState<MensagemIA[] | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const grouped = useMemo(() => {
    return empreendimento.links.reduce((acc, l) => {
      (acc[l.categoria] ??= []).push(l);
      return acc;
    }, {} as Record<string, MaterialLink[]>);
  }, [empreendimento.links]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(empreendimento.links.map((l) => l.id)));
  };
  const clearAll = () => setSelected(new Set());

  const handleReset = () => {
    setSelected(new Set());
    setTitulo("");
    setMensagem("");
    setGeneratedUrl(null);
    setCopied(false);
    setIaMensagens(null);
    setIaTom("amigavel");
  };

  const handleClose = (v: boolean) => {
    if (!v) handleReset();
    onOpenChange(v);
  };

  const handleGenerate = async () => {
    if (selected.size === 0) {
      toast.error("Selecione ao menos 1 material.");
      return;
    }

    const selectedLinks = empreendimento.links.filter((l) => selected.has(l.id));
    const assets = selectedLinks.map((l) => ({
      kind: categoriaToKind(l.categoria),
      id: l.id,
      titulo: l.titulo,
      url: l.url,
      descricao: l.descricao,
    }));

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("materiais-share-create", {
        body: {
          empreendimento_slug: empreendimento.empreendimento_ref || slugify(empreendimento.nome),
          empreendimento_nome: empreendimento.nome,
          titulo: titulo.trim() || null,
          mensagem: mensagem.trim() || null,
          assets,
        },
      });
      if (error) throw error;
      if (!data?.id) throw new Error("resposta inválida");

      const url = `${SITE_BASE_URL}/materiais/${data.id}`;
      setGeneratedUrl(url);
      toast.success("Link comercial gerado!");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao gerar link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 1800);
  };

  const handleWhatsapp = (customText?: string) => {
    if (!generatedUrl) return;
    const text = customText
      ? `${customText}\n\n${generatedUrl}`
      : `${titulo || `Materiais de ${empreendimento.nome}`}\n\n${generatedUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleGerarIA = async () => {
    if (!generatedUrl) return;
    const selectedLinks = empreendimento.links.filter((l) => selected.has(l.id));
    setIaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("homi-follow-up-message", {
        body: {
          lead_id: leadId ?? null,
          lead_nome: leadNome ?? null,
          empreendimento_nome: empreendimento.nome,
          share_url: generatedUrl,
          tom: iaTom,
          materiais: selectedLinks.map((l) => ({
            titulo: l.titulo,
            kind: categoriaToKind(l.categoria),
          })),
        },
      });
      if (error) throw error;
      const msgs = (data as any)?.mensagens as MensagemIA[] | undefined;
      if (!msgs || msgs.length === 0) throw new Error("IA não retornou variações");
      setIaMensagens(msgs);
      toast.success("Mensagens geradas!");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar mensagem com IA");
    } finally {
      setIaLoading(false);
    }
  };

  const handleCopyIA = async (texto: string, idx: number) => {
    await navigator.clipboard.writeText(`${texto}\n\n${generatedUrl}`);
    setCopiedIdx(idx);
    toast.success("Mensagem copiada");
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Gerar link comercial · {empreendimento.nome}
          </DialogTitle>
          <DialogDescription>
            Selecione os materiais que o cliente vai receber numa landing personalizada.
          </DialogDescription>
        </DialogHeader>

        {generatedUrl ? (
          <div className="flex-1 flex flex-col gap-4 py-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Link pronto para compartilhar
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={generatedUrl} className="font-mono text-sm" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selected.size} {selected.size === 1 ? "material" : "materiais"} incluídos ·
                Views e cliques serão rastreados automaticamente.
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => handleWhatsapp()}>
                Enviar no WhatsApp
              </Button>
              <Button variant="outline" onClick={() => window.open(generatedUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir
              </Button>
            </div>

            {/* ✨ Follow-up personalizado com IA */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Mensagem personalizada com IA</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { v: "amigavel", label: "Amigável" },
                  { v: "consultivo", label: "Consultivo" },
                  { v: "urgencia", label: "Com urgência" },
                ] as { v: Tom; label: string }[]).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setIaTom(v)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      iaTom === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-auto h-7"
                  onClick={handleGerarIA}
                  disabled={iaLoading}
                >
                  {iaLoading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {iaMensagens ? "Gerar novamente" : "Gerar com IA"}
                </Button>
              </div>

              {iaMensagens && (
                <div className="space-y-2 pt-1">
                  {iaMensagens.map((m, i) => (
                    <div key={i} className="rounded-md border bg-muted/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {m.titulo}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleCopyIA(m.texto, i)}
                          >
                            {copiedIdx === i ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleWhatsapp(m.texto)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button variant="ghost" onClick={handleReset} className="w-full">
              Gerar outro link
            </Button>
          </div>

        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              <div className="grid gap-2">
                <Label htmlFor="titulo">Título (opcional)</Label>
                <Input
                  id="titulo"
                  placeholder={`Materiais de ${empreendimento.nome}`}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="msg">Mensagem para o cliente (opcional)</Label>
                <Textarea
                  id="msg"
                  placeholder="Oi! Separei este conteúdo pra você conhecer o empreendimento..."
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    Materiais {selected.size > 0 && (
                      <Badge variant="secondary" className="ml-1">{selected.size} selecionados</Badge>
                    )}
                  </div>
                  <div className="flex gap-1 text-xs">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="h-7">
                      Todos
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-7">
                      Nenhum
                    </Button>
                  </div>
                </div>

                {empreendimento.links.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum material cadastrado neste empreendimento.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(grouped).map(([cat, links]) => {
                      const info = getCategoriaInfo(cat);
                      const Icon = info.icon;
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            <Icon className="h-3.5 w-3.5" />
                            <span>{info.label}</span>
                          </div>
                          <ul className="space-y-1">
                            {links.map((link) => (
                              <li
                                key={link.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer"
                                onClick={() => toggle(link.id)}
                              >
                                <Checkbox
                                  checked={selected.has(link.id)}
                                  onCheckedChange={() => toggle(link.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm truncate flex-1">{link.titulo}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={loading || selected.size === 0}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
                Gerar link
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
