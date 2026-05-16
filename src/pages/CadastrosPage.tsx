import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, Users, CreditCard, Mail, BadgeCheck, Phone, Pencil, Save, Trash2 } from "lucide-react";

type ProfileRow = {
  id: string;
  nome: string | null;
  email: string | null;
  cpf: string | null;
  creci: string | null;
  cargo: string | null;
  telefone: string | null;
  avatar_url: string | null;
};

export default function CadastrosPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [deleting, setDeleting] = useState<ProfileRow | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", cpf: "", creci: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["cadastros-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_profiles_admin");
      if (error) throw error;
      return (data || []) as ProfileRow[];
    },
    enabled: !!user,
  });

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.nome?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.cpf?.toLowerCase().includes(q) ||
      p.creci?.toLowerCase().includes(q) ||
      p.cargo?.toLowerCase().includes(q)
    );
  });

  const cargoColor = (cargo: string | null) => {
    switch (cargo) {
      case "admin": return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
      case "gerente": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      case "corretor": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const cargoLabel = (cargo: string | null) => {
    switch (cargo) {
      case "admin": return "CEO / Admin";
      case "gerente": return "Gerente";
      case "corretor": return "Corretor";
      default: return cargo || "—";
    }
  };

  const missingFields = (p: ProfileRow) => {
    const missing: string[] = [];
    if (!p.cpf) missing.push("CPF");
    if (!p.email) missing.push("Email");
    if (!p.creci) missing.push("CRECI");
    return missing;
  };

  function openEdit(p: ProfileRow) {
    setEditing(p);
    setForm({
      nome: p.nome || "",
      email: p.email || "",
      telefone: p.telefone || "",
      cpf: p.cpf || "",
      creci: p.creci || "",
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_profile", {
      _profile_id: editing.id,
      _nome: form.nome.trim() || null,
      _email: form.email.trim() || null,
      _telefone: form.telefone.trim() || null,
      _cpf: form.cpf.trim() || null,
      _creci: form.creci.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Cadastro atualizado!");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["cadastros-profiles"] });
  }

  async function handleDelete() {
    if (!deleting) return;
    setRemoving(true);
    const { error } = await supabase.rpc("admin_delete_profile", { _profile_id: deleting.id });
    setRemoving(false);
    if (error) {
      toast.error("Erro ao apagar: " + error.message);
      return;
    }
    toast.success("Cadastro apagado.");
    setDeleting(null);
    queryClient.invalidateQueries({ queryKey: ["cadastros-profiles"] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Cadastros
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados cadastrais dos profissionais — utilizados para geração de pagadorias e contratos
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, CRECI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const missing = missingFields(p);
          return (
            <Card key={p.id} className="relative overflow-hidden">
              {missing.length > 0 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">{p.nome || "Sem nome"}</CardTitle>
                    <Badge variant="secondary" className={`mt-1 text-[10px] ${cargoColor(p.cargo)}`}>
                      {cargoLabel(p.cargo)}
                    </Badge>
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)} className="h-7 px-2">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={p.cpf ? "text-foreground" : "text-muted-foreground italic"}>
                    {p.cpf || "CPF não cadastrado"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={p.email ? "text-foreground" : "text-muted-foreground italic"}>
                    {p.email || "Email não cadastrado"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={p.telefone ? "text-foreground" : "text-muted-foreground italic"}>
                    {p.telefone || "Telefone não cadastrado"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={p.creci ? "text-foreground" : "text-muted-foreground italic"}>
                    {p.creci || "CRECI não cadastrado"}
                  </span>
                </div>

                {missing.length > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                    ⚠️ Pendente: {missing.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum cadastro encontrado.
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cadastro</DialogTitle>
            <DialogDescription>{editing?.nome || editing?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CRECI</Label>
              <Input value={form.creci} onChange={(e) => setForm({ ...form, creci: e.target.value })} placeholder="CRECI/RS 00000" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
