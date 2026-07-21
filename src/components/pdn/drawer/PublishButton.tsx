import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Megaphone } from "lucide-react";
import { sha1Short, type PubField, FIELD_LABEL } from "./publish";

interface Props {
  field: PubField;
  texto: string;
  pipelineLeadId: string | null | undefined;
  publishedHash: string | null;
  busy: boolean;
  onPublish: () => void;
}

/**
 * Botão "Publicar no lead" com 3 estados visuais:
 *  - Publicar (novo texto)
 *  - Publicado ✓ (texto atual bate com o hash já publicado)
 *  - Republicar (hash publicado difere do texto atual — houve edição)
 */
export function PublishButton({ field, texto, pipelineLeadId, publishedHash, busy, onPublish }: Props) {
  const clean = texto.trim();
  const [localHash, setLocalHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!clean) { setLocalHash(null); return; }
    sha1Short(clean).then(h => { if (!cancelled) setLocalHash(h); });
    return () => { cancelled = true; };
  }, [clean]);

  if (!pipelineLeadId) return null;

  const isPublishedSame = publishedHash && localHash && publishedHash === localHash;
  const isPublishedDrift = publishedHash && localHash && publishedHash !== localHash;
  const disabled = !clean || busy;

  const label = busy
    ? "Publicando…"
    : isPublishedSame
      ? "Publicado no lead ✓"
      : isPublishedDrift
        ? "Republicar no lead"
        : "Publicar no lead";

  return (
    <Button
      type="button"
      variant={isPublishedSame ? "ghost" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onPublish}
      className={`h-8 gap-1.5 text-xs ${isPublishedSame ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      title={`Cria uma nota no histórico do lead com esta ${FIELD_LABEL[field].toLowerCase()}.`}
    >
      {isPublishedSame ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
