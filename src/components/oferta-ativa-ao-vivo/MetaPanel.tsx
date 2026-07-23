import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Target, Loader2 } from "lucide-react";

export function MetaPanel({ sessaoId }: { sessaoId: string | null }) {
  const { user } = useAuth();
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ml, setMl] = useState("");
  const [ma, setMa] = useState("");
  const [mv, setMv] = useState("");

  useEffect(() => {
    if (!sessaoId || !user) return;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!prof) { setLoading(false); return; }
      const { data } = await supabase.from("oferta_ativa_participantes")
        .select("*").eq("sessao_id", sessaoId).eq("corretor_id", prof.id).maybeSingle();
      setRow(data);
      setMl(String(data?.meta_ligacoes ?? ""));
      setMa(String(data?.meta_aproveitamentos ?? ""));
      setMv(String(data?.meta_visitas ?? ""));
      setLoading(false);
    })();
  }, [sessaoId, user]);

  async function salvar() {
    if (!sessaoId || !user) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!prof) return;
    const payload = {
      sessao_id: sessaoId, corretor_id: prof.id,
      meta_ligacoes: Number(ml) || 0,
      meta_aproveitamentos: Number(ma) || 0,
      meta_visitas: Number(mv) || 0,
    };
    const { error } = await supabase.from("oferta_ativa_participantes")
      .upsert(payload as any, { onConflict: "sessao_id,corretor_id" });
    if (error) return toast.error(error.message);
    toast.success("Meta salva");
    // reload
    const { data } = await supabase.from("oferta_ativa_participantes")
      .select("*").eq("sessao_id", sessaoId).eq("corretor_id", prof.id).maybeSingle();
    setRow(data);
  }

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-4 h-4 animate-spin" /></div>;

  const barra = (label: string, cur: number, meta: number) => {
    const pct = meta > 0 ? Math.min(100, Math.round((cur / meta) * 100)) : 0;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span>{label}</span><span className="tabular-nums">{cur}/{meta || "—"}</span>
        </div>
        <Progress value={pct} />
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><Target className="w-4 h-4 text-primary" /> Sua meta na sessão</div>
      <div className="space-y-2">
        {barra("Ligações", row?.ligacoes_count ?? 0, row?.meta_ligacoes ?? 0)}
        {barra("Aproveitamentos", row?.aproveitamentos_count ?? 0, row?.meta_aproveitamentos ?? 0)}
        {barra("Visitas", row?.visitas_count ?? 0, row?.meta_visitas ?? 0)}
      </div>
      <div className="border-t pt-2 space-y-2">
        <p className="text-xs text-muted-foreground">Editar meta</p>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Ligações" value={ml} onChange={(e) => setMl(e.target.value)} type="number" />
          <Input placeholder="Aproveit." value={ma} onChange={(e) => setMa(e.target.value)} type="number" />
          <Input placeholder="Visitas" value={mv} onChange={(e) => setMv(e.target.value)} type="number" />
        </div>
        <Button size="sm" onClick={salvar} className="w-full">Salvar meta</Button>
      </div>
    </div>
  );
}
