import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * /vaga — Página PÚBLICA (sem login) do anúncio de recrutamento.
 * Quiz conversacional hospedado pelo "Lucas Sarmento — Fundador · Uhome".
 * Grava via edge functions rh-vaga-disponibilidade / rh-vaga-candidato.
 */

const AZUL = "#4969FF";
const HORARIOS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Opcao = { label: string; pontos: number };
type Pergunta =
  | { id: string; tipo: "texto" | "telefone"; texto: string; placeholder: string }
  | { id: string; tipo: "opcoes"; texto: string; opcoes: Opcao[] };

const PERGUNTAS: Pergunta[] = [
  { id: "nome", tipo: "texto", texto: "Pra começar, como é o seu nome?", placeholder: "Seu nome completo" },
  { id: "telefone", tipo: "telefone", texto: "Qual o seu WhatsApp?", placeholder: "(51) 99999-9999" },
  {
    id: "vendas", tipo: "opcoes", texto: "Você já trabalhou com vendas?",
    opcoes: [
      { label: "Nunca, mas quero aprender", pontos: 0 },
      { label: "Menos de 1 ano", pontos: 1 },
      { label: "De 1 a 3 anos", pontos: 2 },
      { label: "Mais de 3 anos", pontos: 3 },
    ],
  },
  {
    id: "imobiliario", tipo: "opcoes", texto: "E com o mercado imobiliário?",
    opcoes: [
      { label: "Já sou corretor(a), CRECI ativo", pontos: 3 },
      { label: "Tenho experiência, sem CRECI", pontos: 2 },
      { label: "Nunca atuei, mas tenho interesse", pontos: 1 },
    ],
  },
  {
    id: "disponibilidade", tipo: "opcoes", texto: "Qual sua disponibilidade?",
    opcoes: [
      { label: "Período integral", pontos: 2 },
      { label: "Meio período", pontos: 1 },
      { label: "Só fins de semana", pontos: 1 },
    ],
  },
  {
    id: "regiao", tipo: "opcoes", texto: "Você mora em Porto Alegre ou região?",
    opcoes: [
      { label: "Sim, em Porto Alegre", pontos: 2 },
      { label: "Região metropolitana", pontos: 1 },
      { label: "Fora, mas posso me deslocar", pontos: 0 },
    ],
  },
  { id: "motivacao", tipo: "texto", texto: "Em uma frase, por que você quer ser corretor(a) na Uhome?", placeholder: "Escreva com suas palavras" },
];

function maskTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Constrói o Date do slot em BRT (offset fixo -03:00). */
function slotDate(dia: Date, hhmm: string) {
  const y = dia.getFullYear();
  const m = String(dia.getMonth() + 1).padStart(2, "0");
  const d = String(dia.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${hhmm}:00.000-03:00`);
}

function proximosDiasUteis(qtd: number) {
  const dias: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (dias.length < qtd) {
    const wd = cursor.getDay();
    if (wd >= 1 && wd <= 5) dias.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

type Bolha = { de: "host" | "eu"; texto: string };

export default function VagaPage() {
  const [fase, setFase] = useState<"intro" | "quiz" | "agenda" | "fim">("intro");
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [pontos, setPontos] = useState(0);
  const [historico, setHistorico] = useState<Bolha[]>([]);
  const [input, setInput] = useState("");
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());
  const [diaSel, setDiaSel] = useState<Date | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const pergunta = PERGUNTAS[idx];
  const progresso = fase === "intro" ? 0 : fase === "fim" ? 100 : Math.round(((idx + (fase === "agenda" ? 1 : 0)) / (PERGUNTAS.length + 1)) * 100);

  useEffect(() => {
    document.title = "Seja corretor(a) na Uhome — vagas em Porto Alegre";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Trabalhe como corretor(a) na Uhome: 60 a 80 leads por mês, comissões de R$ 8 a 10 mil por venda e método próprio. Candidate-se em 2 minutos.");
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [historico, fase, idx, diaSel]);

  const carregarAgenda = async () => {
    const { data } = await supabase.functions.invoke("rh-vaga-disponibilidade", { body: { dias: 21 } });
    const lista: string[] = (data as any)?.ocupados || [];
    setOcupados(new Set(lista.map((s) => new Date(s).toISOString())));
  };

  const responder = (valor: string, ganhos = 0) => {
    setHistorico((h) => [...h, { de: "host", texto: pergunta.texto }, { de: "eu", texto: valor }]);
    setRespostas((r) => ({ ...r, [pergunta.id]: valor }));
    setPontos((p) => p + ganhos);
    setInput("");
    if (idx + 1 < PERGUNTAS.length) {
      setIdx(idx + 1);
    } else {
      setFase("agenda");
      carregarAgenda();
    }
  };

  const temperatura = useMemo(() => (pontos >= 8 ? "quente" : pontos >= 4 ? "morno" : "frio"), [pontos]);

  const dias = useMemo(() => proximosDiasUteis(10), []);
  const horariosLivres = useMemo(() => {
    if (!diaSel) return [];
    const agora = Date.now();
    return HORARIOS.map((h) => ({ h, d: slotDate(diaSel, h) }))
      .filter(({ d }) => d.getTime() > agora + 5 * 60 * 1000 && !ocupados.has(d.toISOString()));
  }, [diaSel, ocupados]);

  const agendar = async (d: Date) => {
    setEnviando(true);
    setErro(null);
    const { data, error } = await supabase.functions.invoke("rh-vaga-candidato", {
      body: {
        nome: respostas.nome,
        telefone: respostas.telefone,
        respostas,
        temperatura,
        horario: d.toISOString(),
      },
    });
    setEnviando(false);
    const res = data as any;
    if (error || !res?.ok) {
      if (res?.error === "slot_ocupado") {
        setErro(res.message || "Esse horário acabou de ser preenchido. Escolha outro.");
        carregarAgenda();
        return;
      }
      setErro(res?.message || res?.error || "Não foi possível concluir. Tente novamente.");
      return;
    }
    setConfirmado(`${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setFase("fim");
  };

  return (
    <div style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }} className="min-h-screen bg-[#F6F8FC] flex justify-center">
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="w-full max-w-[520px] bg-white min-h-screen flex flex-col shadow-sm">
        {/* Cabeçalho */}
        <header className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3" style={{ background: AZUL }}>
          <div className="h-11 w-11 rounded-full bg-white/20 border-2 border-white/70 flex items-center justify-center text-white font-extrabold text-lg">
            L
          </div>
          <div className="leading-tight">
            <h1 className="text-white font-bold text-[15px]">Lucas Sarmento</h1>
            <p className="text-white/80 text-[12px]">Fundador · Uhome</p>
          </div>
        </header>

        {/* Progresso */}
        <div className="h-1 bg-[#E7EBF5]">
          <div className="h-full transition-all duration-500" style={{ width: `${progresso}%`, background: AZUL }} />
        </div>

        <main className="flex-1 px-4 py-5 space-y-3">
          {fase === "intro" && (
            <div className="space-y-3">
              {[
                "Oi! Aqui é o Lucas, fundador da Uhome 👋",
                "A Uhome é uma das imobiliárias que mais cresce em Porto Alegre — foram 102 vendas só em 2026.",
                "Antes de te perguntar qualquer coisa, deixa eu ser bem direto sobre por que vale a pena ser corretor(a) aqui:",
              ].map((t, i) => (
                <Balao key={i} de="host">{t}</Balao>
              ))}

              <div className="rounded-2xl border border-[#E3E8F5] bg-white p-4 space-y-3 shadow-sm">
                {[
                  { icone: "💰", t: "R$ 8 a 10 mil de comissão por venda" },
                  { icone: "🏆", t: "102 vendas em 2026 — aqui se vende de verdade" },
                  { icone: "📈", t: "60 a 80 leads por mês pra você — todo dia tem lead, sem caçar cliente" },
                  { icone: "🚀", t: "Método Uhome + CRM próprio com IA, marketing, treinamentos e gerente ao seu lado 100% do tempo" },
                ].map((b) => (
                  <div key={b.t} className="flex gap-3 items-start">
                    <span className="text-xl leading-none">{b.icone}</span>
                    <p className="text-[14px] text-[#1A2340] font-medium leading-snug">{b.t}</p>
                  </div>
                ))}
              </div>

              <Balao de="host">Se você é dedicado e quer construir carreira de verdade, isso aqui pode mudar seu ano.</Balao>

              <button
                onClick={() => setFase("quiz")}
                className="w-full rounded-xl py-4 text-white font-bold text-[15px] active:scale-[0.99] transition"
                style={{ background: AZUL }}
              >
                Bora ver se combina 🚀
              </button>
            </div>
          )}

          {fase !== "intro" && (
            <div className="space-y-3">
              {historico.map((b, i) => (
                <Balao key={i} de={b.de}>{b.texto}</Balao>
              ))}
            </div>
          )}

          {fase === "quiz" && pergunta && (
            <div className="space-y-3">
              <Balao de="host">{pergunta.texto}</Balao>

              {pergunta.tipo === "opcoes" ? (
                <div className="space-y-2">
                  {pergunta.opcoes.map((o) => (
                    <button
                      key={o.label}
                      onClick={() => responder(o.label, o.pontos)}
                      className="w-full text-left rounded-xl border border-[#D9E0F3] bg-white px-4 py-3 text-[14px] font-medium text-[#1A2340] hover:border-[#4969FF] hover:bg-[#F3F6FF] transition"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = input.trim();
                    if (pergunta.tipo === "telefone" && v.replace(/\D/g, "").length < 10) return;
                    if (v.length < 2) return;
                    responder(pergunta.tipo === "telefone" ? `+55 ${v}` : v);
                  }}
                >
                  <input
                    autoFocus
                    value={input}
                    inputMode={pergunta.tipo === "telefone" ? "tel" : "text"}
                    onChange={(e) => setInput(pergunta.tipo === "telefone" ? maskTelefone(e.target.value) : e.target.value)}
                    placeholder={pergunta.placeholder}
                    className="flex-1 rounded-xl border border-[#D9E0F3] px-4 py-3 text-[14px] outline-none focus:border-[#4969FF]"
                  />
                  <button type="submit" className="rounded-xl px-4 text-white font-bold" style={{ background: AZUL }}>
                    →
                  </button>
                </form>
              )}
            </div>
          )}

          {fase === "agenda" && (
            <div className="space-y-3">
              <Balao de="host">Show, {respostas.nome?.split(" ")[0]}! Bora marcar sua entrevista com o nosso RH.</Balao>
              <Balao de="host">Escolha o melhor dia e horário 👇</Balao>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {dias.map((d) => {
                  const ativo = diaSel && d.toDateString() === diaSel.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setDiaSel(d)}
                      className="min-w-[72px] rounded-xl border px-2 py-2 text-center transition"
                      style={{
                        borderColor: ativo ? AZUL : "#D9E0F3",
                        background: ativo ? AZUL : "#fff",
                        color: ativo ? "#fff" : "#1A2340",
                      }}
                    >
                      <div className="text-[11px] font-semibold opacity-80">{DIAS_SEMANA[d.getDay()].slice(0, 3)}</div>
                      <div className="text-[16px] font-extrabold leading-tight">{d.getDate()}</div>
                      <div className="text-[11px] opacity-80">{MESES[d.getMonth()]}</div>
                    </button>
                  );
                })}
              </div>

              {diaSel && (
                <div className="grid grid-cols-3 gap-2">
                  {horariosLivres.map(({ h, d }) => (
                    <button
                      key={h}
                      disabled={enviando}
                      onClick={() => agendar(d)}
                      className="rounded-xl border border-[#D9E0F3] py-3 text-[14px] font-semibold text-[#1A2340] hover:border-[#4969FF] hover:bg-[#F3F6FF] transition disabled:opacity-50"
                    >
                      {h}
                    </button>
                  ))}
                  {horariosLivres.length === 0 && (
                    <p className="col-span-3 text-[13px] text-[#6B7590] py-2">
                      Nenhum horário livre nesse dia. Escolha outro dia.
                    </p>
                  )}
                </div>
              )}

              {erro && <p className="text-[13px] text-red-600 font-medium">{erro}</p>}
              {enviando && <p className="text-[13px] text-[#6B7590]">Confirmando…</p>}
            </div>
          )}

          {fase === "fim" && (
            <div className="space-y-3">
              <div className="rounded-2xl p-5 text-white" style={{ background: AZUL }}>
                <p className="text-[20px] font-extrabold">Entrevista marcada! 🎉</p>
                <p className="text-[15px] font-semibold mt-1">{confirmado}</p>
              </div>
              <Balao de="host">Nosso RH vai te confirmar pelo WhatsApp. Fica de olho nas mensagens!</Balao>
              <Balao de="host">Até já, {respostas.nome?.split(" ")[0]} 👊</Balao>
            </div>
          )}

          <div ref={fimRef} />
        </main>
      </div>
    </div>
  );
}

function Balao({ de, children }: { de: "host" | "eu"; children: React.ReactNode }) {
  const eu = de === "eu";
  return (
    <div className={`flex ${eu ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-snug"
        style={
          eu
            ? { background: AZUL, color: "#fff", borderBottomRightRadius: 6 }
            : { background: "#F1F3F9", color: "#1A2340", borderBottomLeftRadius: 6 }
        }
      >
        {children}
      </div>
    </div>
  );
}
