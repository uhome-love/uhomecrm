import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const BUCKET = "campanha-natal";
export interface Material {
  id: string; chave: string; secao: string; ordem: number; titulo: string;
  arquivo_path: string; mime: string | null; tamanho_bytes: number | null; ativo: boolean;
}

export function useMateriais(todos = false) {
  return useQuery({
    queryKey: ["natal-materiais", todos],
    staleTime: 60_000,
    queryFn: async (): Promise<Material[]> => {
      let q = supabase.from("natal_materiais").select("id, chave, secao, ordem, titulo, arquivo_path, mime, tamanho_bytes, ativo").order("secao").order("ordem");
      if (!todos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });
}

export function useInvalidarMateriais() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["natal-materiais"] });
}

/** URLs assinadas (1h) de uma lista de caminhos, em lote. */
export function useUrlsAssinadas(caminhos: string[]) {
  return useQuery({
    queryKey: ["natal-urls", caminhos],
    enabled: caminhos.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(caminhos, 3600);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      (data ?? []).forEach((d) => { if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl; });
      return mapa;
    },
  });
}

const ext = (p: string) => p.split(".").pop() || "jpg";

export async function baixarMaterial(m: Material) {
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(m.arquivo_path, 3600, { download: `Natal_Uhome_${m.chave}.${ext(m.arquivo_path)}` });
  if (error || !data) { toast.error("Não foi possível baixar o arquivo."); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function compartilharMaterial(m: Material) {
  try {
    const { data } = await supabase.storage.from(BUCKET).download(m.arquivo_path);
    if (data) {
      const arq = new File([data], `Natal_Uhome_${m.chave}.${ext(m.arquivo_path)}`, { type: data.type });
      if (navigator.canShare?.({ files: [arq] })) { await navigator.share({ files: [arq] }); return; }
    }
  } catch { /* cai no baixar */ }
  await baixarMaterial(m);
}

export async function copiarTexto(texto: string) {
  try { await navigator.clipboard.writeText(texto); }
  catch {
    const t = document.createElement("textarea");
    t.value = texto; document.body.appendChild(t); t.select();
    document.execCommand("copy"); t.remove();
  }
  toast.success("Copiado! Troque o que está entre [colchetes] 😉");
}

export const abrirWhatsApp = (texto: string) =>
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
