import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  leadNome: string;
  onDone?: () => void;
}

interface Corretor {
  user_id: string;
  nome: string;
  equipe: string | null;
  gestao?: string | null;
}

const CARGOS_GESTAO = ["gerente", "diretor", "diretora"];

function labelCargo(cargo: string | null | undefined) {
  if (!cargo) return "Gestão";
  const c = cargo.toLowerCase();
  if (c.startsWith("diretor")) return c === "diretora" ? "Diretora" : "Diretor";
  return "Gerente";
}

export default function FilaCeoRepassarDialog({ open, onOpenChange, leadId, leadNome, onDone }: Props) {
  const { user } = useAuth();
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [gestao, setGestao] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected("");
      setSearch("");
      return;
    }
    setLoading(true);
    (async () => {
      const [tmRes, profRes] = await Promise.all([
        supabase.from("team_members").select("user_id, nome, equipe").eq("status", "ativo").order("nome"),
        supabase.from("profiles").select("user_id, nome, cargo").eq("ativo", true).in("cargo", CARGOS_GESTAO).order("nome"),
      ]);

      const gestaoList: Corretor[] = ((profRes.data || []) as any[])
        .filter((p) => p.user_id)
        .map((p) => ({ user_id: p.user_id, nome: p.nome || "Gestor", equipe: null, gestao: labelCargo(p.cargo) }));
      const gestaoIds = new Set(gestaoList.map((g) => g.user_id));

      const corretoresList = ((tmRes.data || []) as any[])
        .filter((c) => c.user_id && !gestaoIds.has(c.user_id))
        .map((c) => ({ user_id: c.user_id, nome: c.nome, equipe: c.equipe }));

      setGestao(gestaoList);
      setCorretores(corretoresList);
      setLoading(false);
    })();
  }, [open]);

  const match = (c: Corretor, q: string) =>
    !q || c.nome?.toLowerCase().includes(q) || c.equipe?.toLowerCase().includes(q);

  const q = search.trim().toLowerCase();
  const filteredGestao = useMemo(() => gestao.filter((c) => match(c, q)), [gestao, q]);
  const filtered = useMemo(() => corretores.filter((c) => match(c, q)), [corretores, q]);
  const todos = useMemo(() => [...gestao, ...corretores], [gestao, corretores]);


  const handleConfirm = async () => {
    if (!leadId || !selected || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pipeline_leads")
        .update({
          corretor_id: selected,
          aceite_status: "aceito",
          aceito_em: new Date().toISOString(),
          motivo_pendencia: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (error) throw error;

      const corretorNome = todos.find((c) => c.user_id === selected)?.nome || "corretor";

      // Notifica o corretor que recebeu o lead (repasse manual = já é dele, sem aceite).
      try {
        await supabase.rpc("criar_notificacao", {
          p_user_id: selected,
          p_tipo: "lead",
          p_categoria: "lead_novo",
          p_titulo: `🔥 Novo lead qualificado — ${leadNome}`,
          p_mensagem: `Você recebeu o lead ${leadNome}. Fale agora!`,
          p_dados: { pipeline_lead_id: leadId, url: "/pipeline-leads" },
          p_agrupamento_key: `lead_novo:${leadId}`,
        });
      } catch (notifErr) {
        console.error("[FilaCeoRepassarDialog] notificação falhou (não crítico):", notifErr);
      }

      await supabase.from("audit_log").insert({
        user_id: user.id,
        modulo: "roleta",
        acao: "fila_ceo_repasse_manual",
        descricao: `Repassou lead "${leadNome}" para ${corretorNome}`,
        depois: { lead_id: leadId, corretor_id: selected },
      });

      toast.success(`Lead repassado para ${corretorNome}`);
      onDone?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[FilaCeoRepassarDialog]", err);
      toast.error("Erro ao repassar lead: " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" />
            Repassar lead manualmente
          </DialogTitle>
          <DialogDescription>
            Escolha quem vai receber <strong>{leadNome || "este lead"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-8"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 border border-border rounded-md p-1">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 && filteredGestao.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Ninguém encontrado.</p>
            ) : (
              <>
                {filteredGestao.length > 0 && (
                  <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Gestão
                  </p>
                )}
                {filteredGestao.map((c) => (
                  <button
                    key={c.user_id}
                    onClick={() => setSelected(c.user_id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors ${
                      selected === c.user_id
                        ? "bg-primary/10 border border-primary/40 text-primary font-medium"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <span className="truncate">{c.nome}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{c.gestao}</span>
                  </button>
                ))}

                {filtered.length > 0 && (
                  <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Corretores
                  </p>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.user_id}
                    onClick={() => setSelected(c.user_id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors ${
                      selected === c.user_id
                        ? "bg-primary/10 border border-primary/40 text-primary font-medium"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <span className="truncate">{c.nome}</span>
                    {c.equipe && <span className="text-[10px] text-muted-foreground shrink-0">{c.equipe}</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Repassar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
