import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Download, Share2 } from "lucide-react";
import { partesColchetes } from "./arquivos";
import { abrirWhatsApp, baixarMaterial, compartilharMaterial, copiarTexto, type Material } from "./useMateriais";

export function TextoMarcado({ texto }: { texto: string }) {
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed">
      {partesColchetes(texto).map((p, i) =>
        p.marca ? <mark key={i} className="natal-colchete">{p.t}</mark> : <span key={i}>{p.t}</span>)}
    </p>
  );
}

export function BotoesTexto({ texto, rotuloWhats = "WhatsApp" }: { texto: string; rotuloWhats?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button size="sm" onClick={() => copiarTexto(texto)}><Copy className="mr-1 h-4 w-4" />Copiar</Button>
      <Button size="sm" variant="outline" className="natal-btn-whats" onClick={() => abrirWhatsApp(texto)}>{rotuloWhats}</Button>
    </div>
  );
}

export function Vazio() {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Os materiais desta seção ainda vão ser publicados.</p>;
}

export function CardArquivo({ m, url }: { m: Material; url?: string }) {
  const pdf = m.arquivo_path.toLowerCase().endsWith(".pdf");
  return (
    <div className="natal-card overflow-hidden">
      {pdf ? null : url
        ? <img src={url} alt={m.titulo} loading="lazy" className="aspect-square w-full bg-muted object-cover" />
        : <Skeleton className="aspect-square w-full" />}
      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-semibold">{m.titulo}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={() => baixarMaterial(m)}><Download className="mr-1 h-4 w-4" />Baixar</Button>
          <Button size="sm" variant="outline" onClick={() => compartilharMaterial(m)}><Share2 className="mr-1 h-4 w-4" />Compartilhar</Button>
        </div>
      </div>
    </div>
  );
}
