import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mídia da Academia (vídeos e PDFs) fica em buckets PRIVADOS
 * (`academia-videos`, `academia-pdfs`). O acesso é feito por signed URL,
 * gerada no momento da reprodução.
 *
 * Formato novo em `academia_aulas.conteudo`:
 *   { storage_bucket: "academia-videos", storage_key: "1234-abc.mp4" }
 *
 * Formato legado (URL pública salva direto): { storage_path: "https://..." }
 */
export interface MediaRef {
  bucket?: string | null;
  key?: string | null;
  legacyUrl?: string | null;
}

export function readMediaRef(conteudo: any, conteudoUrl?: string | null): MediaRef {
  const bucket = conteudo?.storage_bucket || null;
  const key = conteudo?.storage_key || null;
  const legacy = conteudo?.storage_path || conteudoUrl || null;
  return { bucket, key, legacyUrl: typeof legacy === "string" ? legacy : null };
}

export async function signMedia(ref: MediaRef, expiresIn = 60 * 60 * 4): Promise<string | null> {
  if (ref.bucket && ref.key) {
    const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.key, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  }
  if (!ref.legacyUrl) return null;
  // URL legada: se for URL pública de bucket privado, tenta reassinar pelo caminho
  const m = ref.legacyUrl.match(/\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (m) {
    const { data } = await supabase.storage.from(m[1]).createSignedUrl(decodeURIComponent(m[2]), expiresIn);
    if (data?.signedUrl) return data.signedUrl;
  }
  return ref.legacyUrl;
}

/** Hook: resolve a URL tocável de uma aula de vídeo/PDF. */
export function useSignedMedia(conteudo: any, conteudoUrl?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = readMediaRef(conteudo, conteudoUrl);
  const dep = `${ref.bucket}|${ref.key}|${ref.legacyUrl}`;

  useEffect(() => {
    let alive = true;
    if (!ref.bucket && !ref.key && !ref.legacyUrl) {
      setUrl(null);
      return;
    }
    signMedia(ref).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  return url;
}

/** Lê a duração (em minutos, arredondada para cima) de um arquivo de vídeo local. */
export function readVideoDurationMinutes(file: File): Promise<number> {
  return new Promise(resolve => {
    try {
      const el = document.createElement("video");
      el.preload = "metadata";
      const src = URL.createObjectURL(file);
      const done = (min: number) => { URL.revokeObjectURL(src); resolve(min); };
      el.onloadedmetadata = () => done(Math.max(1, Math.ceil((el.duration || 0) / 60)));
      el.onerror = () => done(10);
      el.src = src;
    } catch {
      resolve(10);
    }
  });
}

/** Título legível a partir do nome do arquivo. */
export function fileNameToTitle(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}
