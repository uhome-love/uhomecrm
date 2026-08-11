import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import lucasAsset from "@/assets/lucas-fundador.jpg.asset.json";

const META_PIXEL_ID = "1426170849536314";


/**
 * /vaga — Página PÚBLICA (sem login) do anúncio de recrutamento.
 * Quiz conversacional hospedado pelo "Lucas Sarmento — Fundador · Uhome".
 * Grava via edge functions rh-vaga-disponibilidade / rh-vaga-candidato.
 * Camada de apresentação: conversa real (typing, uma mensagem por vez).
 */

const AZUL = "#4969FF";
const AZUL_2 = "#6E86FF";
const BALAO_HOST = "#EEF1FA";
const TXT = "#151B2C";
const TXT_SOFT = "#6A7389";

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
  
];

const TOTAL_PERGUNTAS = PERGUNTAS.length;

const BENEFICIOS = [
  { icone: "💰", t: "R$ 8 a 10 mil de comissão por venda" },
  { icone: "🏆", t: "102 vendas em 2026 — aqui se vende de verdade" },
  { icone: "📈", t: "60 a 80 leads por mês pra você — todo dia tem lead, sem caçar cliente" },
  { icone: "🚀", t: "Método Uhome + CRM próprio com IA, marketing, treinamentos e gerente ao seu lado 100% do tempo" },
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

function iniciais(nome?: string) {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "EU";
  return (partes[0][0] + (partes[1]?.[0] || "")).toUpperCase();
}

type Item =
  | { tipo: "host"; texto: string }
  | { tipo: "eu"; texto: string }
  | { tipo: "card" }
  | { tipo: "sucesso"; quando: string; telefone: string };

type Dock = "nenhum" | "cta" | "pergunta" | "agenda" | "fim";

export default function VagaPage() {
  const [msgs, setMsgs] = useState<Item[]>([]);
  const [fila, setFila] = useState<Item[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [dock, setDock] = useState<Dock>("nenhum");

  const [idx, setIdx] = useState(0);
  const [respondidas, setRespondidas] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [pontos, setPontos] = useState(0);
  const [input, setInput] = useState("");

  const [ocupados, setOcupados] = useState<Set<string>>(new Set());
  const [diaSel, setDiaSel] = useState<Date | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avatarOk, setAvatarOk] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pergunta = PERGUNTAS[idx];
  const pct = Math.round((respondidas / TOTAL_PERGUNTAS) * 100);
  const nomeCurto = respostas.nome?.trim().split(/\s+/)[0] || "";

  // ── SEO ──
  useEffect(() => {
    document.title = "Seja corretor(a) na Uhome — vagas em Porto Alegre";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Trabalhe como corretor(a) na Uhome: 60 a 80 leads por mês, comissões de R$ 8 a 10 mil por venda e método próprio. Candidate-se em 2 minutos.");
  }, []);

  // ── Meta Pixel (base code) — só injeta se ainda não existir ──
  useEffect(() => {
    const w = window as any;
    if (typeof w.fbq === "function") {
      try { w.fbq("track", "PageView"); } catch {}
      return;
    }
    try {
      /* eslint-disable */
      (function (f: any, b: Document, e: string, v: string) {
        let n: any, t: any, s: any;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        t = b.createElement(e) as HTMLScriptElement;
        t.async = true; t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      /* eslint-enable */
      w.fbq("init", META_PIXEL_ID);
      w.fbq("track", "PageView");
    } catch {}
  }, []);


  // ── Motor da conversa: uma mensagem por vez, com "digitando…" ──
  useEffect(() => {
    if (!fila.length || digitando) return;
    const proximo = fila[0];
    if (proximo.tipo === "eu") {
      setMsgs((m) => [...m, proximo]);
      setFila((f) => f.slice(1));
      return;
    }
    const t = setTimeout(() => setDigitando(true), msgs.length ? 250 : 350);
    return () => clearTimeout(t);
  }, [fila, digitando, msgs.length]);

  useEffect(() => {
    if (!digitando) return;
    const t = setTimeout(() => {
      setMsgs((m) => (fila[0] ? [...m, fila[0]] : m));
      setFila((f) => f.slice(1));
      setDigitando(false);
    }, 600);
    return () => clearTimeout(t);
  }, [digitando, fila]);

  const enfileirar = useCallback((itens: Item[]) => setFila((f) => [...f, ...itens]), []);
  const dizerEu = useCallback((texto: string) => setMsgs((m) => [...m, { tipo: "eu", texto }]), []);

  const ocioso = fila.length === 0 && !digitando;

  // ── Abertura ──
  const iniciado = useRef(false);
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    enfileirar([
      { tipo: "host", texto: "Oi! Aqui é o Lucas, fundador da Uhome 👋" },
      { tipo: "host", texto: "A Uhome é uma das imobiliárias que mais cresce em Porto Alegre — foram 102 vendas só em 2026." },
      { tipo: "host", texto: "Antes de te perguntar qualquer coisa, deixa eu ser bem direto sobre por que vale a pena ser corretor(a) aqui:" },
      { tipo: "card" },
      { tipo: "host", texto: "Se você é dedicado e quer construir carreira de verdade, isso aqui pode mudar seu ano." },
    ]);
    setDock("cta");
  }, [enfileirar]);

  // ── Scroll sempre no fim (inclusive quando o dock muda de altura) ──
  const rolar = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => { rolar(); }, [msgs, digitando, dock, diaSel, erro, rolar]);

  useEffect(() => {
    const el = dockRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => rolar());
    ro.observe(el);
    return () => ro.disconnect();
  }, [rolar]);

  useEffect(() => {
    if (dock === "pergunta" && ocioso) inputRef.current?.focus();
  }, [dock, ocioso, idx]);

  // ── Agenda ──
  const carregarAgenda = useCallback(async () => {
    const { data } = await supabase.functions.invoke("rh-vaga-disponibilidade", { body: { dias: 21 } });
    const lista: string[] = (data as any)?.ocupados || [];
    setOcupados(new Set(lista.map((s) => new Date(s).toISOString())));
  }, []);

  const perguntar = (i: number) => {
    setIdx(i);
    enfileirar([{ tipo: "host", texto: PERGUNTAS[i].texto }]);
    setDock("pergunta");
  };

  const comecarQuiz = () => {
    dizerEu("Bora ver se combina 🚀");
    setDock("nenhum");
    perguntar(0);
  };

  const responder = (valor: string, ganhos = 0) => {
    dizerEu(valor);
    setRespostas((r) => ({ ...r, [pergunta.id]: valor }));
    setPontos((p) => p + ganhos);
    setRespondidas((n) => n + 1);
    setInput("");
    setDock("nenhum");
    if (idx + 1 < PERGUNTAS.length) {
      perguntar(idx + 1);
    } else {
      const primeiro = (pergunta.id === "nome" ? valor : respostas.nome || "").trim().split(/\s+/)[0];
      enfileirar([
        { tipo: "host", texto: `Show, ${primeiro}! Bora marcar sua entrevista com o nosso RH.` },
        { tipo: "host", texto: "Escolha o melhor dia e horário 👇" },
      ]);
      setDock("agenda");
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
    const quando = `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    setDock("fim");
    setMsgs((m) => [...m, { tipo: "sucesso", quando, telefone: respostas.telefone || "" }]);
    enfileirar([
      { tipo: "host", texto: "Nosso RH vai te confirmar pelo WhatsApp. Fica de olho nas mensagens!" },
      { tipo: "host", texto: `Até já, ${nomeCurto} 👊` },
    ]);
  };

  const avatarUrl = lucasAsset.url;

  const Avatar = ({ size, ring }: { size: number; ring?: boolean }) =>
    avatarOk ? (
      <img
        src={avatarUrl}
        alt="Lucas Sarmento, fundador da Uhome"
        onError={() => setAvatarOk(false)}
        className={`rounded-full object-cover shrink-0 ${ring ? "border-2 border-white/70" : ""}`}
        style={{ width: size, height: size }}
      />
    ) : (
      <div
        className={`rounded-full shrink-0 flex items-center justify-center font-extrabold text-white ${ring ? "border-2 border-white/70" : ""}`}
        style={{ width: size, height: size, background: AZUL, fontSize: size * 0.45 }}
      >
        L
      </div>
    );

  return (
    <div
      style={{ fontFamily: "'Montserrat', system-ui, sans-serif", background: "#F2F5FC", color: TXT }}
      className="min-h-[100dvh] flex justify-center md:items-center md:py-6"
    >
      <style>{`
        @keyframes vagaIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vagaDot { 0%,60%,100% { transform: translateY(0); opacity:.45 } 30% { transform: translateY(-4px); opacity:1 } }
        @keyframes vagaPulse { 0%,100% { opacity:1; transform: scale(1) } 50% { opacity:.4; transform: scale(.8) } }
        .vaga-in { animation: vagaIn .3s ease-out both; }
        .vaga-dot { animation: vagaDot 1s infinite; }
        .vaga-online { animation: vagaPulse 1.6s ease-in-out infinite; }
        .vaga-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .vaga-scroll::-webkit-scrollbar-thumb { background: #DDE3F2; border-radius: 99px; }
        @media (prefers-reduced-motion: reduce) {
          .vaga-in, .vaga-dot, .vaga-online { animation: none !important; }
        }
      `}</style>

      <div className="w-full md:max-w-[394px] bg-white flex flex-col h-[100dvh] md:h-[86vh] md:rounded-[24px] md:shadow-[0_20px_60px_rgba(21,27,44,0.14)] overflow-hidden">
        {/* ── Cabeçalho ── */}
        <header className="shrink-0" style={{ background: `linear-gradient(135deg, ${AZUL}, ${AZUL_2})` }}>
          <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
            <Avatar size={44} ring />
            <div className="leading-tight min-w-0 flex-1">
              <h1 className="text-white font-bold text-[15px] truncate">Lucas Sarmento</h1>
              <p className="text-white/85 text-[11.5px] flex items-center gap-1.5">
                <span className="vaga-online inline-block h-[7px] w-[7px] rounded-full bg-[#3DDC84]" />
                Fundador · Uhome · online agora
              </p>
            </div>
            <div className="text-right text-white leading-none">
              <div className="text-[22px] font-extrabold">{respondidas}</div>
              <div className="text-[10px] font-semibold opacity-80 mt-0.5">de {TOTAL_PERGUNTAS}</div>
            </div>
          </div>
          <div className="h-[3px] bg-white/25">
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </header>

        {/* ── Chat ── */}
        <div ref={scrollRef} className="vaga-scroll flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {msgs.map((m, i) => {
            if (m.tipo === "card") {
              return (
                <div key={i} className="vaga-in rounded-2xl border border-[#E3E8F5] bg-white p-4 shadow-[0_4px_16px_rgba(21,27,44,0.06)] space-y-3 ml-9">
                  <p className="text-[10.5px] font-extrabold tracking-[0.08em]" style={{ color: AZUL }}>
                    POR QUE SER CORRETOR NA UHOME
                  </p>
                  {BENEFICIOS.map((b) => (
                    <div key={b.t} className="flex gap-3 items-start">
                      <span
                        className="h-7 w-7 shrink-0 rounded-[9px] flex items-center justify-center text-[14px]"
                        style={{ background: "#E7ECFF" }}
                      >
                        {b.icone}
                      </span>
                      <p className="text-[13.5px] font-medium leading-snug" style={{ color: TXT }}>{b.t}</p>
                    </div>
                  ))}
                </div>
              );
            }
            if (m.tipo === "sucesso") {
              return (
                <div key={i} className="vaga-in rounded-2xl border border-[#DDF3E6] bg-white p-5 text-center shadow-[0_4px_16px_rgba(21,27,44,0.06)]">
                  <div className="mx-auto h-12 w-12 rounded-full bg-[#22C55E] flex items-center justify-center text-white text-[24px] font-bold">✓</div>
                  <p className="mt-3 text-[17px] font-extrabold">Entrevista marcada!</p>
                  <p className="mt-2 inline-block rounded-full bg-[#E9F9F0] text-[#137C46] text-[13px] font-bold px-3 py-1.5">
                    📅 {m.quando}
                  </p>
                  <p className="mt-3 text-[12.5px]" style={{ color: TXT_SOFT }}>
                    Nosso RH vai te confirmar pelo WhatsApp {m.telefone}. Até lá!
                  </p>
                  <p className="mt-2 text-[12px]" style={{ color: TXT_SOFT }}>
                    Sua entrevista será por Google Meet — nosso RH te envia o link na confirmação pelo WhatsApp.
                  </p>
                </div>
              );
            }
            const eu = m.tipo === "eu";
            return (
              <div key={i} className={`vaga-in flex items-end gap-2 ${eu ? "justify-end" : "justify-start"}`}>
                {!eu && <Avatar size={28} />}
                <div
                  className="max-w-[80%] px-3.5 py-2.5 text-[14.5px] leading-snug"
                  style={
                    eu
                      ? { background: AZUL, color: "#fff", borderRadius: 16, borderBottomRightRadius: 5 }
                      : { background: BALAO_HOST, color: TXT, borderRadius: 16, borderBottomLeftRadius: 5 }
                  }
                >
                  {m.texto}
                </div>
                {eu && (
                  <div className="h-7 w-7 shrink-0 rounded-full bg-[#DDE4FB] flex items-center justify-center text-[10px] font-extrabold" style={{ color: AZUL }}>
                    {iniciais(respostas.nome)}
                  </div>
                )}
              </div>
            );
          })}

          {digitando && (
            <div className="vaga-in flex items-end gap-2">
              <Avatar size={28} />
              <div className="px-4 py-3 flex gap-1" style={{ background: BALAO_HOST, borderRadius: 16, borderBottomLeftRadius: 5 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="vaga-dot h-1.5 w-1.5 rounded-full"
                    style={{ background: "#9AA4BF", animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Dock ── */}
        <div ref={dockRef} className="shrink-0 border-t border-[#E7EBF5] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!ocioso && <div className="h-[46px]" />}

          {ocioso && dock === "cta" && (
            <button
              onClick={comecarQuiz}
              className="w-full rounded-xl py-3.5 text-white font-bold text-[15px] active:scale-[0.99] transition"
              style={{ background: AZUL }}
            >
              Bora ver se combina 🚀
            </button>
          )}

          {ocioso && dock === "pergunta" && pergunta && (
            pergunta.tipo === "opcoes" ? (
              <div className="space-y-2 max-h-[38vh] overflow-y-auto vaga-scroll">
                {pergunta.opcoes.map((o) => (
                  <button
                    key={o.label}
                    onClick={() => responder(o.label, o.pontos)}
                    className="w-full text-left rounded-xl bg-white px-4 py-3 text-[14px] font-semibold transition-all hover:-translate-y-[1px] hover:bg-[#F3F6FF] hover:border-[#4969FF]"
                    style={{ border: "1.5px solid #D9E0F3", color: TXT, borderRadius: 12 }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = input.trim();
                  if (pergunta.tipo === "telefone" && v.replace(/\D/g, "").length < 10) return;
                  if (v.length < 2) return;
                  responder(pergunta.tipo === "telefone" ? `+55 ${v}` : v);
                }}
              >
                <div className="flex-1 flex items-center gap-2 rounded-full border border-[#D9E0F3] px-2 py-1.5 focus-within:border-[#4969FF] transition">
                  {pergunta.tipo === "telefone" && (
                    <>
                      <span className="h-7 w-7 rounded-lg bg-[#25D366] flex items-center justify-center text-white text-[13px]">✆</span>
                      <span className="text-[13.5px] font-bold" style={{ color: TXT_SOFT }}>+55</span>
                    </>
                  )}
                  <input
                    ref={inputRef}
                    value={input}
                    inputMode={pergunta.tipo === "telefone" ? "tel" : "text"}
                    onChange={(e) => setInput(pergunta.tipo === "telefone" ? maskTelefone(e.target.value) : e.target.value)}
                    placeholder={pergunta.placeholder}
                    className="flex-1 min-w-0 bg-transparent px-1.5 py-1.5 text-[14px] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  aria-label="Enviar resposta"
                  className="h-10 w-10 shrink-0 rounded-full text-white font-bold flex items-center justify-center active:scale-95 transition"
                  style={{ background: AZUL }}
                >
                  →
                </button>
              </form>
            )
          )}

          {ocioso && dock === "agenda" && (
            <div className="space-y-3 max-h-[46vh] overflow-y-auto vaga-scroll">
              <div>
                <p className="text-[10.5px] font-extrabold tracking-[0.08em] mb-1.5" style={{ color: TXT_SOFT }}>ESCOLHA O DIA</p>
                <div className="flex gap-2 overflow-x-auto pb-1 vaga-scroll">
                  {dias.map((d) => {
                    const ativo = !!diaSel && d.toDateString() === diaSel.toDateString();
                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => { setDiaSel(d); setErro(null); }}
                        className="min-w-[64px] rounded-xl px-2 py-2 text-center transition"
                        style={{
                          border: `1.5px solid ${ativo ? AZUL : "#D9E0F3"}`,
                          background: ativo ? AZUL : "#fff",
                          color: ativo ? "#fff" : TXT,
                        }}
                      >
                        <div className="text-[10px] font-bold opacity-80">{DIAS_SEMANA[d.getDay()].slice(0, 3).toUpperCase()}</div>
                        <div className="text-[17px] font-extrabold leading-tight">{d.getDate()}</div>
                        <div className="text-[10px] opacity-80">{MESES[d.getMonth()]}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {diaSel && (
                <div>
                  <p className="text-[10.5px] font-extrabold tracking-[0.08em] mb-1.5" style={{ color: TXT_SOFT }}>
                    HORÁRIO · 30 MIN (ALMOÇO 12H–13H)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {horariosLivres.map(({ h, d }) => (
                      <button
                        key={h}
                        disabled={enviando}
                        onClick={() => agendar(d)}
                        className="rounded-xl py-2.5 text-[13px] font-bold transition hover:bg-[#F3F6FF] hover:border-[#4969FF] disabled:opacity-50"
                        style={{ border: "1.5px solid #D9E0F3", color: TXT }}
                      >
                        {h}
                      </button>
                    ))}
                    {horariosLivres.length === 0 && (
                      <p className="col-span-4 text-[12.5px] py-1" style={{ color: TXT_SOFT }}>
                        Nenhum horário livre nesse dia. Escolha outro dia.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {erro && <p className="text-[12.5px] text-[#D14343] font-semibold">{erro}</p>}
              {enviando && <p className="text-[12.5px]" style={{ color: TXT_SOFT }}>Confirmando…</p>}
            </div>
          )}

          {ocioso && (dock === "nenhum" || dock === "fim") && (
            <p className="text-center text-[11.5px]" style={{ color: TXT_SOFT }}>
              {dock === "fim" ? "Conversa finalizada · Uhome" : "\u00A0"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
