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
import { Loader2 } from "lucide-react";
import { useLiaExcluir, type LiaEstado } from "./useLiaHub";

interface Props {
  estado: LiaEstado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LiaExcluirDialog({ estado, open, onOpenChange }: Props) {
  const excluir = useLiaExcluir();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir contato da LIA?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso apaga <strong>definitivamente</strong> o estado, todas as conversas e os follow-ups
            de <strong>{estado?.nome || "Sem nome"}</strong> ({estado?.telefone}) na LIA.
            Ação irreversível. O lead no pipeline não é afetado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={excluir.isPending}
            onClick={async (e) => {
              e.preventDefault();
              if (!estado) return;
              await excluir.mutateAsync(estado.telefone);
              onOpenChange(false);
            }}
          >
            {excluir.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Excluir definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
