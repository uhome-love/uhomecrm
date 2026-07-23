import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";
import { Loader2, Sparkles, Play, Square, Wand2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AdminSessaoPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [popPending, setPopPending] = useState<string | null>(null);

  const { data: sessoes, isLoading } = useQuery({
    queryKey: ["mutirao", "sessoes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oferta_ativa_sessoes")
        .select("*").order("data", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const createM = useMutation({
    mutationFn: async () => {
      if (!inicio || !fim) throw new Error("Preencha início e fim");
      const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", user!.id).maybeSingle();
      const inicioIso = new Date(inicio).toISOString();
      const fimIso = new Date(fim).toISOString();
      const dataBrt = new Date(inicio).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { error } = await supabase.from("oferta_ativa_sessoes").insert({
        data: dataBrt, inicio_at: inicioIso, fim_at: fimIso,
        status: "agendada", created_by: prof?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sessão criada"); qc.invalidateQueries({ queryKey: ["mutirao"] }); setInicio(""); setFim(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("oferta_ativa_sessoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mutirao"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  async function popularFila(id: string) {
    setPopPending(id);
    try {
      const { data, error } = await supabase.functions.invoke("oferta-ativa-popular-fila", { body: { sessao_id: id } });
      if (error) throw error;
      const d = data as any;
      toast.success(`Fila populada: ${d.inserted} inseridos · ${d.skipped_red ?? 0} vermelhos · ${d.skipped_dup ?? 0} dup · ${d.skipped_cooldown ?? 0} cooldown`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setPopPending(null); }
  }

  return (
    <div className="rounded-2xl border border-border p-4 bg-card space-y-4 mt-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Wand2 className="w-5 h-5 text-primary" /> Admin — Sessões do Mutirão
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <div>
          <Label>Início (BRT)</Label>
          <Input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <Label>Fim (BRT)</Label>
          <Input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
          {createM.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Criar sessão
        </Button>
      </div>

      <div className="border-t pt-3">
        <p className="text-sm font-semibold mb-2">Últimas sessões</p>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <div className="space-y-1">
            {(sessoes ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{formatBRT(s.inicio_at, "dd/MM HH:mm")} → {formatBRT(s.fim_at, "HH:mm")}</p>
                  <p className="text-[11px] text-muted-foreground">status: <span className="font-mono">{s.status}</span></p>
                </div>
                <Button size="sm" variant="outline" disabled={popPending === s.id} onClick={() => popularFila(s.id)}>
                  {popPending === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Popular fila"}
                </Button>
                {s.status !== "ao_vivo" ? (
                  <Button size="sm" onClick={() => toggleStatus.mutate({ id: s.id, status: "ao_vivo" })}>
                    <Play className="w-3.5 h-3.5 mr-1" /> Iniciar
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => toggleStatus.mutate({ id: s.id, status: "encerrada" })}>
                    <Square className="w-3.5 h-3.5 mr-1" /> Encerrar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
