import { useEffect, useState } from "react";
import { Loader2, Save, KeyRound, Shield, Users, Clock, User as UserIcon, Power, PowerOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { formatBRT } from "@/lib/brtTime";
import { ROLE_META, type ProfileRole } from "./UserProfilePicker";
import type { UsuarioCentralRow } from "@/hooks/useUsuariosCentral";
import AlterarPerfilDialog from "./AlterarPerfilDialog";
import TrocarEquipeDialog from "./TrocarEquipeDialog";

export type UsuarioRow = UsuarioCentralRow;

interface Props {
  user: UsuarioCentralRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  onRequestInactivate?: (u: UsuarioCentralRow) => void;
  onRequestReactivate?: (u: UsuarioCentralRow) => void;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "CEO", diretor: "Diretor", gestor: "Gerente",
  corretor: "Corretor", backoffice: "Backoffice", rh: "RH",
};

export default function UsuarioDrawer({ user, open, onOpenChange, onSaved, onRequestInactivate, onRequestReactivate }: Props) {
  const { isAdmin, isDiretor } = useUserRole();
  const isPrivileged = isAdmin || isDiretor;

  const [tab, setTab] = useState("perfil");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [creci, setCreci] = useState("");
  const [jetimob, setJetimob] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [saving, setSaving] = useState(false);

  const [counts, setCounts] = useState<{ leads: number; negocios: number; tarefas: number } | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [alterarOpen, setAlterarOpen] = useState(false);
  const [trocarOpen, setTrocarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setTab("perfil");
    setNome(user.nome || ""); setEmail(user.email || "");
    setTelefone(user.telefone || ""); setCpf(user.cpf || "");
    setCreci(user.creci || ""); setJetimob(user.jetimob_user_id || "");
    setNovaSenha("");
  }, [user]);

  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const [leads, negA, negB, tar, aud] = await Promise.all([
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).eq("corretor_id", user.user_id),
        user.profile_id
          ? supabase.from("negocios").select("id", { count: "exact", head: true }).eq("corretor_id", user.profile_id).neq("fase", "ganho").neq("status", "perdido")
          : Promise.resolve({ count: 0 } as any),
        supabase.from("negocios").select("id", { count: "exact", head: true }).eq("auth_user_id", user.user_id).neq("fase", "ganho").neq("status", "perdido"),
        supabase.from("pipeline_tarefas").select("id", { count: "exact", head: true }).eq("responsavel_id", user.user_id).eq("concluida", false),
        supabase.from("audit_log").select("acao, descricao, created_at").eq("chave_unica", user.user_id).eq("modulo", "usuarios").order("created_at", { ascending: false }).limit(20),
      ]);
      const negTotal = Math.max(negA.count || 0, negB.count || 0);
      setCounts({ leads: leads.count || 0, negocios: negTotal, tarefas: tar.count || 0 });
      setAudit(aud.data || []);
    })();
  }, [user, open]);

  if (!user) return null;

  const handleSave = async () => {
    try {
      const cleanNome = nome.trim();
      const cleanEmail = email.trim();
      if (!cleanNome || cleanNome.length > 120) throw new Error("Informe um nome válido de até 120 caracteres.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Informe um e-mail válido.");
      if (novaSenha && (novaSenha.length < 8 || novaSenha.length > 128)) {
        throw new Error("A nova senha deve ter entre 8 e 128 caracteres.");
      }

      setSaving(true);
      const body: Record<string, unknown> = {
        action: "update_user",
        target_user_id: user.user_id,
        nome: cleanNome,
        email: cleanEmail,
        telefone: telefone.trim() || null,
        cpf: cpf.trim() || null,
        creci: creci.trim() || null,
        jetimob_user_id: jetimob.trim() || null,
      };
      if (novaSenha) {
        body.senha = novaSenha;
      }
      const { data, error } = await supabase.functions.invoke("create-broker-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const warnings = Array.isArray(data?.warnings)
        ? data.warnings.filter((warning: unknown): warning is string => typeof warning === "string")
        : [];
      if (warnings.length > 0) toast.warning(warnings.join(" "), { duration: 8000 });
      else toast.success("Alterações salvas.");
      if (!warnings.some((warning) => warning.includes("senha não foi alterada"))) setNovaSenha("");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const meta = ROLE_META[user.role as ProfileRole] || ROLE_META.corretor;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="p-6 pb-3 border-b sticky top-0 bg-background z-10">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
                {(user.nome || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-left truncate">{user.nome}</SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${meta.color}`}>{ROLE_LABEL[user.role] || user.role}</Badge>
                  {user.ativo ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-emerald-500/30 text-xs">Ativo</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Inativo</Badge>
                  )}
                  {user.gerente_nome && (
                    <span className="text-xs text-muted-foreground">· {user.gerente_nome}</span>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          <Tabs value={tab} onValueChange={setTab} className="p-6 pt-4">
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="perfil"><UserIcon className="h-3.5 w-3.5 mr-1" /> Perfil</TabsTrigger>
              <TabsTrigger value="acesso"><Shield className="h-3.5 w-3.5 mr-1" /> Acesso</TabsTrigger>
              <TabsTrigger value="equipe"><Users className="h-3.5 w-3.5 mr-1" /> Equipe</TabsTrigger>
              <TabsTrigger value="atividade"><Clock className="h-3.5 w-3.5 mr-1" /> Atividade</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="space-y-4 m-0">
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
              <div className="pt-2 flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="acesso" className="space-y-4 m-0">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Perfil atual</div>
                    <div className="font-medium mt-0.5">{ROLE_LABEL[user.role]}</div>
                    <div className="text-xs text-muted-foreground mt-1">{meta.desc}</div>
                  </div>
                  {isAdmin || isDiretor ? (
                    <Button variant="outline" size="sm" onClick={() => setAlterarOpen(true)}>Alterar perfil</Button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5" /> Redefinir senha
                </Label>
                <div className="flex gap-2">
                  <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Deixe em branco para manter" minLength={8} maxLength={128} />
                  <Button onClick={handleSave} disabled={saving || !novaSenha} variant="outline">Aplicar</Button>
                </div>
                <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres, combinando letras, números e símbolos. Senhas muito comuns são recusadas.</p>
              </div>

              <div className="rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Status da conta</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {user.ativo ? "Pode acessar o CRM e receber leads." : "Acesso bloqueado. Não recebe leads."}
                  </div>
                </div>
                {user.ativo ? (
                  <Button variant="outline" size="sm" onClick={() => onRequestInactivate?.(user)} className="gap-2 text-warning">
                    <PowerOff className="h-4 w-4" /> Inativar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onRequestReactivate?.(user)} className="gap-2 text-emerald-600">
                    <Power className="h-4 w-4" /> Reativar
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="equipe" className="space-y-4 m-0">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Gerente atual</div>
                    <div className="font-medium mt-0.5">{user.gerente_nome || "Não vinculado"}</div>
                    {user.equipe && <div className="text-xs text-muted-foreground mt-1">Equipe: {user.equipe}</div>}
                  </div>
                  {isPrivileged && user.role === "corretor" && (
                    <Button variant="outline" size="sm" onClick={() => setTrocarOpen(true)}>Trocar equipe</Button>
                  )}
                </div>
              </div>

              {counts && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-semibold">{counts.leads}</div>
                    <div className="text-xs text-muted-foreground">Leads ativos</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-semibold">{counts.negocios}</div>
                    <div className="text-xs text-muted-foreground">Negócios abertos</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-semibold">{counts.tarefas}</div>
                    <div className="text-xs text-muted-foreground">Tarefas pendentes</div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="atividade" className="space-y-2 m-0">
              <div className="rounded-lg border p-4 text-sm">
                <div className="text-xs text-muted-foreground">Último acesso</div>
                <div className="font-medium mt-0.5">
                  {user.last_sign_in ? formatBRT(user.last_sign_in, "dd/MM/yyyy HH:mm") : "Nunca acessou"}
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="p-3 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                  Histórico de alterações
                </div>
                {audit.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">Nenhum registro.</div>
                ) : (
                  <div className="divide-y">
                    {audit.map((a, i) => (
                      <div key={i} className="p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{a.acao}</span>
                          <span className="text-xs text-muted-foreground">{formatBRT(a.created_at, "dd/MM HH:mm")}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{a.descricao}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AlterarPerfilDialog user={user} open={alterarOpen} onOpenChange={setAlterarOpen} onDone={onSaved} />
      <TrocarEquipeDialog user={user} open={trocarOpen} onOpenChange={setTrocarOpen} onDone={onSaved} />
    </>
  );
}
