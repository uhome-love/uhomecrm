import { useEffect, useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type Role = "corretor" | "gestor";

export default function NovoUsuarioDialog({ open, onOpenChange, onCreated }: Props) {
  const { isAdmin, isDiretor } = useUserRole();
  const isPrivileged = isAdmin || isDiretor;
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [role, setRole] = useState<Role>("corretor");
  const [gerenteId, setGerenteId] = useState<string>("");
  const [jetimobId, setJetimobId] = useState("");
  const [creating, setCreating] = useState(false);
  const [gerentes, setGerentes] = useState<{ user_id: string; nome: string }[]>([]);

  useEffect(() => {
    if (!open || !isPrivileged) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      if (!roles?.length) return;
      const ids = roles.map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids).order("nome");
      if (profs) setGerentes(profs.map((p) => ({ user_id: p.user_id, nome: p.nome || "Gerente" })));
    })();
  }, [open, isPrivileged]);

  const reset = () => {
    setNome(""); setEmail(""); setSenha(""); setTelefone("");
    setRole("corretor"); setGerenteId(""); setJetimobId("");
  };

  const handleCreate = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      toast.error("Preencha nome, email e senha.");
      return;
    }
    if (senha.length < 6) {
      toast.error("Senha mínima de 6 caracteres.");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, any> = {
        action: "create_user",
        nome: nome.trim(),
        email: email.trim(),
        senha,
        telefone: telefone.trim() || null,
        role: isPrivileged ? role : "corretor",
      };
      if (isPrivileged && role === "corretor" && gerenteId) body.gerente_id = gerenteId;
      if (isPrivileged && jetimobId.trim()) body.jetimob_user_id = jetimobId.trim();

      const { data, error } = await supabase.functions.invoke("create-broker-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Usuário criado!");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar usuário.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Novo Usuário
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {isPrivileged && (
            <div className="space-y-1.5">
              <Label>Perfil de acesso *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="gestor">Gerente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João Silva" />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Senha *</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(51) 99999-9999" />
          </div>
          {isPrivileged && role === "corretor" && gerentes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Gerente do corretor</Label>
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
          {isPrivileged && (
            <div className="space-y-1.5">
              <Label>ID Jetimob (opcional)</Label>
              <Input value={jetimobId} onChange={(e) => setJetimobId(e.target.value)} placeholder="Ex: 12345" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
