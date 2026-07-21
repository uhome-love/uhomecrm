import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { UsuarioRow } from "./UsuarioDrawer";

interface Props {
  mode: "inactivate" | "delete";
  user: UsuarioRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

interface Option { user_id: string; nome: string }

export default function InativarOuExcluirDialog({ mode, user, open, onOpenChange, onDone }: Props) {
  const [reassignTo, setReassignTo] = useState<string>("");
  const [absorbTeamTo, setAbsorbTeamTo] = useState<string>("");
  const [corretores, setCorretores] = useState<Option[]>([]);
  const [gerentes, setGerentes] = useState<Option[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isDelete = mode === "delete";
  const title = isDelete ? "Excluir usuário definitivamente" : "Inativar usuário";
  const cta = isDelete ? "Excluir definitivamente" : "Inativar";

  useEffect(() => {
    if (!open || !user) return;
    setReassignTo(""); setAbsorbTeamTo("");
    (async () => {
      setLoading(true);
      // How many members under this user (if gerente)
      const { count } = await supabase
        .from("team_members").select("id", { count: "exact", head: true })
        .eq("gerente_id", user.user_id);
      setTeamCount(count || 0);

      // Corretores ativos (para reassign)
      const { data: corretorRoles } = await supabase.from("user_roles").select("user_id").eq("role", "corretor");
      const corretorIds = (corretorRoles || []).map((r) => r.user_id).filter((id) => id !== user.user_id);
      if (corretorIds.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("user_id, nome, ativo").in("user_id", corretorIds).eq("ativo", true).order("nome");
        setCorretores((profs || []).map((p) => ({ user_id: p.user_id, nome: p.nome || "Corretor" })));
      } else setCorretores([]);

      // Gerentes ativos (para absorb)
      if ((count || 0) > 0) {
        const { data: gRoles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
        const gIds = (gRoles || []).map((r) => r.user_id).filter((id) => id !== user.user_id);
        if (gIds.length) {
          const { data: profs } = await supabase.from("profiles")
            .select("user_id, nome, ativo").in("user_id", gIds).eq("ativo", true).order("nome");
          setGerentes((profs || []).map((p) => ({ user_id: p.user_id, nome: p.nome || "Gerente" })));
        } else setGerentes([]);
      }
      setLoading(false);
    })();
  }, [open, user]);

  if (!user) return null;

  const requiresReassign = isDelete; // delete always requires; inactivate optional
  const requiresAbsorb = teamCount > 0;

  const handleSubmit = async () => {
    if (requiresReassign && !reassignTo) {
      toast.error("Escolha o corretor destino dos leads/negócios/tarefas.");
      return;
    }
    if (requiresAbsorb && !absorbTeamTo) {
      toast.error("Escolha o gerente que vai absorver o time.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        action: isDelete ? "delete_user" : "inactivate_user",
        target_user_id: user.user_id,
      };
      if (reassignTo) {
        body.reassign_to = reassignTo;
        body.reassign_leads = true;
        body.reassign_negocios = true;
        body.reassign_tarefas = true;
      }
      if (absorbTeamTo) body.absorb_team_to = absorbTeamTo;

      const { data, error } = await supabase.functions.invoke("create-broker-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Operação concluída.");
      onDone();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isDelete ? "text-destructive" : "text-warning"}`} />
            {title}
          </DialogTitle>
          <DialogDescription>
            {isDelete
              ? `Ação irreversível. ${user.nome} será removido do sistema.`
              : `${user.nome} perderá o acesso e não receberá novos leads.`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-2">
            {requiresAbsorb && (
              <div className="space-y-1.5">
                <Label>Gerente que vai absorver o time ({teamCount} pessoas) *</Label>
                <Select value={absorbTeamTo} onValueChange={setAbsorbTeamTo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar gerente" /></SelectTrigger>
                  <SelectContent>
                    {gerentes.map((g) => (<SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Repassar leads / negócios / tarefas para {requiresReassign ? "*" : "(opcional)"}</Label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger><SelectValue placeholder="Selecionar corretor" /></SelectTrigger>
                <SelectContent>
                  {corretores.map((c) => (<SelectItem key={c.user_id} value={c.user_id}>{c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button
            variant={isDelete ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
