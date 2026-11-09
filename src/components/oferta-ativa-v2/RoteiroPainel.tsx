/** Roteiro de ligação já carregado para o empreendimento do cliente + objeções rápidas com resposta pronta. */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, ScrollText, Pencil, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOATemplates } from "@/hooks/useOfertaAtiva";
import { cn } from "@/lib/utils";
import { primeiroNome, type ClienteOA } from "./tipos";
import { roteiroNatalOA } from "@/natal/roteiroOA";

const OBJECOES = [
  { emoji: "💰", label: "Está caro", resposta: "Entendo! Por isso vale a gente olhar junto: tem condição de entrada facilitada e o especialista monta uma simulação certinha pra você. Posso agendar uma visita rápida?" },
  { emoji: "🤔", label: "Preciso pensar", resposta: "Faz todo sentido. Que tal conhecer pessoalmente sem compromisso? Muita gente decide quando vê. Prefere durante a semana ou no sábado?" },
  { emoji: "⏰", label: "Não é o momento", resposta: "Tranquilo! As melhores unidades costumam sair primeiro. Posso te mostrar agora e você decide com calma quando for a hora?" },
  { emoji: "👫", label: "Falar com cônjuge", resposta: "Claro! O ideal é virem juntos. Qual dia fica melhor para os dois conhecerem?" },
  { emoji: "🏠", label: "Já comprei", resposta: "Que bom, parabéns! Se puder me dizer onde comprou, eu tiro você da nossa lista. Conhece alguém que esteja procurando?" },
];

const aplicar = (t: string, nome: string, emp: string, eu = "") => t.replace(/\{nome\}/g, nome).replace(/\{empreendimento\}/g, emp).replace(/\{eu\}/g, eu ? `aqui é ${eu}, ` : "");

export default function RoteiroPainel({ cliente, corretorNome }: { cliente: ClienteOA; corretorNome: string }) {
  const { user } = useAuth();
  const emp = cliente.empreendimento ?? "";
  const { templates } = useOATemplates(emp || undefined);
  const [aberta, setAberta] = useState<number | null>(null);
  const chave = `oa-roteiro:${user?.id ?? "anon"}:${emp || "geral"}`;
  const [meu, setMeu] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  useEffect(() => { setMeu(localStorage.getItem(chave)); setEditando(false); setAberta(null); }, [chave]);
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
  const natal = useMemo(() => roteiroNatalOA(emp, new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })), [emp]);
  const objecoes = natal?.objecoes ?? OBJECOES;
  const roteiro = useMemo(() => {
    if (meu) return { titulo: `Meu roteiro${emp ? ` · ${emp}` : ""}`, texto: aplicar(meu, nome, emp, eu), modelo: meu };
    if (natal) return { titulo: `Roteiro de Natal · ${natal.produto}`, texto: aplicar(natal.modelo, nome, emp, eu), modelo: natal.modelo, natal: true };
    const doTime = scriptsTime.find((s) => s.empreendimento === emp && s.script_ligacao);
    if (doTime?.script_ligacao) return { titulo: doTime.titulo, texto: aplicar(doTime.script_ligacao, nome, emp), modelo: doTime.script_ligacao };
    const tpl = templates.find((t) => t.canal === "ligacao");
    if (tpl) return { titulo: tpl.titulo, texto: aplicar(tpl.conteudo, nome, emp), modelo: tpl.conteudo };
    const modelo = `Oi {nome}, ${eu ? `aqui é ${eu}, ` : ""}da Uhome. Tudo bem?\n\n${emp
      ? "Você tinha demonstrado interesse no {empreendimento}. Saíram novidades e condições atualizadas, e lembrei de você."
      : "Estou ligando porque temos empreendimentos com condições especiais que podem fazer sentido para você."}\n\nAinda faz sentido conversar? Posso te mostrar em uma visita rápida: melhor durante a semana ou no sábado?`;
    return { titulo: emp ? `Roteiro · ${emp}` : "Roteiro geral", texto: aplicar(modelo, nome, emp), modelo };
  }, [meu, natal, scriptsTime, templates, emp, nome, eu]);

  const salvar = () => {
    const t = rascunho.trim();
    if (!t) { toast.error("Escreva o roteiro antes de salvar"); return; }
    localStorage.setItem(chave, t); setMeu(t); setEditando(false); toast.success("Seu roteiro foi salvo");
  };
  const restaurar = () => { localStorage.removeItem(chave); setMeu(null); setEditando(false); toast("Roteiro padrão de volta"); };

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Roteiro">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold"><ScrollText className="h-4 w-4 shrink-0 text-primary" aria-hidden /><span className="truncate">{roteiro.titulo}</span>{"natal" in roteiro && roteiro.natal && <span className="natal-chip-ouro shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">🎄 Natal</span>}</h3>
        {!editando && (
          <div className="flex shrink-0 items-center gap-3">
            {meu && <button type="button" onClick={restaurar} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Voltar ao padrão</button>}
            <button type="button" onClick={() => { setRascunho(roteiro.modelo); setEditando(true); }} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" aria-hidden /> Editar</button>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(roteiro.texto); toast.success("Roteiro copiado"); }} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" aria-hidden /> Copiar</button>
          </div>
        )}
      </header>
      {editando ? (
        <div className="flex flex-1 flex-col gap-2">
          <Textarea value={rascunho} onChange={(e) => setRascunho(e.target.value)} className="min-h-[180px] flex-1 text-[15px] leading-relaxed" aria-label="Seu roteiro" autoFocus />
          <p className="text-xs text-muted-foreground">Use {"{nome}"} e {"{empreendimento}"} para preencher sozinho. Fica salvo só para você neste aparelho.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditando(false)} className="gap-1"><X className="h-4 w-4" aria-hidden /> Cancelar</Button>
            <Button size="sm" onClick={salvar} className="gap-1"><Check className="h-4 w-4" aria-hidden /> Salvar roteiro</Button>
          </div>
        </div>
      ) : (
        <p className="max-h-[42vh] min-h-0 flex-1 overflow-y-auto whitespace-pre-line rounded-xl bg-primary/5 p-4 text-[15px] leading-relaxed">{roteiro.texto}</p>
      )}

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Se o cliente disser…</p>
      <div className="flex flex-wrap gap-2">
        {objecoes.map((o, i) => (
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
            {objecoes[aberta]?.resposta}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
