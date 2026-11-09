/** Roteiro de ligação já carregado para o empreendimento do cliente + objeções rápidas com resposta pronta. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOATemplates } from "@/hooks/useOfertaAtiva";
import { cn } from "@/lib/utils";
import { primeiroNome, type ClienteOA } from "./tipos";

const OBJECOES = [
  { emoji: "💰", label: "Está caro", resposta: "Entendo! Por isso vale a gente olhar junto: tem condição de entrada facilitada e o especialista monta uma simulação certinha pra você. Posso agendar uma visita rápida?" },
  { emoji: "🤔", label: "Preciso pensar", resposta: "Faz todo sentido. Que tal conhecer pessoalmente sem compromisso? Muita gente decide quando vê. Prefere durante a semana ou no sábado?" },
  { emoji: "⏰", label: "Não é o momento", resposta: "Tranquilo! As melhores unidades costumam sair primeiro. Posso te mostrar agora e você decide com calma quando for a hora?" },
  { emoji: "👫", label: "Falar com cônjuge", resposta: "Claro! O ideal é virem juntos. Qual dia fica melhor para os dois conhecerem?" },
  { emoji: "🏠", label: "Já comprei", resposta: "Que bom, parabéns! Se puder me dizer onde comprou, eu tiro você da nossa lista. Conhece alguém que esteja procurando?" },
];

const aplicar = (t: string, nome: string, emp: string) => t.replace(/\{nome\}/g, nome).replace(/\{empreendimento\}/g, emp);

export default function RoteiroPainel({ cliente, corretorNome }: { cliente: ClienteOA; corretorNome: string }) {
  const { user } = useAuth();
  const emp = cliente.empreendimento ?? "";
  const { templates } = useOATemplates(emp || undefined);
  const [aberta, setAberta] = useState<number | null>(null);
  const { data: scriptsTime = [] } = useQuery({
    queryKey: ["team-scripts-for-dialing", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("team_scripts").select("empreendimento, titulo, script_ligacao").eq("ativo", true).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const nome = primeiroNome(cliente.nome) || "tudo bem";
  const eu = primeiroNome(corretorNome);
  const roteiro = useMemo(() => {
    const doTime = scriptsTime.find((s) => s.empreendimento === emp && s.script_ligacao);
    if (doTime?.script_ligacao) return { titulo: doTime.titulo, texto: aplicar(doTime.script_ligacao, nome, emp) };
    const tpl = templates.find((t) => t.canal === "ligacao");
    if (tpl) return { titulo: tpl.titulo, texto: aplicar(tpl.conteudo, nome, emp) };
    const abertura = `Oi ${nome}, ${eu ? `aqui é ${eu}, ` : ""}da Uhome. Tudo bem?`;
    const corpo = emp
      ? `Você tinha demonstrado interesse no ${emp}. Saíram novidades e condições atualizadas, e lembrei de você.`
      : "Estou ligando porque temos empreendimentos com condições especiais que podem fazer sentido para você.";
    return { titulo: emp ? `Roteiro · ${emp}` : "Roteiro geral", texto: `${abertura}\n\n${corpo}\n\nAinda faz sentido conversar? Posso te mostrar em uma visita rápida: melhor durante a semana ou no sábado?` };
  }, [scriptsTime, templates, emp, nome, eu]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Roteiro">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold"><ScrollText className="h-4 w-4 shrink-0 text-primary" aria-hidden /><span className="truncate">{roteiro.titulo}</span></h3>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(roteiro.texto); toast.success("Roteiro copiado"); }} className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar
        </button>
      </header>
      <p className="whitespace-pre-line rounded-xl bg-primary/5 p-4 text-[15px] leading-relaxed">{roteiro.texto}</p>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Se o cliente disser…</p>
      <div className="flex flex-wrap gap-2">
        {OBJECOES.map((o, i) => (
          <button key={o.label} type="button" onClick={() => setAberta(aberta === i ? null : i)} aria-expanded={aberta === i}
            className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors duration-fast", aberta === i ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
            {o.emoji} {o.label}
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {aberta !== null && (
          <motion.p key={aberta} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden rounded-xl border border-primary/20 bg-card p-3 text-sm leading-relaxed">
            {OBJECOES[aberta].resposta}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
