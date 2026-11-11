import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMPREENDIMENTOS, SCRIPTS, FOLLOWUPS } from "./conteudo";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { diasAte18, isCentralNatal } from "../config";
import { MissaoNatalCard } from "../MissaoNatalCard";
import { CorridaNatalEquipe } from "../CorridaNatalEquipe";
import { MissaoNatalEmpresa } from "../MissaoNatalEmpresa";
import { NeveSuave } from "../NeveSuave";
import { podeGerenciar } from "./arquivos";
import { useMateriais, useUrlsAssinadas } from "./useMateriais";
import { AbaEmpreendimentos, AbaFollowups, AbaScripts, AbaVisaoGeral } from "./AbasTexto";
import { AbaDisparos, AbaGrade, AbaInstagram, AbaPdfs } from "./AbasArquivos";
import { AbaColecaoPrime } from "./ColecaoPrime";
import { GerenciarMateriaisSheet } from "./GerenciarMateriaisSheet";
import { MuralVendas } from "../MuralVendas";
import { MinhasPaginasNatal } from "./MinhasPaginasNatal";
import "../natal.css";
import "./central.css";

const ABAS = [
  ["visao", "Visão geral"], ["paginas", "Minhas páginas"], ["mural", "Mural das Vendas"], ["empreendimentos", "Empreendimentos"], ["cards", "Cards"], ["prime", "Coleção Prime"], ["disparos", "Disparos"],
  ["instagram", "Instagram"], ["pdfs", "PDFs"], ["scripts", "Scripts"], ["followups", "Follow-ups"],
] as const;
const GRUPOS: { rotulo: string; abas: string[] }[] = [
  { rotulo: "Comece aqui", abas: ["visao", "mural"] },
  { rotulo: "Para enviar", abas: ["paginas", "empreendimentos", "prime", "cards", "disparos", "instagram", "pdfs"] },
  { rotulo: "Para copiar", abas: ["scripts", "followups"] },
];
type Aba = (typeof ABAS)[number][0];
const CHAVE_ABA = "natal-central-aba";

function abaInicial(): Aba {
  try { const u = new URLSearchParams(window.location.search).get("aba"); if (ABAS.some(([k]) => k === u)) return u as Aba; } catch { /* ok */ }
  try { const v = localStorage.getItem(CHAVE_ABA); if (ABAS.some(([k]) => k === v)) return v as Aba; } catch { /* ok */ }
  return "visao";
}

