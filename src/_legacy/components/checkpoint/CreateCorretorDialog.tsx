import { useState, useCallback } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateCorretorDialog({ open, onOpenChange, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [jetimobId, setJetimobId] = useState("");
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setNome("");
    setEmail("");
    setSenha("");
    setJetimobId("");
  };

  const handleCreate = useCallback(async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      toast.error("Preencha nome, email e senha.");
      return;
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: {
          action: "create_user",
          nome: nome.trim(),
          email: email.trim(),
          senha,
          role: "corretor",
          jetimob_user_id: jetimobId.trim() || null,
          // gerente_id omitted — edge function auto-assigns caller as gerente
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Corretor criado com sucesso!");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar corretor.");
    } finally {
      setCreating(false);
    }
  }, [nome, email, senha, jetimobId, onOpenChange, onCreated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Criar Corretor para seu Time
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
            <Label>ID Jetimob (opcional)</Label>
            <Input value={jetimobId} onChange={(e) => setJetimobId(e.target.value)} placeholder="Ex: 12345" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Criar Corretor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
