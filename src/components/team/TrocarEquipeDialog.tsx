import { useEffect, useState } from "react";
import { Users, Loader2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UsuarioCentralRow } from "@/hooks/useUsuariosCentral";

interface Props {
  user: UsuarioCentralRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

export default function TrocarEquipeDialog({ user, open, onOpenChange, onDone }: Props) {
  const [gerenteId, setGerenteId] = useState("");
  const [gerentes, setGerentes] = useState<{ user_id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setGerenteId("");
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      if (!roles?.length) return;
      const ids = roles.map((r) => r.user_id).filter((id) => id !== user.gerente_id && id !== user.user_id);
      if (!ids.length) return;
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, nome, ativo").in("user_id", ids).eq("ativo", true).order("nome");
      if (profs) setGerentes(profs.map((p) => ({ user_id: p.user_id, nome: p.nome || "Gerente" })));
    })();
  }, [open, user]);

  if (!user) return null;

  const handleSave = async () => {
    if (!gerenteId) { toast.error("Escolha o novo gerente."); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: { action: "move_to_team", target_user_id: user.user_id, gerente_id: gerenteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Corretor movido para o novo time.");
      onDone();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao mover.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Trocar de equipe
          </DialogTitle>
          <DialogDescription>Mover {user.nome} para outro gerente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 text-sm">
            <div className="rounded-md border bg-muted/40 px-3 py-2 flex-1">
              <div className="text-xs text-muted-foreground">Gerente atual</div>
              <div className="font-medium truncate">{user.gerente_nome || "—"}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="rounded-md border bg-primary/5 border-primary/30 px-3 py-2 flex-1">
              <div className="text-xs text-muted-foreground">Novo gerente</div>
              <div className="font-medium truncate">
                {gerentes.find((g) => g.user_id === gerenteId)?.nome || "—"}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Selecionar gerente *</Label>
            <Select value={gerenteId} onValueChange={setGerenteId}>
              <SelectTrigger><SelectValue placeholder="Escolher gerente" /></SelectTrigger>
              <SelectContent>
                {gerentes.map((g) => (
                  <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !gerenteId} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