export default function CampanhaNatalPage() {
  const { user } = useAuth();
  const { roles, isAdmin, isDiretor, isGestor } = useUserRole();
  const [aba, setAbaState] = useState<Aba>(abaInicial);
  const [busca, setBusca] = useState("");
  const { data: materiais = [] } = useMateriais();
  const setAba = (a: Aba) => { setAbaState(a); try { localStorage.setItem(CHAVE_ABA, a); } catch { /* ok */ } };

  const termo = busca.trim().toLowerCase();
  const porSecao = (s: string) => materiais.filter((m) => m.secao === s && (!termo || m.titulo.toLowerCase().includes(termo)));
  const contagem: Record<string, number> = {
    empreendimentos: EMPREENDIMENTOS.length, cards: materiais.filter((m) => m.secao === "cards").length,
    disparos: materiais.filter((m) => m.secao === "disparos").length,
    instagram: materiais.filter((m) => m.secao === "instagram" || m.secao === "molduras").length,
    pdfs: materiais.filter((m) => m.secao === "pdfs").length, prime: materiais.filter((m) => m.secao === "prime").length / 2, scripts: SCRIPTS.length,
    followups: FOLLOWUPS.reduce((n, g) => n + g.mensagens.length, 0),
  };
  const ehCorretor = !(isAdmin || isDiretor || isGestor);
  const porChave = useMemo(() => Object.fromEntries(materiais.map((m) => [m.chave, m])), [materiais]);
  const caminhos = useMemo(() => {
    const secoes: Record<Aba, string[]> = { visao: [], paginas: [], mural: [], empreendimentos: ["fotos"], cards: ["cards"], prime: ["prime"], disparos: ["disparos"], instagram: ["instagram", "molduras"], scripts: [], followups: [], pdfs: [] };
    return materiais.filter((m) => secoes[aba].includes(m.secao)).map((m) => m.arquivo_path);
  }, [materiais, aba]);
  const { data: urls = {} } = useUrlsAssinadas(caminhos);

  if (!isCentralNatal()) {
    return <div className="p-10 text-center text-lg font-semibold">A campanha de Natal terminou em 18/12. Obrigado, time! 🎄</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 md:p-6">
      <header className="natal-noite natal-borda-ouro relative overflow-hidden rounded-2xl">
        <div className="natal-banner-luzes" aria-hidden />
        <NeveSuave />
        <div className="relative px-4 pb-4 pt-9 pr-24 md:px-7 md:pb-6 md:pt-12 md:pr-44">
          <h1 className="text-xl font-extrabold leading-tight md:text-3xl">🎄 Campanha Natal 2026</h1>
          <p className="mt-1 max-w-xl text-xs opacity-80 md:text-sm">Cards, mensagens, follow-ups e regras da campanha. Toque para copiar, baixar ou mandar no WhatsApp.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="natal-chip-ouro inline-block rounded-full px-3 py-1 text-xs font-bold md:text-sm">🎁 Faltam {diasAte18()} dias para 18/12</span>
            {ehCorretor && (
              <Button size="sm" variant="secondary" className="h-8 rounded-full" onClick={() => window.dispatchEvent(new Event("natal:abrir-meta"))}>
                <Target className="mr-1 h-4 w-4" />Minha meta
              </Button>
            )}
          </div>
        </div>
        <img src="/natal/homi_noel.png" alt="Homi de Natal" className="pointer-events-none absolute bottom-0 right-2 h-24 md:right-6 md:h-36" />
      </header>

      {isAdmin || isDiretor ? <MissaoNatalEmpresa recolhivel />
        : isGestor ? <CorridaNatalEquipe gerenteId={user?.id} recolhivel />
        : <MissaoNatalCard userId={user?.id} recolhivel />}

      <div className="natal-abas-barra sticky top-0 z-20 -mx-3 border-b bg-background/95 px-3 py-2 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:bg-card md:p-3">
        <div className="flex flex-col gap-3">
          <div className="natal-chips natal-abas-scroll flex gap-4 overflow-x-auto md:flex-wrap md:gap-x-6 md:gap-y-3 md:overflow-visible" role="tablist">
            {GRUPOS.map((g) => (
              <div key={g.rotulo} className="flex shrink-0 flex-col gap-1">
                <span className="hidden text-[10px] font-bold uppercase tracking-wide text-muted-foreground md:block">{g.rotulo}</span>
                <div className="flex gap-1.5">
                  {g.abas.map((k) => {
                    const r = ABAS.find(([a]) => a === k)![1]; const n = contagem[k];
                    return (
                      <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k as Aba)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${aba === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                        {r}
                        {n ? <span className={`rounded-full px-1.5 text-[11px] font-bold ${aba === k ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>{n}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nesta aba" className="h-9 pl-8" />
            </div>
            {podeGerenciar(roles) && <GerenciarMateriaisSheet />}
          </div>
        </div>
      </div>

      {aba === "visao" && <div className="space-y-6"><MuralVendas limite={4} /><AbaVisaoGeral busca={busca} /></div>}
      {aba === "paginas" && <MinhasPaginasNatal />}
      {aba === "mural" && <MuralVendas />}
      {aba === "empreendimentos" && <AbaEmpreendimentos busca={busca} porChave={porChave} urls={urls} />}
      {aba === "prime" && <AbaColecaoPrime itens={porSecao("prime")} urls={urls} />}
      {aba === "cards" && <AbaGrade itens={porSecao("cards")} urls={urls} />}
      {aba === "disparos" && <AbaDisparos itens={porSecao("disparos")} urls={urls} />}
      {aba === "instagram" && <AbaInstagram itens={porSecao("instagram")} molduras={porSecao("molduras")} urls={urls} />}
      {aba === "scripts" && <AbaScripts busca={busca} />}
      {aba === "followups" && <AbaFollowups busca={busca} />}
      {aba === "pdfs" && <AbaPdfs itens={porSecao("pdfs")} />}
    </div>
  );
}
