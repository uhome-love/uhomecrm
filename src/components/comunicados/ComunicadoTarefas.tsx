import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Plus, CalendarDays, Bell, AlertTriangle, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

// Comunicado único do módulo Tarefas: só corretores, a partir de 14/10/2026 09:00 BRT, 1 vez por usuário.
const INICIO = new Date("2026-10-14T09:00:00-03:00").getTime();
const chave = (uid: string) => `comunicado_tarefas_2026_10_visto:${uid}`;

const ITENS = [
  { icon: Plus, t: "Crie em segundos", d: "Escolha o cliente, o que fazer (Ligar, WhatsApp, Follow-up, Visita) e o horário. Atalhos: Hoje 18h, Amanhã 10h, Em 3 dias, Próxima semana." },
  { icon: CalendarDays, t: "Tudo organizado num lugar só", d: "Abas Vencidas, Hoje, Próximas, Novas e Concluídas. Tarefa de hoje que passou do horário fica em vermelho: \"atrasada\"." },
  { icon: CheckCircle2, t: "Concluir já atualiza o cliente", d: "Diga como foi o contato (ligação, WhatsApp, presencial) e escreva uma observação. Vai direto para a história do cliente e você já agenda o próximo passo na mesma janela." },
  { icon: Bell, t: "Aviso na hora certa", d: "O CRM avisa no sininho (e no celular, se as notificações estiverem ligadas) quando chega a hora da tarefa." },
  { icon: AlertTriangle, t: "Nenhum cliente esquecido", d: "A página mostra quem está sem próximo passo para você criar a tarefa com um clique." },
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold">Novidade: suas Tarefas voltaram</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Agora com página própria no menu, logo abaixo de Agenda.
          </DialogDescription>
        </div>
        <div className="mt-2 space-y-3">
          {ITENS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{t}</div>
                <div className="text-[13px] leading-snug text-muted-foreground">{d}</div>
              </div>
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
