import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, MessageSquare, Send } from "lucide-react";

const fmt = (n: string) => {
  const d = n.replace(/\D/g, "");
  return d.length >= 12 ? `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, -4)}-${d.slice(-4)}` : n;
};

/** Trava "Modo teste": com ela ligada, toda mensagem da Lia só sai para o número de teste. */
export default function LiaModoTesteCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lia-hub", "modo-teste"],
    queryFn: async () => {
      const [{ data, error }, { data: flag }] = await Promise.all([
        supabase.from("ia_config").select("modo_teste, numero_teste").limit(1).maybeSingle(),
        supabase.from("system_flags").select("flag_value").eq("flag_name", "lia_reengajamento_enabled").maybeSingle(),
      ]);
      if (error || !data) throw new Error("Sem acesso à trava.");
      return { modo_teste: !!data.modo_teste, numero_teste: data.numero_teste ?? "", recuperacao: flag?.flag_value ?? null };
    },
  });
  const [numero, setNumero] = useState("");
  useEffect(() => { if (q.data) setNumero(fmt(q.data.numero_teste)); }, [q.data]);

  const salvar = useMutation({
    mutationFn: async (ligado: boolean) => {
      const { error } = await supabase.rpc("lia_salvar_modo_teste", { p_ligado: ligado, p_numero: numero });
      if (error) throw new Error(error.message.includes("numero_invalido") ? "Número inválido." : "Não foi possível salvar.");
    },
    onSuccess: (_d, ligado) => { toast.success(ligado ? "Modo teste ligado: só o seu número recebe." : "Modo teste desligado."); void qc.invalidateQueries({ queryKey: ["lia-hub", "modo-teste"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const enviar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("lia-modo-teste", { body: {} });
      if (error) throw new Error((data as { motivo?: string } | null)?.motivo ?? "Não foi possível enviar o teste.");
      if (!data?.ok) throw new Error(data?.motivo ?? "Não foi possível enviar o teste.");
      return data as { final: string };
    },
    onSuccess: (d) => toast.success(`Conversa de teste reiniciada e mensagem enviada para o final ${d.final}. Confira no WhatsApp.`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p role="status" className="text-sm text-muted-foreground">Carregando trava de teste…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">Trava de teste visível só para CEO.</p>;
  const d = q.data;
  const numeroMudou = numero.replace(/\D/g, "") !== d.numero_teste.replace(/\D/g, "");

  return (
    <div className="space-y-3">
      <section className={`rounded-xl border p-4 ${d.modo_teste ? "border-warning bg-warning/10" : "border-border"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold"><Lock className="h-4 w-4" />Modo teste: só o número abaixo</p>
            <p className="mt-1 text-xs text-muted-foreground">Com a trava ligada, a Lia só envia e só responde a este número. Todos os outros ficam bloqueados.</p>
          </div>
          <Switch aria-label="Modo teste" checked={d.modo_teste} disabled={salvar.isPending} onCheckedChange={(v) => salvar.mutate(v)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input aria-label="Número de teste" className="w-full sm:w-60" inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value)} />
          {numeroMudou && <Button size="sm" variant="outline" disabled={salvar.isPending} onClick={() => salvar.mutate(d.modo_teste)}>Salvar número</Button>}
          <Badge variant="outline">{d.modo_teste ? "Trava ligada" : "Trava desligada"}</Badge>
        </div>
      </section>
      <section className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
        <div><p className="font-semibold">Envio da recuperação</p><p className="mt-1 text-xs text-muted-foreground">Interruptor geral da recuperação. Só muda com decisão sua.</p></div>
        <Badge variant="secondary">{d.recuperacao === null ? "Não confirmado" : d.recuperacao ? "Ligado" : "Desligado"}</Badge>
      </section>
      <section className="rounded-xl border border-border p-4">
        <p className="font-semibold">Teste da recuperação</p>
        <p className="mt-1 text-xs text-muted-foreground">Manda a 1ª mensagem (dia 1, com 3 botões) para o número de teste.</p>
        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground"><li>Só funciona com a trava ligada</li><li>Responda como cliente; a conversa aparece em Conversas</li><li>Nada vai para a Fila CEO nem para corretores</li></ul>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button disabled={!d.modo_teste || enviar.isPending || numeroMudou} onClick={() => enviar.mutate()}>{enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar teste para meu número</Button>
          <Button variant="outline" onClick={() => { const u = new URL(window.location.href); u.searchParams.set("area", "conversas"); u.searchParams.delete("aba"); window.history.pushState({}, "", u); window.dispatchEvent(new PopStateEvent("popstate")); }}><MessageSquare className="h-4 w-4" />Ver conversa</Button>
        </div>
      </section>
    </div>
  );
}
