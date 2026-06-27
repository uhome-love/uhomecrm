import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Users, Loader2, UserPlus, Handshake, Trash2, Pencil } from "lucide-react";
import { useLeadParcerias, useCreateParceria, useUpdateParceria, useDeleteParceria } from "@/hooks/useParcerias";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  corretorPrincipalId: string | null;
}

interface TeamMember {
  user_id: string;
  nome: string;
}

export default function PartnershipDialog({ open, onOpenChange, leadId, leadNome, corretorPrincipalId }: Props) {
  const { user } = useAuth();
  const { isGestor, isAdmin, isDiretor } = useUserRole();
  const [corretores, setCorretores] = useState<TeamMember[]>([]);
  const [parceiro, setParceiro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [editingParceriaId, setEditingParceriaId] = useState<string | null>(null);
  const [parceriaToDelete, setParceriaToDelete] = useState<{ id: string; nome: string } | null>(null);

  const canManageAll = isGestor || isAdmin || isDiretor;

  const excludedUserId = useMemo(() => corretorPrincipalId || user?.id || null, [corretorPrincipalId, user?.id]);

  // React Query: existing partnerships
  const { data: existingPartnerships = [] } = useLeadParcerias(open ? leadId : null);

  // React Query: create mutation
  const createMutation = useCreateParceria();
  const updateMutation = useUpdateParceria();
  const deleteMutation = useDeleteParceria();

  // Load team members (still imperative — not partnership data)
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [membersRes, profilesRes] = await Promise.all([
        supabase.from("team_members").select("user_id, nome").order("nome", { ascending: true }),
        supabase.from("profiles").select("user_id, nome").order("nome", { ascending: true }),
      ]);

      const memberMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p.user_id && p.nome) memberMap.set(p.user_id, p.nome);
      });
      (membersRes.data || []).forEach((m: any) => {
        if (m.user_id && m.nome) memberMap.set(m.user_id, m.nome);
      });

      const allMembers: TeamMember[] = Array.from(memberMap.entries())
        .map(([user_id, nome]) => ({ user_id, nome }))
        .filter(m => !excludedUserId || m.user_id !== excludedUserId)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setCorretores(allMembers);
    })();
  }, [open, excludedUserId]);

  const resetForm = () => {
    setParceiro("");
    setMotivo("");
    setEditingParceriaId(null);
  };

  const handleSave = async () => {
    if (!parceiro || !user) return;

    if (editingParceriaId) {
      await updateMutation.mutateAsync({
        parceriaId: editingParceriaId,
        leadId,
        corretorParceiroId: parceiro,
        motivo: motivo || undefined,
      });
      resetForm();
      return;
    }

    await createMutation.mutateAsync({
      leadId,
      corretorPrincipalId: corretorPrincipalId || user.id,
      corretorParceiroId: parceiro,
      motivo: motivo || undefined,
    });
    onOpenChange(false);
    resetForm();
  };

  const handleEdit = (parceria: typeof existingPartnerships[number]) => {
    setEditingParceriaId(parceria.id);
    setParceiro(parceria.corretor_parceiro_id);
    setMotivo(parceria.motivo || "");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-5 w-5 text-primary" />
            Compartilhar Lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              Registrar parceria para <strong>{leadNome}</strong>
            </span>
          </div>

          {existingPartnerships.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Parcerias existentes</Label>
              {existingPartnerships.map((p) => {
                const parceiroNome = corretores.find((c) => c.user_id === p.corretor_parceiro_id)?.nome || "Corretor";
                const canManage =
                  canManageAll ||
                  p.corretor_principal_id === user?.id ||
                  p.criado_por === user?.id;
                return (
                  <div key={p.id} className="flex flex-col gap-2 rounded-md bg-accent/50 p-2 text-xs sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <UserPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate text-sm font-medium text-foreground">{parceiroNome}</span>
                      <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
                        {p.divisao_principal}/{p.divisao_parceiro}
                      </Badge>
                    </div>
                    {canManage && (
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleEdit(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => setParceriaToDelete({ id: p.id, nome: parceiroNome })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Apagar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <Label className="text-xs">Corretor Parceiro</Label>
            <Select value={parceiro} onValueChange={setParceiro}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o corretor parceiro" />
              </SelectTrigger>
              <SelectContent>
                {corretores.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Divisão da Comissão</Label>
            <div className="text-xs text-muted-foreground">
              Divisão fixa: <strong className="text-foreground">50% / 50%</strong>
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Cliente indicado pelo parceiro"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          {editingParceriaId && (
            <Button variant="ghost" onClick={resetForm} disabled={updateMutation.isPending}>
              Cancelar edição
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!parceiro || createMutation.isPending || updateMutation.isPending}
            className="gap-1.5"
          >
            {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
            {editingParceriaId ? "Salvar edição" : "Registrar Parceria"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!parceriaToDelete} onOpenChange={(o) => !o && setParceriaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover parceria?</AlertDialogTitle>
            <AlertDialogDescription>
              A parceria com <strong>{parceriaToDelete?.nome}</strong> será removida deste lead. O lead
              ficará apenas com o corretor principal. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger-500 text-white hover:bg-danger-700"
              onClick={async () => {
                if (!parceriaToDelete) return;
                await deleteMutation.mutateAsync({ parceriaId: parceriaToDelete.id, leadId });
                setParceriaToDelete(null);
              }}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
