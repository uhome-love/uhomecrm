import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Zap, MousePointerClick, TrendingUp, ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

/**
 * NovaGestaoOnboarding — aviso único "O CRM mudou" (Nova Gestão Comercial).
 * Aparece 1× por usuário (flag em localStorage por user.id). Explica a virada:
 * saúde por CONTATO REAL, mover rápido, ⚡ registrar, leads parados vão pra gestão.
 */

const STORAGE_PREFIX = "uhome:nova-gestao-onboarding:v1:";

const PONTOS: { icon: typeof Zap; titulo: string; texto: string }[] = [
  {
    icon: TrendingUp,
    titulo: "A cor do lead agora é por CONTATO real",
    texto: "🟢 em dia · 🟡 atenção · 🔴 desatualizado. A cor mostra há quanto tempo você não fala de verdade com o lead — não mais se tem tarefa aberta.",
  },
  {
    icon: MousePointerClick,
    titulo: "Mover ficou instantâneo",
    texto: "Arraste o lead entre etapas e ele move na hora, sem formulário. Só Venda, Descarte e Visita pedem o essencial.",
  },
  {
    icon: Zap,
    titulo: "⚡ Registre o que fez (e agende o próximo passo)",
    texto: "Depois de mover, um popup leve deixa você registrar o contato e agendar o próximo toque. Registrar é o que deixa o lead verde.",
  },
  {
    icon: ArrowUpRight,
    titulo: "Lead muito parado vai pra gestão",
    texto: "Se um lead ficar estagnado (largado tempo demais), ele sai da sua carteira e a gestão decide o que fazer. Foque no que está vivo.",
  },
];

export default function NovaGestaoOnboarding() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const key = STORAGE_PREFIX + user.id;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  const fechar = () => {
    if (user?.id) localStorage.setItem(STORAGE_PREFIX + user.id, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="sm:max-w-md gap-0 overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary to-primary/70 px-6 py-5 text-primary-foreground">
          <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">Nova Gestão Comercial</div>
          <div className="mt-1 text-xl font-extrabold tracking-tight">O CRM mudou 🚀</div>
          <div className="mt-1 text-[13px] opacity-90">Menos formulário, mais venda — e a cor do lead passa a dizer a verdade.</div>
        </div>

        <div className="flex flex-col gap-3.5 px-6 py-5">
          {PONTOS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.titulo} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <div className="text-[13.5px] font-bold text-foreground">{p.titulo}</div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{p.texto}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={fechar}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5",
              "text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            )}
          >
            <Check className="h-4 w-4" /> Entendi, bora vender
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
