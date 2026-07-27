import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { UsuarioCentralRow } from "@/hooks/useUsuariosCentral";

export type UsuarioRow = UsuarioCentralRow;

interface Props {
  mode: "inactivate" | "delete";
  user: UsuarioCentralRow | null;
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
  const [impact, setImpact] = useState<{ leads: number; negocios: number; tarefas: number }>({ leads: 0, negocios: 0, tarefas: 0 });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const isDelete = mode === "delete";
  const title = isDelete ? "Excluir usuário definitivamente" : "Inativar usuário";
  const cta = isDelete ? "Excluir definitivamente" : "Inativar";

  useEffect(() => {
    if (!open || !user) return;
    setReassignTo(""); setAbsorbTeamTo(""); setConfirmName("");
    (async () => {
      setLoading(true);
      const [tmCount, corretorRoles, leads, negA, negB, tar] = await Promise.all([
        supabase.from("team_members").select("id", { count: "exact", head: true }).eq("gerente_id", user.user_id),
        supabase.from("user_roles").select("user_id").eq("role", "corretor"),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).eq("corretor_id", user.user_id),
        user.profile_id
          ? supabase.from("negocios").select("id", { count: "exact", head: true }).eq("corretor_id", user.profile_id).neq("fase", "ganho").neq("status", "perdido")
          : Promise.resolve({ count: 0 } as any),
        supabase.from("negocios").select("id", { count: "exact", head: true }).eq("auth_user_id", user.user_id).neq("fase", "ganho").neq("status", "perdido"),
        supabase.from("pipeline_tarefas").select("id", { count: "exact", head: true }).eq("responsavel_id", user.user_id).eq("concluida", false),
      ]);
      setTeamCount(tmCount.count || 0);
      setImpact({
        leads: leads.count || 0,
        negocios: Math.max(negA.count || 0, negB.count || 0),
        tarefas: tar.count || 0,
      });

      const corretorIds = (corretorRoles.data || []).map((r) => r.user_id).filter((id) => id !== user.user_id);
      if (corretorIds.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("user_id, nome, ativo").in("user_id", corretorIds).eq("ativo", true).order("nome");
        setCorretores((profs || []).map((p) => ({ user_id: p.user_id, nome: p.nome || "Corretor" })));
      } else setCorretores([]);

      if ((tmCount.count || 0) > 0) {
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

  const requiresReassign = isDelete;
  const requiresAbsorb = teamCount > 0;
  const nameMatches = !isDelete || confirmName.trim().toLowerCase() === (user.nome || "").trim().toLowerCase();
  const hasData = impact.leads > 0 || impact.negocios > 0 || impact.tarefas > 0;

  const handleSubmit = async () => {
    if (requiresReassign && !reassignTo) { toast.error("Escolha o corretor destino."); return; }
    if (requiresAbsorb && !absorbTeamTo) { toast.error("Escolha o gerente que vai absorver o time."); return; }
    if (isDelete && !nameMatches) { toast.error("Digite o nome exato para confirmar."); return; }
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        action: isDelete ? "delete_user" : "inactivate_user",
        target_user_id: user.user_id,
      };
      if (reassignTo) {
        body.reassign_to = reassignTo;
        body.reassign_leads = true; body.reassign_negocios = true; body.reassign_tarefas = true;
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
            {/* Impact preview */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dados vinculados</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold">{impact.leads}</div>
                  <div className="text-xs text-muted-foreground">Leads</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{impact.negocios}</div>
                  <div className="text-xs text-muted-foreground">Negócios</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{impact.tarefas}</div>
                  <div className="text-xs text-muted-foreground">Tarefas</div>
                </div>
              </div>
              {requiresAbsorb && (
                <div className="text-xs text-warning mt-2 border-t pt-2">
                  ⚠ Este usuário é gerente de <b>{teamCount}</b> pessoa(s). O time precisa ser absorvido por outro gerente.
                </div>
              )}
            </div>

            {requiresAbsorb && (
              <div className="space-y-1.5">
                <Label>Gerente que vai absorver o time *</Label>
                <Select value={absorbTeamTo} onValueChange={setAbsorbTeamTo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar gerente" /></SelectTrigger>
                  <SelectContent>
                    {gerentes.map((g) => (<SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(hasData || requiresReassign) && (
              <div className="space-y-1.5">
                <Label>Repassar leads / negócios / tarefas para {requiresReassign ? "*" : "(opcional)"}</Label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar corretor" /></SelectTrigger>
                  <SelectContent>
                    {corretores.map((c) => (<SelectItem key={c.user_id} value={c.user_id}>{c.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isDelete && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <div className="text-xs font-semibold text-destructive">Confirmação obrigatória</div>
                <p className="text-xs">Digite <b>{user.nome}</b> para confirmar a exclusão definitiva.</p>
                <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={user.nome} />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button
            variant={isDelete ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={submitting || loading || (isDelete && !nameMatches)}
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
