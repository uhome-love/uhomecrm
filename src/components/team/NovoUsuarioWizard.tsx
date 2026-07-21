import { useEffect, useMemo, useState } from "react";
import { UserPlus, Loader2, ArrowRight, ArrowLeft, Check, Copy, Dice5 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import UserProfilePicker, { type ProfileRole } from "./UserProfilePicker";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function NovoUsuarioWizard({ open, onOpenChange, onCreated }: Props) {
  const { isAdmin, isDiretor } = useUserRole();
  const { user } = useAuth();
  const isPrivileged = isAdmin || isDiretor;

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<ProfileRole>("corretor");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [creci, setCreci] = useState("");
  const [jetimobId, setJetimobId] = useState("");
  const [gerenteId, setGerenteId] = useState("");
  const [creating, setCreating] = useState(false);
  const [gerentes, setGerentes] = useState<{ user_id: string; nome: string }[]>([]);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; senha: string } | null>(null);

  const allowedRoles: ProfileRole[] = useMemo(() => {
    if (isAdmin) return ["corretor", "gestor", "backoffice", "rh", "diretor"];
    if (isDiretor) return ["corretor", "gestor"];
    return ["corretor"];
  }, [isAdmin, isDiretor]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      if (!roles?.length) return;
      const ids = roles.map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, nome, ativo").in("user_id", ids).eq("ativo", true).order("nome");
      if (profs) setGerentes(profs.map((p) => ({ user_id: p.user_id, nome: p.nome || "Gerente" })));
    })();
  }, [open]);

  useEffect(() => {
    if (open) {
      setStep(1); setRole("corretor"); setNome(""); setEmail(""); setSenha("");
      setTelefone(""); setCpf(""); setCreci(""); setJetimobId(""); setGerenteId("");
      setCreatedInfo(null);
    }
  }, [open]);

  const canProceed = () => {
    if (step === 1) return !!role;
    if (step === 2) return nome.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && senha.length >= 6;
    if (step === 3) {
      if (role !== "corretor") return true;
      if (!isPrivileged) return true; // gerente auto-atribui a si
      return !!gerenteId;
    }
    return false;
  };

  const totalSteps = role === "corretor" ? 3 : 2;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const body: Record<string, any> = {
        action: "create_user",
        nome: nome.trim(), email: email.trim(), senha,
        telefone: telefone.trim() || null,
        cpf: cpf.trim() || null,
        creci: creci.trim() || null,
        role: isPrivileged ? role : "corretor",
      };
      if (isPrivileged && role === "corretor" && gerenteId) body.gerente_id = gerenteId;
      if (!isPrivileged && role === "corretor") body.gerente_id = user?.id;
      if (isPrivileged && jetimobId.trim()) body.jetimob_user_id = jetimobId.trim();

      const { data, error } = await supabase.functions.invoke("create-broker-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Usuário criado!");
      setCreatedInfo({ email: email.trim(), senha });
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar usuário.");
    } finally {
      setCreating(false);
    }
  };

  const copyCreds = () => {
    if (!createdInfo) return;
    const text = `Email: ${createdInfo.email}\nSenha: ${createdInfo.senha}`;
    navigator.clipboard.writeText(text);
    toast.success("Credenciais copiadas");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {createdInfo ? "Usuário criado" : "Novo Usuário"}
          </DialogTitle>
        </DialogHeader>

        {createdInfo ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                <Check className="h-4 w-4" /> Credenciais de acesso
              </div>
              <div className="text-sm space-y-1 font-mono">
                <div>Email: <span className="font-semibold">{createdInfo.email}</span></div>
                <div>Senha: <span className="font-semibold">{createdInfo.senha}</span></div>
              </div>
              <Button variant="outline" size="sm" onClick={copyCreds} className="gap-2 mt-2">
                <Copy className="h-3.5 w-3.5" /> Copiar credenciais
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie essas credenciais para o novo usuário. Ele poderá alterar a senha no primeiro login.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Stepper */}
            <div className="flex items-center gap-2 py-2">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const active = step === i + 1;
                const done = step > i + 1;
                return (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0",
                      done ? "bg-primary text-primary-foreground border-primary" :
                      active ? "border-primary text-primary" : "border-border text-muted-foreground"
                    )}>
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    {i < totalSteps - 1 && (
                      <div className={cn("h-0.5 flex-1", done ? "bg-primary" : "bg-border")} />
                    )}
                  </div>
                );
              })}
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Escolha o perfil de acesso</p>
                <UserProfilePicker value={role} onChange={setRole} allow={allowedRoles} />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3 py-1">
                <div className="space-y-1.5">
                  <Label>Nome completo *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha temporária *</Label>
                  <div className="flex gap-2">
                    <Input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mín. 6 caracteres" />
                    <Button type="button" variant="outline" size="icon" onClick={() => setSenha(generatePassword())} title="Gerar senha">
                      <Dice5 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(51) 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF</Label>
                    <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                </div>
                {role === "corretor" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>CRECI</Label>
                      <Input value={creci} onChange={(e) => setCreci(e.target.value)} />
                    </div>
                    {isPrivileged && (
                      <div className="space-y-1.5">
                        <Label>ID Jetimob</Label>
                        <Input value={jetimobId} onChange={(e) => setJetimobId(e.target.value)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 3 && role === "corretor" && (
              <div className="space-y-3 py-1">
                <p className="text-sm text-muted-foreground">Vincular ao time</p>
                {!isPrivileged ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    Você será o gerente deste corretor. Ele aparecerá no seu time imediatamente.
                  </div>
                ) : (
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
                    <p className="text-xs text-muted-foreground">
                      O corretor aparecerá no time do gerente escolhido — leads, roleta, presença e dashboards.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t mt-2">
              <Button variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)} disabled={creating}>
                {step === 1 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</>)}
              </Button>
              {step < totalSteps ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="gap-1">
                  Próximo <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={!canProceed() || creating} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Criar usuário
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
