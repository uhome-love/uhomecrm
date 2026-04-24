import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function useMateriaisMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["materiais"] });

  const upsertEmpreendimento = useMutation({
    mutationFn: async (input: {
      id?: string;
      nome: string;
      empreendimento_ref?: string | null;
      logo_url?: string | null;
      ordem?: number;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from("materiais_empreendimentos" as any)
          .update({
            nome: input.nome,
            empreendimento_ref: input.empreendimento_ref ?? null,
            logo_url: input.logo_url ?? null,
            ordem: input.ordem ?? 0,
          } as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("materiais_empreendimentos" as any)
          .insert({
            nome: input.nome,
            empreendimento_ref: input.empreendimento_ref ?? null,
            logo_url: input.logo_url ?? null,
            ordem: input.ordem ?? 0,
            created_by: user?.id ?? null,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Empreendimento salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const deleteEmpreendimento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("materiais_empreendimentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Empreendimento removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const upsertLink = useMutation({
    mutationFn: async (input: {
      id?: string;
      empreendimento_id: string;
      categoria: string;
      titulo: string;
      url: string;
      descricao?: string | null;
      ordem?: number;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from("materiais_links" as any)
          .update({
            categoria: input.categoria,
            titulo: input.titulo,
            url: input.url,
            descricao: input.descricao ?? null,
            ordem: input.ordem ?? 0,
          } as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("materiais_links" as any)
          .insert({
            empreendimento_id: input.empreendimento_id,
            categoria: input.categoria,
            titulo: input.titulo,
            url: input.url,
            descricao: input.descricao ?? null,
            ordem: input.ordem ?? 0,
            created_by: user?.id ?? null,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Link salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar link", description: e.message, variant: "destructive" }),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("materiais_links" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Link removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover link", description: e.message, variant: "destructive" }),
  });

  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("materiais-logos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("materiais-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  return { upsertEmpreendimento, deleteEmpreendimento, upsertLink, deleteLink, uploadLogo };
}
