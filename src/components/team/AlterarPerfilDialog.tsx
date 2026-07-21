import { useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import type { UsuarioCentralRow } from "@/hooks/useUsuariosCentral";
import UserProfilePicker, { type ProfileRole } from "./UserProfilePicker";

interface Props {
  user: UsuarioCentralRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

export default function AlterarPerfilDialog({ user, open, onOpenChange, onDone }: Props) {
  const { isAdmin } = useUserRole();
  const [role, setRole] = useState<ProfileRole>("corretor");
  const [gerenteId, setGerenteId] = useState("");
  const [gerentes, setGerentes] = useState<{ user_id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setRole(user.role as ProfileRole);
    setGerenteId(user.gerente_id || "");
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      if (!roles?.length) return;
      const ids = roles.map((r) => r.user_id).filter((id) => id !== user.user_id);
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, nome, ativo").in("user_id", ids).eq("ativo", true).order("nome");
      if (profs) setGerentes(profs.map((p) => ({ user_id: p.user_id, nome: p.nome || "Gerente" })));
    })();
  }, [open, user]);

  if (!user) return null;

  const allowed: ProfileRole[] = isAdmin
    ? ["corretor", "gestor", "backoffice", "rh", "diretor"]
    : ["corretor", "gestor"];

  const handleSave = async () => {
    if (role === "corretor" && !gerenteId) {
      toast.error("Selecione o gerente do corretor.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: {
          action: "set_role",
          target_user_id: user.user_id,
          role,
          gerente_id: role === "corretor" ? gerenteId : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Perfil atualizado.");
      onDone();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Alterar perfil de acesso
          </DialogTitle>
          <DialogDescription>
            {user.nome} — alterar o perfil muda o que a pessoa pode acessar no CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <UserProfilePicker value={role} onChange={setRole} allow={allowed} />

          {role === "corretor" && (
            <div className="space-y-1.5">
              <Label>Gerente responsável *</Label>
              <Select value={gerenteId} onValueChange={setGerenteId}>
                <SelectTrigger><SelectValue placeholder="Selecionar gerente" /></SelectTrigger>
                <SelectContent>
                  {gerentes.map((g) => (
                    <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar perfil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
