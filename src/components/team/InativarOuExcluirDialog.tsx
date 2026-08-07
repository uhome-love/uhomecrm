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
  const [destino, setDestino] = useState<"repassar" | "descarte">("repassar");
  const [gerenteAlvo, setGerenteAlvo] = useState<{ id: string; nome: string } | null>(null);
  const [previewDescarte, setPreviewDescarte] = useState<{ frios: number; quentes: number; tarefas: number }>({ frios: 0, quentes: 0, tarefas: 0 });

  const isDelete = mode === "delete";
  const title = isDelete ? "Excluir usuário definitivamente" : "Inativar usuário";
  const cta = isDelete ? "Excluir definitivamente" : "Inativar";

  useEffect(() => {
    if (!open || !user) return;
    setReassignTo(""); setAbsorbTeamTo(""); setConfirmName(""); setDestino("repassar");
    setGerenteAlvo(null); setPreviewDescarte({ frios: 0, quentes: 0, tarefas: 0 });
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
        supabase.from("pipeline_tarefas").select("id", { count: "exact", head: true }).eq("responsavel_id", user.user_id).neq("status", "concluida").neq("status", "cancelada"),
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

      // Gerente do corretor (recebe os leads avançados quando o destino é Descarte)
      const { data: tm } = await supabase.from("team_members")
        .select("gerente_id").eq("user_id", user.user_id).maybeSingle();
      if (tm?.gerente_id) {
        const { data: gp } = await supabase.from("profiles")
          .select("nome").eq("user_id", tm.gerente_id).maybeSingle();
        setGerenteAlvo({ id: tm.gerente_id, nome: gp?.nome || "Gerente" });
      }

      // Prévia do descarte: frios × avançados
      const [{ data: stagesData }, { data: leadRows }] = await Promise.all([
        supabase.from("pipeline_stages").select("id, tipo").eq("pipeline_tipo", "leads"),
        supabase.from("pipeline_leads").select("id, stage_id, negocio_id").eq("corretor_id", user.user_id),
      ]);
      const avancados = new Set((stagesData || []).filter((s: any) => ["proposta", "contrato_gerado", "venda"].includes(s.tipo)).map((s: any) => s.id));
      const intocaveis = new Set((stagesData || []).filter((s: any) => ["descarte", "caiu"].includes(s.tipo)).map((s: any) => s.id));
      const frios: string[] = []; let quentes = 0;
      (leadRows || []).forEach((l: any) => {
        if (intocaveis.has(l.stage_id)) return;
        if (l.negocio_id || avancados.has(l.stage_id)) quentes += 1;
        else frios.push(l.id);
      });
      let tarefasFrios = 0;
      for (let i = 0; i < frios.length; i += 200) {
        const { count } = await supabase.from("pipeline_tarefas")
          .select("id", { count: "exact", head: true })
          .in("pipeline_lead_id", frios.slice(i, i + 200))
          .neq("status", "concluida").neq("status", "cancelada");
        tarefasFrios += count || 0;
      }
      setPreviewDescarte({ frios: frios.length, quentes, tarefas: tarefasFrios });

      setLoading(false);
    })();
  }, [open, user]);

  if (!user) return null;

  const isDescarte = destino === "descarte";
  const requiresReassign = isDelete && !isDescarte;
  const requiresAbsorb = teamCount > 0;
  const nameMatches = !isDelete || confirmName.trim().toLowerCase() === (user.nome || "").trim().toLowerCase();
  const hasData = impact.leads > 0 || impact.negocios > 0 || impact.tarefas > 0;
  const precisaDestinoAvancados = isDescarte && !gerenteAlvo;

  const handleSubmit = async () => {
    if (requiresReassign && !reassignTo) { toast.error("Escolha o corretor destino."); return; }
    if (precisaDestinoAvancados && !reassignTo) {
      toast.error("Este corretor não tem gerente. Escolha quem recebe os leads avançados e negócios.");
      return;
    }
    if (requiresAbsorb && !absorbTeamTo) { toast.error("Escolha o gerente que vai absorver o time."); return; }
    if (isDelete && !nameMatches) { toast.error("Digite o nome exato para confirmar."); return; }
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        action: isDelete ? "delete_user" : "inactivate_user",
        target_user_id: user.user_id,
      };
      if (isDescarte) body.lead_destination = "descarte";
      if (reassignTo) {
        body.reassign_to = reassignTo;
        if (!isDescarte) {
          body.reassign_leads = true; body.reassign_negocios = true; body.reassign_tarefas = true;
        }
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

            {/* Destino da carteira */}
            <div className="space-y-2">
              <Label>Destino da carteira</Label>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setDestino("repassar")}
                  className={`rounded-lg border p-3 text-left text-sm transition ${destino === "repassar" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                >
                  <div className="font-medium">Repassar tudo para outro corretor</div>
                  <div className="text-xs text-muted-foreground">Leads, negócios e tarefas vão para o corretor escolhido.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDestino("descarte")}
                  className={`rounded-lg border p-3 text-left text-sm transition ${destino === "descarte" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                >
                  <div className="font-medium">Descartar leads frios + avançados para o gerente</div>
                  <div className="text-xs text-muted-foreground">
                    Leads frios voltam para reengajamento; avançados e negócios vão para {gerenteAlvo?.nome || "o gerente"}.
                  </div>
                </button>
              </div>

              {isDescarte && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Leads que vão para Descarte</span><b>{previewDescarte.frios}</b></div>
                  <div className="flex justify-between">
                    <span>Leads avançados para {gerenteAlvo?.nome || "destino"}</span><b>{previewDescarte.quentes}</b>
                  </div>
                  <div className="flex justify-between"><span>Negócios em aberto repassados</span><b>{impact.negocios}</b></div>
                  <div className="flex justify-between"><span>Tarefas pendentes canceladas</span><b>{previewDescarte.tarefas}</b></div>
                  {precisaDestinoAvancados && (
                    <div className="text-warning pt-1 border-t mt-1">
                      ⚠ Este corretor não tem gerente definido. Escolha abaixo quem recebe os leads avançados e negócios.
                    </div>
                  )}
                </div>
              )}
            </div>

            {(hasData || requiresReassign || precisaDestinoAvancados) && (
              <div className="space-y-1.5">
                <Label>
                  {isDescarte
                    ? `Destino dos leads avançados / negócios ${precisaDestinoAvancados ? "*" : "(opcional — sobrepõe o gerente)"}`
                    : `Repassar leads / negócios / tarefas para ${requiresReassign ? "*" : "(opcional)"}`}
                </Label>
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
