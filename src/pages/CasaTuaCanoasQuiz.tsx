/**
 * CasaTuaCanoasQuiz — Funil conversacional público do empreendimento
 * Casa Tua Santos Ferreira (Canoas). Rota pública: /casatuacanoas-quiz
 *
 * v5 — "descobre o motivo → encanta → preço de apê, casa de brinde → libera o
 * material NA TELA". A conversa começa direto (sem botão de pedágio). Q1 descobre
 * o motivo do clique; cada resposta revela foto/planta/valor reais; o contato
 * destrava o material (fotos + plantas + valores + guia) ali mesmo. Fecha em
 * visita OU "especialista me chama". Lead cai SEM DONO na Fila CEO via
 * receive-quiz-lead. Pixel dedicado dispara eventos CUSTOM — nunca o "Lead" padrão.
 *
 * Visual congelado a partir do mockup validado com o Lucas. NÃO redesenhar.
 */
import { useEffect, useRef } from "react";
import { EDGE_BASE_URL } from "@/lib/edgeBaseUrl";
import { captureFbclid, getMetaContext } from "@/lib/metaTracking";

const META_PIXEL_ID = "918505654064602"; // dataset dedicado "Uhome Empreendimentos - Quiz"
const EDGE_URL = `${EDGE_BASE_URL}/functions/v1/receive-quiz-lead`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const CSS = `
#ct-root{--brand:#4969FF;--brand-ink:#3348C7;--brand-soft:#EEF1FF;--terra:#9A6A4B;--terra-soft:#F5ECE3;--terra-ink:#6E4A31;--gold:#C79A5B;--ink:#161C2E;--muted:#6B7390;--line:#E4E7F2;--screen:#F6F7FC;--card:#FFFFFF;--hot:#15A34A;--hot-soft:#E7F6ED;--warm:#D9822B;--warm-soft:#FCF1E3;--cold:#8A90A6;--cold-soft:#EEF0F6;--font:"Montserrat",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  position:fixed; inset:0; display:flex; justify-content:center; background:radial-gradient(1200px 600px at 50% -10%, #EDEFFB 0%, rgba(237,239,251,0) 60%), #E9EBF4; font-family:var(--font); color:var(--ink);}
#ct-root *{box-sizing:border-box; margin:0}
#ct-root .screen{width:100%; max-width:440px; height:100%; background:var(--screen); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 0 60px rgba(28,38,90,.12)}
#ct-root .bar{background:var(--card); padding:calc(10px + env(safe-area-inset-top)) 18px 12px; display:flex; align-items:center; gap:11px; border-bottom:1px solid var(--line); z-index:3; flex:none}
#ct-root .avatar{width:44px; height:44px; border-radius:50%; flex:none; overflow:hidden; box-shadow:0 4px 10px rgba(73,105,255,.35)}
#ct-root .avatar img{width:100%; height:100%; object-fit:cover; display:block}
#ct-root .who{display:flex; flex-direction:column; line-height:1.25}
#ct-root .who b{font-size:14.5px; font-weight:800}
#ct-root .who span{font-size:12px; color:var(--muted)}
#ct-root .who .on{display:inline-flex; align-items:center; gap:5px}
#ct-root .dot{width:7px; height:7px; border-radius:50%; background:var(--hot)}
#ct-root .reward{display:flex; align-items:center; gap:9px; padding:9px 16px; background:linear-gradient(90deg,#FBF6F0,#F5ECE3); border-bottom:1px solid #EADFD2; z-index:2; flex:none}
#ct-root .reward .gift{font-size:15px}
#ct-root .reward b{font-size:12.5px; color:var(--terra-ink); font-weight:800}
#ct-root .reward .pips{display:flex; gap:4px; margin-left:auto}
#ct-root .reward .pip{width:20px; height:6px; border-radius:3px; background:#E4D5C4; transition:.3s}
#ct-root .reward .pip.on{background:linear-gradient(90deg,var(--gold),var(--terra)); box-shadow:0 0 6px rgba(199,154,91,.5)}
#ct-root .reward .pc{font-size:11px; font-weight:800; color:var(--terra-ink); min-width:26px; text-align:right}
#ct-root .body{flex:1 1 auto; min-height:0; overflow-y:auto; padding:18px 16px 14px; display:flex; flex-direction:column; gap:12px; scroll-behavior:smooth}
#ct-root .body::-webkit-scrollbar{width:0}
#ct-root .row{display:flex; animation:ctrise .32s ease both}
#ct-root .row.me{justify-content:flex-end}
@keyframes ctrise{from{opacity:0; transform:translateY(8px)}to{opacity:1; transform:none}}
#ct-root .bubble{max-width:82%; padding:12px 14px; border-radius:16px; font-size:14.5px; line-height:1.5; background:var(--card); border:1px solid var(--line); border-bottom-left-radius:5px; box-shadow:0 1px 2px rgba(20,28,46,.04)}
#ct-root .bubble.me{background:var(--brand); color:#fff; border:none; border-radius:16px; border-bottom-right-radius:5px}
#ct-root .bubble strong{font-weight:800}
#ct-root .bubble .lead{font-size:16px; font-weight:800; line-height:1.35; margin-bottom:6px; text-wrap:balance}
#ct-root .unlock{max-width:90%; border:1.5px solid #EAD9C4; background:linear-gradient(180deg,#FFFDFB,#FBF5EE); box-shadow:0 6px 18px rgba(154,106,75,.14); animation:ctpop .4s cubic-bezier(.2,1.3,.5,1) both}
@keyframes ctpop{from{opacity:0; transform:scale(.92)}to{opacity:1; transform:none}}
#ct-root .uchip{display:inline-flex; align-items:center; gap:5px; background:var(--terra); color:#fff; font-size:10.5px; font-weight:800; letter-spacing:.06em; padding:4px 9px; border-radius:999px; text-transform:uppercase; margin-bottom:9px}
#ct-root .uphoto{width:100%; height:146px; object-fit:cover; border-radius:11px; margin-bottom:10px; display:block; background:#E6E2DC}
#ct-root .uphoto.tall{height:300px; object-fit:contain; background:#FFFFFF; padding:4px}
#ct-root .utitle{font-weight:800; font-size:14.5px; margin-bottom:4px}
#ct-root .ulist{font-size:13px; line-height:1.55; color:#3A3324}
#ct-root .ulist b{color:var(--ink)}
#ct-root .bomb{color:var(--terra-ink); font-weight:800; font-size:14px; display:block; margin-top:6px}
#ct-root .gal{display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:8px 0}
#ct-root .gal img{width:100%; height:88px; object-fit:cover; border-radius:9px; display:block; background:#E6E2DC}
#ct-root .cond{margin-top:8px; background:#fff; border:1px solid #EADFD2; border-radius:10px; padding:9px 11px; font-size:12.5px; line-height:1.7}
#ct-root .cond .cr{display:flex; justify-content:space-between; gap:10px}
#ct-root .cond .cr b{color:var(--terra-ink)}
#ct-root .dock{background:var(--card); border-top:1px solid var(--line); padding:13px 14px calc(13px + env(safe-area-inset-bottom)); z-index:3; flex:none}
#ct-root .opts{display:flex; flex-direction:column; gap:9px}
#ct-root .opt{width:100%; text-align:left; border:1.5px solid var(--line); background:#fff; color:var(--ink); padding:12px 15px; border-radius:14px; font:inherit; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:11px; transition:.16s; line-height:1.35}
#ct-root .opt:hover{border-color:var(--brand); background:var(--brand-soft); transform:translateY(-1px)}
#ct-root .opt .lead-ic{font-size:17px; flex:none}
#ct-root .grid2{display:grid; grid-template-columns:1fr 1fr; gap:9px}
#ct-root .grid2 .opt{justify-content:center; text-align:center; padding:12px 8px}
#ct-root .field{display:flex; gap:9px}
#ct-root .field input{flex:1; border:1.5px solid var(--line); border-radius:14px; padding:13px 15px; font:inherit; font-size:15px; color:var(--ink); background:#fff}
#ct-root .field input:focus{outline:none; border-color:var(--brand); box-shadow:0 0 0 3px var(--brand-soft)}
#ct-root .send{flex:none; border:none; background:var(--brand); color:#fff; width:50px; border-radius:14px; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; transition:.16s}
#ct-root .send:hover{background:var(--brand-ink)}
#ct-root .cta{width:100%; border:none; background:var(--brand); color:#fff; padding:14px; border-radius:15px; font:inherit; font-size:15px; font-weight:800; cursor:pointer; box-shadow:0 8px 20px rgba(73,105,255,.32); transition:.16s; display:flex; align-items:center; justify-content:center; gap:8px}
#ct-root .cta:hover{background:var(--brand-ink); transform:translateY(-1px)}
#ct-root .cta.gold{background:linear-gradient(120deg,var(--gold),var(--terra)); box-shadow:0 8px 20px rgba(154,106,75,.32)}
#ct-root .cta.alt{background:#fff; color:var(--brand); border:1.5px solid #C9D2FF; box-shadow:none; margin-top:9px}
#ct-root .cta.alt:hover{background:var(--brand-soft)}
#ct-root .hint{text-align:center; font-size:11px; color:var(--muted); margin-top:9px; display:flex; align-items:center; justify-content:center; gap:5px}
#ct-root .typing{display:flex; gap:4px; padding:14px 16px}
#ct-root .typing i{width:7px; height:7px; border-radius:50%; background:#C3C8DD; animation:ctblink 1s infinite}
#ct-root .typing i:nth-child(2){animation-delay:.15s}#ct-root .typing i:nth-child(3){animation-delay:.3s}
@keyframes ctblink{0%,60%,100%{opacity:.3}30%{opacity:1}}
#ct-root .dl{display:flex; align-items:center; justify-content:center; gap:8px; margin-top:12px; text-decoration:none; background:linear-gradient(120deg,var(--gold),var(--terra)); color:#fff; font-weight:800; font-size:14px; padding:13px; border-radius:13px; box-shadow:0 8px 20px rgba(154,106,75,.32); transition:.16s}
#ct-root .dl:hover{filter:brightness(1.05); transform:translateY(-1px)}
#ct-root .final{text-align:center; padding:4px}
#ct-root .final h3{margin:6px 0 6px; font-size:18px; font-weight:800}
#ct-root .final p{margin:0 auto; color:var(--muted); font-size:13.5px; max-width:280px; line-height:1.5}
#ct-root .appt{margin:14px 0 2px; background:var(--brand-soft); border-radius:16px; padding:14px 16px; text-align:left; display:flex; gap:12px; align-items:center}
#ct-root .appt .cal{flex:none; width:46px; height:46px; border-radius:12px; background:#fff; color:var(--brand); display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:800; line-height:1; box-shadow:0 3px 8px rgba(73,105,255,.2)}
#ct-root .appt .cal small{font-size:9px; text-transform:uppercase; letter-spacing:.06em}
#ct-root .appt .cal b{font-size:20px}
#ct-root .appt .info b{font-size:14px; font-weight:800}
#ct-root .appt .info span{display:block; font-size:12px; color:var(--muted); margin-top:2px}
`;

