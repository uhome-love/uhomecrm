import { useEffect, useState } from "react";
import { Loader2, Save, KeyRound } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface UsuarioRow {
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  creci: string | null;
  jetimob_user_id: string | null;
  role: string;
  ativo: boolean;
  gerente_id?: string | null;
  gerente_nome?: string | null;
}

interface Props {
  user: UsuarioRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

export default function UsuarioDrawer({ user, open, onOpenChange, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [creci, setCreci] = useState("");
  const [jetimob, setJetimob] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNome(user.nome || "");
    setEmail(user.email || "");
    setTelefone(user.telefone || "");
    setCpf(user.cpf || "");
    setCreci(user.creci || "");
    setJetimob(user.jetimob_user_id || "");
    setNovaSenha("");
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, any> = {
        action: "update_user",
        target_user_id: user.user_id,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || null,
        cpf: cpf.trim() || null,
        creci: creci.trim() || null,
        jetimob_user_id: jetimob.trim() || null,
      };
      if (novaSenha) {
        if (novaSenha.length < 6) throw new Error("Senha mínima de 6 caracteres.");
        body.senha = novaSenha;
      }
      const { data, error } = await supabase.functions.invoke("create-broker-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Alterações salvas.");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {user.nome}
            <Badge variant="outline" className="text-xs uppercase">{user.role}</Badge>
            {!user.ativo && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CRECI</Label>
              <Input value={creci} onChange={(e) => setCreci(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ID Jetimob</Label>
              <Input value={jetimob} onChange={(e) => setJetimob(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" /> Redefinir senha
            </Label>
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Deixe em branco para manter"
            />
          </div>

          {user.gerente_nome && (
            <div className="text-xs text-muted-foreground">Gerente: {user.gerente_nome}</div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
