import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
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
import { GerenciarMateriaisSheet } from "./GerenciarMateriaisSheet";
import "../natal.css";
import "./central.css";

const ABAS = [
  ["visao", "Visão geral"], ["empreendimentos", "Empreendimentos"], ["cards", "Cards"], ["disparos", "Disparos"],
  ["instagram", "Instagram"], ["scripts", "Scripts"], ["followups", "Follow-ups"], ["pdfs", "PDFs"],
] as const;
type Aba = (typeof ABAS)[number][0];
const CHAVE_ABA = "natal-central-aba";

function abaInicial(): Aba {
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

  const porSecao = (s: string) => materiais.filter((m) => m.secao === s);
  const porChave = useMemo(() => Object.fromEntries(materiais.map((m) => [m.chave, m])), [materiais]);
  const caminhos = useMemo(() => {
    const secoes: Record<Aba, string[]> = { visao: [], empreendimentos: ["fotos"], cards: ["cards"], disparos: ["disparos"], instagram: ["instagram", "molduras"], scripts: [], followups: [], pdfs: [] };
    return materiais.filter((m) => secoes[aba].includes(m.secao)).map((m) => m.arquivo_path);
  }, [materiais, aba]);
  const { data: urls = {} } = useUrlsAssinadas(caminhos);

  if (!isCentralNatal()) {
    return <div className="p-10 text-center text-lg font-semibold">A campanha de Natal terminou em 18/12. Obrigado, time! 🎄</div>;
  }

  const buscaVisivel = aba === "empreendimentos" || aba === "scripts" || aba === "followups";

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-3 md:p-6">
      <header className="natal-noite natal-borda-ouro relative overflow-hidden rounded-2xl p-4 md:p-6">
        <img src="/natal/luzes_varal_1600.svg" alt="" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-5 w-full object-cover" />
        <NeveSuave />
        <div className="relative pr-20 md:pr-36">
          <h1 className="mt-2 text-xl font-extrabold md:text-3xl">🎄 Campanha Natal 2026</h1>
          <p className="mt-1 hidden max-w-xl text-sm opacity-80 md:block">Cards, mensagens, follow-ups e regras da campanha. Toque para copiar, baixar ou mandar no WhatsApp.</p>
          <span className="natal-chip-ouro mt-3 inline-block rounded-full px-3 py-1 text-sm font-bold">🎁 Faltam {diasAte18()} dias para 18/12</span>
        </div>
        <img src="/natal/homi_noel.png" alt="Homi de Natal" className="absolute bottom-0 right-3 h-20 md:h-32" />
      </header>

      {isAdmin || isDiretor ? <MissaoNatalEmpresa recolhivel />
        : isGestor ? <CorridaNatalEquipe gerenteId={user?.id} recolhivel />
        : <MissaoNatalCard userId={user?.id} recolhivel />}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="natal-chips -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:px-0" role="tablist">
          {ABAS.map(([k, r]) => (
            <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${aba === k ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{r}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {buscaVisivel && (
            <div className="relative flex-1 md:w-60">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="pl-8" />
            </div>
          )}
          {podeGerenciar(roles) && <GerenciarMateriaisSheet />}
        </div>
      </div>

      {aba === "visao" && <AbaVisaoGeral />}
      {aba === "empreendimentos" && <AbaEmpreendimentos busca={busca} porChave={porChave} urls={urls} />}
      {aba === "cards" && <AbaGrade itens={porSecao("cards")} urls={urls} />}
      {aba === "disparos" && <AbaDisparos itens={porSecao("disparos")} urls={urls} />}
      {aba === "instagram" && <AbaInstagram itens={porSecao("instagram")} molduras={porSecao("molduras")} urls={urls} />}
      {aba === "scripts" && <AbaScripts busca={busca} />}
      {aba === "followups" && <AbaFollowups busca={busca} />}
      {aba === "pdfs" && <AbaPdfs itens={porSecao("pdfs")} />}
    </div>
  );
}
