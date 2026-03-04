import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TeamMember {
  id: string;
  nome: string;
  equipe: string | null;
  status: string;
}

export default function TeamManagement() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEquipe, setNewEquipe] = useState("");

  const loadTeam = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("gerente_id", user.id)
      .order("nome");
    if (!error && data) setMembers(data as TeamMember[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const addMember = async () => {
    if (!user || !newName.trim()) { toast.error("Informe o nome."); return; }
    const { error } = await supabase.from("team_members").insert({
      gerente_id: user.id,
      nome: newName.trim(),
      equipe: newEquipe.trim() || null,
    });
    if (error) { toast.error("Erro ao adicionar."); return; }
    setNewName("");
    setNewEquipe("");
    loadTeam();
    toast.success("Corretor adicionado!");
  };

  const toggleStatus = async (m: TeamMember) => {
    const next = m.status === "ativo" ? "inativo" : "ativo";
    await supabase.from("team_members").update({ status: next }).eq("id", m.id);
    loadTeam();
    toast.success(`${m.nome} agora está ${next}.`);
  };

  const removeMember = async (m: TeamMember) => {
    if (!confirm(`Remover ${m.nome} do time?`)) return;
    await supabase.from("team_members").delete().eq("id", m.id);
    loadTeam();
    toast.success("Corretor removido.");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" /> Adicionar Corretor
        </h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do corretor" />
          </div>
          <div className="w-40">
            <label className="text-xs text-muted-foreground mb-1 block">Equipe (opcional)</label>
            <Input value={newEquipe} onChange={(e) => setNewEquipe(e.target.value)} placeholder="Ex: Equipe A" />
          </div>
          <Button onClick={addMember} className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-display font-semibold text-foreground">Meu Time ({members.filter(m => m.status === "ativo").length} ativos)</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum corretor cadastrado. Adicione acima.</div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence>
              {members.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${m.status === "ativo" ? "bg-success" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{m.nome}</p>
                    {m.equipe && <p className="text-xs text-muted-foreground">{m.equipe}</p>}
                  </div>
                  <Button size="sm" variant={m.status === "ativo" ? "outline" : "default"} onClick={() => toggleStatus(m)} className="text-xs">
                    {m.status === "ativo" ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