export default function CasaTuaCanoasQuiz() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    document.title = "Casa Tua Santos Ferreira — Canoas | Uhome";
    captureFbclid();

    // ── Meta Pixel DEDICADO do quiz — sempre trackSingle/trackSingleCustom ──
    const w = window as any;
    try {
      if (typeof w.fbq !== "function") {
        /* eslint-disable */
        (function (f: any, b: any, e: string, v: string, n?: any, t?: any, s?: any) {
          if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
          if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
          t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
        })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
        /* eslint-enable */
      }
      w.fbq("init", META_PIXEL_ID);
      w.fbq("trackSingle", META_PIXEL_ID, "PageView");
    } catch { /* noop */ }

    const fbqCustom = (event: string, params?: Record<string, unknown>) => {
      try { if (typeof w.fbq === "function") w.fbq("trackSingleCustom", META_PIXEL_ID, event, params || {}); } catch { /* noop */ }
    };

    const IMG: Record<string, string> = {
      casa: "/casatua/casa.jpg",
      club: "/casatua/club.jpg",
      loc: "/casatua/loc.jpg",
      invest: "/casatua/invest.jpg",
      planta3: "/casatua/planta3.jpg",
      planta4: "/casatua/planta4.jpg",
    };
    const GUIA = "/casatua/guia-casa-tua-santos-ferreira.pdf";

    const body = document.getElementById("ct-body")!;
    const dock = document.getElementById("ct-dock")!;
    const pips = Array.from(document.querySelectorAll("#ct-reward .pip"));
    const pc = document.getElementById("ct-pc")!;

    const A: Record<string, string> = {};
    let score = 0;
    let unlocked = 0;

    const scroll = () => requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    const photo = (k: string, tall = false) => (IMG[k] ? `<img class="uphoto${tall ? " tall" : ""}" src="${IMG[k]}" alt="">` : "");
    const host = (html: string) => { const r = document.createElement("div"); r.className = "row"; r.innerHTML = `<div class="bubble">${html}</div>`; body.appendChild(r); scroll(); };
    const me = (txt: string) => { const r = document.createElement("div"); r.className = "row me"; r.innerHTML = `<div class="bubble me">${txt}</div>`; body.appendChild(r); scroll(); };
    const unlock = (html: string) => {
      const r = document.createElement("div"); r.className = "row"; r.innerHTML = `<div class="bubble unlock">${html}</div>`; body.appendChild(r);
      requestAnimationFrame(() => { body.scrollTop = Math.max(0, r.offsetTop - 10); });
      unlocked = Math.min(4, unlocked + 1); pips.forEach((p, i) => { if (i < unlocked) p.classList.add("on"); }); pc.textContent = `${unlocked}/4`;
    };
    const typing = (cb: () => void, ms = 650) => { const r = document.createElement("div"); r.className = "row"; r.innerHTML = `<div class="bubble typing"><i></i><i></i><i></i></div>`; body.appendChild(r); scroll(); setTimeout(() => { r.remove(); cb(); }, ms); };
    const clearDock = () => { dock.innerHTML = ""; };
    type Opt = { t: string; ic?: string; fn: () => void };
    const opts = (list: Opt[]) => {
      clearDock(); const wrap = document.createElement("div"); wrap.className = "opts";
      list.forEach((o) => { const b = document.createElement("button"); b.className = "opt"; b.innerHTML = (o.ic ? `<span class="lead-ic">${o.ic}</span>` : "") + `<span>${o.t}</span>`; b.onclick = () => { clearDock(); o.fn(); }; wrap.appendChild(b); });
      dock.appendChild(wrap); scroll();
    };
    const grid = (list: Opt[]) => { opts(list); (dock.querySelector(".opts") as HTMLElement).className = "opts grid2"; };
    const textInput = (ph: string, type: string, fn: (v: string) => void) => {
      clearDock(); const f = document.createElement("div"); f.className = "field";
      f.innerHTML = `<input id="ct-fx" type="${type}" placeholder="${ph}"><button class="send" id="ct-sx">→</button>`; dock.appendChild(f); scroll();
      const i = f.querySelector("#ct-fx") as HTMLInputElement; i.focus();
      const go = () => { if (!i.value.trim()) return; const val = i.value.trim(); clearDock(); fn(val); };
      (f.querySelector("#ct-sx") as HTMLElement).onclick = go; i.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") go(); });
    };

    // ── Envio do lead ao CRM: SEM DONO → Fila CEO (receive-quiz-lead, origem "Quiz") ──
    const enviarLead = async (stage: "parcial" | "visita" | "material", temp: string) => {
      try {
        const metaCtx = getMetaContext();
        const interesse = stage === "visita"
          ? `Visita — ${A.dia || ""} · ${A.turno || ""}`
          : stage === "material"
          ? "Recebeu o material — prefere ser contatado"
          : "Deixou contato — material liberado";
        const resumo = `Quiz Casa Tua Canoas · Motivo: ${A.motivo || "-"} · Dorms: ${A.dorms || "-"} · Momento: ${A.momento || "-"} · ${interesse} · Temperatura: ${temp} (${score} pts)`;
        await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: ANON_KEY },
          body: JSON.stringify({
            name: A.nomeCompleto || A.nome,
            phone: (A.zap || "").replace(/\D/g, ""),
            empreendimento: "Casa Tua Santos Ferreira",
            source: "casatua_canoas_quiz",
            campaign_name: "Casa Tua Santos Ferreira — Quiz",
            platform: "Quiz Casa Tua Canoas",
            temperatura: temp,
            message: resumo,
            field_data: [
              { name: "Motivo do clique", values: [A.motivo || ""] },
              { name: "Dormitórios", values: [A.dorms || ""] },
              { name: "Momento de compra", values: [A.momento || ""] },
              { name: "Interesse", values: [interesse] },
              { name: "Temperatura", values: [`${temp} (${score} pts)`] },
            ],
            fbc: metaCtx.fbc,
            fbp: metaCtx.fbp,
            fbclid: metaCtx.fbclid,
            user_agent: metaCtx.user_agent,
            event_source_url: metaCtx.event_source_url,
          }),
        });
      } catch { /* falha de envio não pode travar a UX; lead pode reenviar */ }
    };

    // ── Fluxo v5 ───────────────────────────────────────────────────────
    const start = () => {
      fbqCustom("VisitaIniciou"); // abriu o quiz (funil passo 1)
      host(`<div class="lead">Oi! Sou o Lucas, da Uhome 👋</div>O Casa Tua tá chamando MUITA atenção aqui em Canoas — e tem um motivo. 😏`);
      typing(() => {
        const r = document.createElement("div"); r.className = "row";
        r.innerHTML = `<div class="bubble unlock"><span class="uchip">📍 Canoas · pré-lançamento</span>${photo("casa")}<div class="utitle">Casa Tua Santos Ferreira</div><div class="ulist">Casas de <b>3 e 4 dormitórios</b> em condomínio fechado com lazer completo · a partir de <b>R$ 690 mil</b>.</div></div>`;
        body.appendChild(r); scroll();
        typing(() => {
          host(`São <strong>3 perguntas rápidas</strong> (uns 30s) e eu já <strong>libero as fotos, as plantas e os valores</strong> pra você aqui mesmo. Deixa eu te entender: <strong>o que te fez clicar no anúncio?</strong>`);
          q1();
        }, 850);
      }, 700);
    };

    const q1 = () => {
      opts([
        { t: "Quero mais espaço — pátio e terraço", ic: "🌳", fn: () => ansQ1("Mais espaço externo", "espaco") },
        { t: "Quero a estrutura de um condomínio", ic: "🏊", fn: () => ansQ1("Estrutura de condomínio", "infra") },
        { t: "Vi uma boa oportunidade de investir", ic: "📈", fn: () => ansQ1("Oportunidade de investir", "investir") },
        { t: "Tudo isso me atrai", ic: "✨", fn: () => ansQ1("Tudo faz sentido", "todos") },
      ]);
    };
    const ansQ1 = (m: string, k: string) => {
      A.motivo = m; me(m); fbqCustom("VisitaComecou");
      typing(() => {
        let img = "casa", txt = "";
        if (k === "espaco") { img = "casa"; txt = `Casas de até <b>210m² privativos</b>, com <b>pátio e terraço</b> — o espaço que apê nenhum te dá. Dá pra ter churrasqueira, jardim, o que quiser.`; }
        else if (k === "infra") { img = "club"; txt = `<b>Club house</b> com piscina, academia e salão, mais <b>portaria e segurança</b> — a família toda vive dentro do condomínio, com tranquilidade.`; }
        else if (k === "investir") { img = "invest"; txt = `Lançamento em <b>tabela 0</b> em Canoas: valorização já na planta e a liquidez de uma casa em condomínio. 📈`; }
        else { img = "casa"; txt = `Então segura essa: <b>espaço de casa</b> + <b>estrutura de condomínio</b> + <b>preço de lançamento</b>. É o pacote completo. 🙌`; }
        unlock(`<span class="uchip">🔓 ${m}</span>${photo(img)}<div class="ulist">${txt}</div>`);
        typing(() => {
          unlock(`<div class="utitle">Agora o motivo de tanta gente parar aqui 👇</div><div class="ulist">Uma casa de <b>157m²</b>, com <b>pátio e terraço</b>, custa o mesmo que um <b>apartamento de 3 dormitórios</b> em Canoas e Porto Alegre.<span class="bomb">É preço de apê — a casa vem de brinde 🎁</span></div>`);
          typing(() => { host(`Faz sentido? E me diz: vocês precisam de <strong>quantos dormitórios</strong>?`); q2(); }, 1000);
        }, 900);
      }, 500);
    };

    const q2 = () => {
      opts([
        { t: "Casa de <b>3 dormitórios</b>", ic: "🏠", fn: () => ansQ2("3 dormitórios", "3") },
        { t: "Casa de <b>4 dormitórios</b>", ic: "🏡", fn: () => ansQ2("4 dormitórios", "4") },
        { t: "Ainda não sei", ic: "🤔", fn: () => ansQ2("Ainda decidindo", "x") },
      ]);
    };
    const ansQ2 = (m: string, t: string) => {
      A.dorms = m; if (t !== "x") score += 1; me(m); fbqCustom("VisitaP1Tipologia");
      typing(() => {
        if (t === "4")
          unlock(`<span class="uchip">🔓 Planta 4 dorms</span>${photo("planta4", true)}<div class="utitle">Casa 4 dorms · 176 a 210m² privativos</div><div class="ulist">Terraço · pátio com churrasqueira · 2 vagas<br>💰 A partir de <b>R$ 840 mil</b> <span style="color:#9A6A4B">(vale R$ 976 mil)</span></div>`);
        else if (t === "3")
          unlock(`<span class="uchip">🔓 Planta 3 dorms</span>${photo("planta3", true)}<div class="utitle">Casa 3 dorms · 157 a 170m² privativos</div><div class="ulist">Terraço · pátio com churrasqueira · 2 vagas<br>💰 A partir de <b>R$ 690 mil</b> <span style="color:#9A6A4B">(vale R$ 836 mil)</span></div>`);
        else
          unlock(`<span class="uchip">🔓 As duas plantas</span>${photo("planta3", true)}<div class="ulist">🏠 <b>3 dorms</b> · 157–170m² · a partir de <b>R$ 690 mil</b><br>🏡 <b>4 dorms</b> · 176–210m² · a partir de <b>R$ 840 mil</b><br>Ambas com terraço e pátio.</div>`);
        typing(() => { host(`Última: <strong>pra quando</strong> é o plano?`); q3(); }, 1000);
      }, 500);
    };

    const q3 = () => {
      opts([
        { t: "Quero comprar esse ano", ic: "🚀", fn: () => ansQ3("Comprar esse ano", 2) },
        { t: "Tô começando a olhar agora", ic: "👀", fn: () => ansQ3("Começando a olhar", 1) },
        { t: "Só pesquisando por enquanto", ic: "💭", fn: () => ansQ3("Pesquisando", 0) },
      ]);
    };
    const ansQ3 = (m: string, pts: number) => {
      A.momento = m; score += pts; me(m); fbqCustom("VisitaP2Prioridade");
      typing(() => {
        unlock(`<span class="uchip">🔓 Condição de pré-venda · tabela 0</span><div class="ulist">Você pega o <b>menor valor</b> do lançamento — casa 3 dorms por <b>R$ 690 mil</b>. Casas parecidas em condomínios de Canoas valem mais. 📈</div><div class="cond"><div class="cr"><span>Entrada</span><b>10%</b></div><div class="cr"><span>Mensais</span><b>10% · ~R$ 1,9 mil/mês</b></div><div class="cr"><span>Reforços</span><b>10%</b></div><div class="cr"><span>Restante</span><b>financiado na entrega</b></div></div><div class="ulist" style="margin-top:7px">Ou 10% de entrada e o restante financiado. Dá pra ajustar no seu nome. 👌</div>`);
        typing(pedirDados, 850);
      }, 520);
    };

    const pedirDados = () => {
      host(`Curtiu? 😍 Me passa teu <strong>nome</strong> e <strong>WhatsApp</strong> que eu <strong>libero na hora, aqui mesmo</strong>, o material completo — todas as fotos, as plantas e os valores. Leva 10 segundos, e depois um especialista te acompanha quando você quiser, <strong>sem pressão</strong>.`);
      qNome();
    };
    const qNome = () => {
      textInput("Seu nome", "text", (v) => {
        A.nomeCompleto = v; A.nome = v.split(" ")[0]; me(v);
        typing(() => { host(`Show, <strong>${A.nome}</strong>! E pra qual <strong>WhatsApp</strong> eu te envio?`); qZap(); });
      });
    };
    const qZap = () => {
      textInput("(51) 9 9999-9999", "tel", (v) => {
        A.zap = v; me(v); fbqCustom("VisitaContato");
        unlocked = 4; pips.forEach((p) => p.classList.add("on")); pc.textContent = "4/4";
        // Captura o lead JÁ com o WhatsApp (garante o contato mesmo se largar antes da escolha final).
        const tempParcial = score >= 4 ? "quente" : score >= 2 ? "morno" : "frio";
        enviarLead("parcial", tempParcial);
        typing(liberar, 900);
      });
    };

    const liberar = () => {
      fbqCustom("VisitaQuizCompleto", { content_name: "Casa Tua Santos Ferreira" });
      host(`🔓 Liberado, <strong>${A.nome}</strong>! Tá tudo aqui pra você 👇`);
      typing(() => {
        unlock(`<div class="utitle">📦 Material completo do Casa Tua</div><div class="gal"><img src="${IMG.casa}" alt=""><img src="${IMG.club}" alt=""><img src="${IMG.invest}" alt=""><img src="${IMG.loc}" alt=""></div><div class="ulist" style="margin-top:6px">✅ Fotos do empreendimento<br>✅ Plantas 3 e 4 dorms (área privativa)<br>✅ Tabela de valores e condições</div><a class="dl" id="ct-dl" href="${GUIA}" download="Guia-Casa-Tua-Santos-Ferreira.pdf">📄 Baixar o guia completo</a>`);
        const dl = document.getElementById("ct-dl");
        if (dl) dl.addEventListener("click", () => fbqCustom("GuiaBaixado", { content_name: "Guia Casa Tua Santos Ferreira" }), { once: true });
        typing(() => {
          host(`Como você prefere seguir?`);
          clearDock();
          const c = document.createElement("button"); c.className = "cta gold"; c.innerHTML = "Quero já marcar minha visita 🔑";
          c.onclick = () => { me("Quero marcar a visita"); score += 2; typing(qDia, 600); };
          dock.appendChild(c);
          const b = document.createElement("button"); b.className = "cta alt"; b.innerHTML = "Prefiro que um especialista me chame 💬";
          b.onclick = () => { me("Prefiro que me chamem"); typing(() => finish("material"), 700); };
          dock.appendChild(b);
          const h = document.createElement("div"); h.className = "hint"; h.innerHTML = "🤝 Sem pressão — no seu tempo"; dock.appendChild(h); scroll();
        }, 1000);
      }, 700);
    };

    const qDia = () => {
      host("Boa! Qual o melhor <strong>dia</strong> pra você conhecer?");
      const hoje = new Date();
      const dias: Opt[] = [];
      const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      let add = 0;
      while (dias.length < 4) {
        add += 1; const d = new Date(hoje); d.setDate(hoje.getDate() + add);
        const label = `${nomes[d.getDay()]}<br>${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        const full = `${nomes[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        dias.push({ t: label, fn: () => ansDia(full) });
      }
      grid(dias);
    };
    const ansDia = (t: string) => { A.dia = t; me(t.split(",")[0]); typing(() => { host("E você prefere <strong>de manhã</strong> ou <strong>à tarde</strong>? O especialista confirma o horário exato com você no WhatsApp."); qTurno(); }); };
    const qTurno = () => grid([
      { t: "De manhã", fn: () => ansTurno("Manhã") },
      { t: "À tarde", fn: () => ansTurno("Tarde") },
      { t: "Tanto faz", fn: () => ansTurno("Qualquer horário") },
    ]);
    const ansTurno = (t: string) => { A.turno = t; me(t); typing(() => finish("visita"), 800); };

    const finish = (mode: "visita" | "material") => {
      const temp = score >= 4 ? "quente" : score >= 2 ? "morno" : "frio";
      enviarLead(mode, temp);
      fbqCustom(mode === "visita" ? "VisitaAgendada" : "FalarComCorretor", { content_name: "Casa Tua Santos Ferreira", value: score });
      let inner: string;
      if (mode === "visita") {
        const diaNum = (A.dia.match(/\d+/) || ["16"])[0];
        inner = `<h3>Visita marcada, ${A.nome}! 🎉</h3><p>Um especialista da Uhome confirma o horário no seu WhatsApp e te mostra a casa por dentro.</p><div class="appt"><div class="cal"><small>${A.dia.split(",")[0].slice(0, 3)}</small><b>${diaNum}</b></div><div class="info"><b>${A.dia} · ${A.turno}</b><span>Plantão Casa Tua · Av. Santos Ferreira, 3511 — Canoas</span></div></div>`;
      } else {
        inner = `<h3>Tá tudo liberado, ${A.nome}! 🎉</h3><p>O material está aí em cima pra você ver quando quiser. Um especialista da Uhome vai te chamar no WhatsApp <b>só pra tirar dúvidas</b> — sem pressão.</p>`;
      }
      const wrap = document.createElement("div"); wrap.className = "row";
      wrap.innerHTML = `<div class="bubble" style="max-width:100%"><div class="final">${inner}</div></div>`;
      body.appendChild(wrap);
      clearDock();
      const h = document.createElement("div"); h.className = "hint"; h.innerHTML = `🤝 Atendimento humano no WhatsApp ${A.zap} · sem pressão`; dock.appendChild(h); scroll();
    };

    start();
  }, []);

  return (
    <div id="ct-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="screen">
        <div className="bar">
          <div className="avatar"><img src="/casatua/lucas.jpg" alt="Lucas Sarmento" /></div>
          <div className="who"><b>Lucas Sarmento</b><span className="on"><i className="dot" /> Fundador · Uhome</span></div>
        </div>
        <div className="reward" id="ct-reward">
          <span className="gift">🏡</span><b>Casa Tua Canoas</b>
          <span className="pips"><span className="pip" /><span className="pip" /><span className="pip" /><span className="pip" /></span>
          <span className="pc" id="ct-pc">0/4</span>
        </div>
        <div className="body" id="ct-body" />
        <div className="dock" id="ct-dock" />
      </div>
    </div>
  );
}
