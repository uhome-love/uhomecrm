import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Plus, CalendarDays, Bell, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

// Comunicado único do módulo Tarefas: só corretores, a partir de 14/10/2026 09:00 BRT, 1 vez por usuário.
const INICIO = new Date("2026-10-14T09:00:00-03:00").getTime();
const chave = (uid: string) => `comunicado_tarefas_2026_10_visto:${uid}`;

const ITENS = [
  { icon: Plus, t: "Crie em segundos", d: "Cliente, o que fazer e horário, com atalhos." },
  { icon: CalendarDays, t: "Tudo organizado", d: "Vencidas, Hoje, Próximas e Sem próximo passo." },
  { icon: CheckCircle2, t: "Concluir atualiza", d: "A observação vai direto para a história do cliente." },
  { icon: Bell, t: "Aviso no celular", d: "Push + sininho na hora da tarefa. Ative as notificações do CRM no celular." },
];

export default function ComunicadoTarefas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = () => {
      if (Date.now() >= INICIO && !localStorage.getItem(chave(user.id))) setOpen(true);
    };
    check();
    const id = window.setInterval(check, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [user]);

  const fechar = (irParaTarefas: boolean) => {
    if (user) localStorage.setItem(chave(user.id), new Date().toISOString());
    setOpen(false);
    if (irParaTarefas) navigate("/tarefas");
  };

  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar(false)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold">Novidade: suas Tarefas voltaram</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Página própria no menu, logo abaixo de Agenda.
          </DialogDescription>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-[13px] text-primary">
          <b>Não é obrigatório.</b> É uma ferramenta para te ajudar a não esquecer nenhum cliente.
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ITENS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl bg-muted/60 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon className="h-4 w-4 text-primary" /> {t}
              </div>
              <div className="text-[12px] leading-snug text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-xl bg-primary/5 p-3 text-[13px] text-foreground">
          <b>Benefício:</b> menos cliente esfriando, história sempre atualizada e mais visitas marcadas.
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => fechar(false)}>Depois</Button>
          <Button className="flex-1" onClick={() => fechar(true)}>Ver minhas tarefas</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
