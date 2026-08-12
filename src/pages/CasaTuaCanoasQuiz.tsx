/**
 * CasaTuaCanoasQuiz — Funil conversacional público do empreendimento
 * Casa Tua Santos Ferreira (Canoas). Rota pública: /casatuacanoas-quiz
 *
 * Formato recompensa: cada resposta desbloqueia info personalizada (foto real),
 * libera o Guia (download na hora), e progride pra visita (preferência dia+turno,
 * corretor valida) OU falar com corretor. O lead cai em pipeline_leads via
 * receive-landing-lead (roleta). Pixel dispara evento CUSTOM próprio — nunca Lead.
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
#ct-root .utitle{font-weight:800; font-size:14.5px; margin-bottom:4px}
#ct-root .ulist{font-size:13px; line-height:1.55; color:#3A3324}
#ct-root .ulist b{color:var(--ink)}
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
#ct-root .book{width:150px; margin:4px auto 2px; perspective:600px}
#ct-root .book .cover{border-radius:6px 12px 12px 6px; padding:18px 15px 16px; color:#fff; background:linear-gradient(135deg,#3B4252,#20242E); box-shadow:-6px 8px 22px rgba(0,0,0,.28); border-left:6px solid var(--gold); animation:ctbookin .6s cubic-bezier(.2,1.2,.4,1) both; text-align:left}
@keyframes ctbookin{from{opacity:0; transform:rotateY(-28deg) translateY(10px)}to{opacity:1; transform:none}}
#ct-root .book .bk{font-size:9px; letter-spacing:.12em; color:var(--gold); font-weight:800; text-transform:uppercase}
#ct-root .book .bt{font-size:18px; font-weight:800; line-height:1.1; margin:8px 0 6px; font-family:Georgia,'Times New Roman',serif}
#ct-root .book .bs{font-size:10px; color:#C7CBD6; line-height:1.5}
#ct-root .book .btag{margin-top:11px; display:inline-block; font-size:8.5px; font-weight:800; letter-spacing:.08em; background:var(--gold); color:#20242E; padding:3px 7px; border-radius:4px}
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
    const photo = (k: string) => (IMG[k] ? `<img class="uphoto" src="${IMG[k]}" alt="">` : "");
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

    // ── Envio do lead ao CRM (pipeline_leads + roleta via receive-landing-lead)
    const enviarLead = async (stage: "parcial" | "visita" | "corretor", temp: string) => {
      try {
        const metaCtx = getMetaContext();
        const interesse = stage === "visita"
          ? `Visita — ${A.dia || ""} · ${A.turno || ""}`
          : stage === "corretor"
          ? "Falar com um corretor agora"
          : "Baixou o Book — ainda escolhendo";
        const resumo = `Quiz Casa Tua Canoas · Tipologia: ${A.tipo || "-"} · Prioriza: ${A.peso || "-"} · Compra: ${A.compra || "-"} · ${interesse} · Temperatura: ${temp} (${score} pts)`;
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
              { name: "Tipologia de interesse", values: [A.tipo || ""] },
              { name: "O que mais importa", values: [A.peso || ""] },
              { name: "Forma de compra", values: [A.compra || ""] },
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

    // ── Fluxo ──────────────────────────────────────────────────────────
    const start = () => {
      fbqCustom("VisitaIniciou"); // abriu o quiz (funil passo 1)
      host(`<div class="lead">Você viu o Casa Tua no anúncio, né? 👀</div>Sou o Lucas, da Uhome. Já te adianto o principal 👇`);
      typing(() => {
        // Valor imediato na entrada (sem pedir nada) — sacia a sede de quem veio do anúncio
        const r = document.createElement("div"); r.className = "row";
        r.innerHTML = `<div class="bubble unlock"><span class="uchip">✨ Espia rápida</span>${photo("casa")}<div class="utitle">Casa Tua Santos Ferreira · Canoas</div><div class="ulist">🏡 Casas de <b>3 e 4 dorms</b> em <b>condomínio fechado</b> (não apê)<br>📍 Santos Ferreira — <b>4 min</b> do hospital, <b>6 min</b> do ParkShopping<br>🏊 Lazer completo: piscina, academia, salão<br>💰 Pré-venda <b>a partir de R$ 690 mil</b> <span style="color:#9A6A4B">(avaliada em R$ 836 mil)</span></div></div>`;
        body.appendChild(r); scroll();
        typing(() => {
          host(`Gostou? Eu monto um 📘 <strong>Book Casa Tua</strong> só pra você — com as <strong>plantas</strong>, os <strong>preços</strong> e uma <strong>simulação no seu nome</strong>. Respondo <strong>3 coisinhas rápidas</strong> e no fim é seu, na hora. 📲`);
          clearDock();
          const c = document.createElement("button"); c.className = "cta gold"; c.innerHTML = "Quero meu Book 📘";
          c.onclick = () => { fbqCustom("VisitaComecou"); qTipo(); }; dock.appendChild(c);
          const h = document.createElement("div"); h.className = "hint"; h.innerHTML = "📘 Book liberado no final · leva 1 minuto"; dock.appendChild(h); scroll();
        }, 800);
      }, 700);
    };

    const qTipo = () => {
      host("Primeira: qual dessas <strong>casas</strong> te chama mais a atenção?");
      opts([
        { t: "Casa de <b>3 dormitórios</b>", ic: "🏠", fn: () => ansTipo("3 dormitórios", 1) },
        { t: "Casa de <b>4 dormitórios</b>", ic: "🏡", fn: () => ansTipo("4 dormitórios", 1) },
        { t: "Ainda não sei, quero ver as duas", ic: "👀", fn: () => ansTipo("as duas", 0) },
      ]);
    };
    const ansTipo = (t: string, pts: number) => {
      A.tipo = t; score += pts; me(t); fbqCustom("VisitaP1Tipologia");
      typing(() => {
        if (t === "4 dormitórios")
          unlock(`<span class="uchip">🔓 Desbloqueado · Planta & preço</span>${photo("casa")}<div class="utitle">Casa 4 dorms com Terraço</div><div class="ulist"><b>116 a 210m²</b> · 2 vagas · pátio privativo com churrasqueira · espaço pra piscina/spa no terraço<br>💰 Pré-venda a partir de <b>R$ 840 mil</b> <span style="color:#9A6A4B">(avaliada em R$ 976 mil)</span></div>`);
        else if (t === "3 dormitórios")
          unlock(`<span class="uchip">🔓 Desbloqueado · Planta & preço</span>${photo("casa")}<div class="utitle">Casa 3 dorms com Terraço</div><div class="ulist"><b>96 a 170m²</b> · 2 vagas · pátio privativo com churrasqueira · espaço pra piscina/spa no terraço<br>💰 Pré-venda a partir de <b>R$ 690 mil</b> <span style="color:#9A6A4B">(avaliada em R$ 836 mil)</span></div>`);
        else
          unlock(`<span class="uchip">🔓 Desbloqueado · As duas plantas</span>${photo("casa")}<div class="utitle">3 e 4 dorms com Terraço</div><div class="ulist">🏠 <b>3 dorms</b> · 96–170m² · a partir de <b>R$ 690 mil</b><br>🏡 <b>4 dorms</b> · 116–210m² · a partir de <b>R$ 840 mil</b><br>Todas com pátio privativo e terraço.</div>`);
        typing(() => { host("Boa escolha! 🎉 Já é <strong>1/4</strong> do seu Book. Deixa eu te entender melhor:"); qPeso(); }, 700);
      }, 500);
    };

    const qPeso = () => {
      host("O que <strong>mais pesa</strong> pra você numa casa dessas?");
      opts([
        { t: "O lazer completo do condomínio", ic: "🏊", fn: () => ansPeso("Lazer", "club") },
        { t: "Espaço e conforto pra família", ic: "👨‍👩‍👧", fn: () => ansPeso("Família", "casa") },
        { t: "A localização em Canoas", ic: "📍", fn: () => ansPeso("Localização", "loc") },
        { t: "Ser um bom investimento", ic: "📈", fn: () => ansPeso("Investimento", "invest") },
      ]);
    };
    const ansPeso = (t: string, kind: string) => {
      A.peso = t; me(t); fbqCustom("VisitaP2Prioridade");
      typing(() => {
        if (kind === "club") unlock(`<span class="uchip">🔓 Desbloqueado · Lazer</span>${photo("club")}<div class="utitle">Lazer que você usa todo dia</div><div class="ulist">Club House com <b>piscina adulto e infantil</b>, <b>academia</b>, <b>salão de festas</b>, além de portaria e segurança. Tudo dentro do condomínio.</div>`);
        else if (kind === "casa") unlock(`<span class="uchip">🔓 Desbloqueado · Espaço</span>${photo("casa")}<div class="utitle">Espaço de casa, de verdade</div><div class="ulist">Sobrados de até <b>210m²</b>, <b>terraço</b> só seu, pátio com churrasqueira e <b>2 vagas</b>. Nada de dividir parede fininha de apê.</div>`);
        else if (kind === "loc") unlock(`<span class="uchip">🔓 Desbloqueado · Localização</span>${photo("loc")}<div class="utitle">No coração de Canoas</div><div class="ulist"><b>4 min</b> do Hospital N.S. das Graças · <b>6 min</b> do ParkShopping · <b>7 min</b> do Bourbon Shopping e do Parque Getúlio Vargas.</div>`);
        else unlock(`<span class="uchip">🔓 Desbloqueado · Investimento</span>${photo("invest")}<div class="utitle">Você entra na largada</div><div class="ulist">Comprando agora na pré-venda: casa avaliada em <b>R$ 836 mil</b> por <b>R$ 690 mil</b> — cerca de <b>R$ 146 mil</b> de diferença + <b>ITBI e registro grátis</b>.</div>`);
        typing(() => { host("É <strong>2/4</strong>! Falta pouco pro seu Book. 😉"); qCompra(); }, 700);
      }, 500);
    };

    const qCompra = () => {
      host("Pra eu já preparar a <strong>condição certa</strong> pra você — como pensa em comprar?");
      opts([
        { t: "Tenho a entrada e financio o restante", ic: "✅", fn: () => ansCompra("Entrada + financiamento", 2) },
        { t: "Financiamento pela Caixa (associativo)", ic: "🏦", fn: () => ansCompra("Associativo CEF", 2) },
        { t: "Quero entender as condições e simular", ic: "🧮", fn: () => ansCompra("Quer simular", 1) },
        { t: "Ainda estou me organizando", ic: "💭", fn: () => ansCompra("Se organizando", 0) },
      ]);
    };
    const ansCompra = (t: string, pts: number) => {
      A.compra = t; score += pts; me(t); fbqCustom("VisitaP3Compra");
      typing(() => {
        if (pts >= 1) unlock(`<span class="uchip">🔓 Desbloqueado · Sua condição</span><div class="utitle">Condição da pré-venda (casa 3 dorms)</div><div class="cond"><div class="cr"><span>Ato (entrada)</span><b>a partir de R$ 69 mil</b></div><div class="cr"><span>ITBI + Registro</span><b>grátis</b></div><div class="cr"><span>Financiamento CEF</span><b>até 90%</b></div><div class="cr"><span>Ou plano 30/70</span><b>36x de R$ 3.495</b></div></div><div class="ulist" style="margin-top:7px">Dá pra ajustar tudo isso no seu nome na visita. 👌</div>`);
        else unlock(`<span class="uchip">🔓 Desbloqueado · Sem pressa</span><div class="utitle">Tem caminho pra todo mundo</div><div class="ulist">Sem problema! Tem <b>plano 30/70</b> (36x de R$ 3.495) e financiamento pela Caixa. No Book vai uma simulação pra te ajudar a se organizar.</div>`);
        typing(() => { host("Prontinho, <strong>3/4</strong>! 🔥 Só me diz quem é você pra liberar o Book."); qNome(); }, 750);
      }, 520);
    };

    const qNome = () => {
      host("Como é o seu <strong>nome</strong>?");
      textInput("Seu nome", "text", (v) => {
        A.nomeCompleto = v; A.nome = v.split(" ")[0]; me(v); 
        typing(() => { host(`Prazer, <strong>${A.nome}</strong>! E qual seu <strong>WhatsApp</strong>? É por onde nosso time confirma sua visita e garante sua condição de pré-venda.`); qZap(); });
      });
    };
    const qZap = () => {
      textInput("(51) 9 9999-9999", "tel", (v) => { A.zap = v; me(v); fbqCustom("VisitaContato");
        unlocked = 4; pips.forEach((p) => p.classList.add("on")); pc.textContent = "4/4";
        // Captura o lead JÁ com o WhatsApp (garante o contato mesmo se largar antes da escolha final).
        const tempParcial = score >= 4 ? "quente" : score >= 2 ? "morno" : "frio";
        enviarLead("parcial", tempParcial);
        typing(reward, 900);
      });
    };

    const reward = () => {
      host(`🎉 Prontinho, <strong>${A.nome}</strong>! Seu Book está liberado — é só baixar:`);
      fbqCustom("VisitaQuizCompleto", { content_name: "Casa Tua Santos Ferreira" });
      fbqCustom("GuiaBaixado", { content_name: "Guia Casa Tua Santos Ferreira" });
      typing(() => {
        unlock(`<div class="book"><div class="cover"><div class="bk">Uhome · Book exclusivo</div><div class="bt">Casa Tua<br>Santos Ferreira</div><div class="bs">Plantas · Preços · Simulação sob medida · Tudo sobre o condomínio</div><div class="btag">PRÉ-LANÇAMENTO</div></div></div><a class="dl" href="${GUIA}" download="Guia-Casa-Tua-Santos-Ferreira.pdf">⬇️ Baixar meu Book (PDF)</a>`);
        typing(() => {
          host(`Show! 📄 O Book é seu. E olha, ${A.nome}: a <strong>condição de pré-venda</strong> vale só pras <strong>30 primeiras famílias</strong>. 🔥<br><br>Como você prefere seguir daqui?`);
          clearDock();
          const c = document.createElement("button"); c.className = "cta gold"; c.innerHTML = "Quero garantir minha visita 🔑";
          c.onclick = () => { me("Quero garantir minha visita"); typing(qDia, 600); };
          dock.appendChild(c);
          const b = document.createElement("button"); b.className = "cta alt"; b.innerHTML = "Falar agora com um corretor 💬";
          b.onclick = () => { me("Quero falar com um corretor"); score += 2; typing(() => finish("corretor"), 700); };
          dock.appendChild(b);
          const h = document.createElement("div"); h.className = "hint"; h.innerHTML = "📘 Book já baixado · escolha como seguir"; dock.appendChild(h); scroll();
        }, 1100);
      }, 700);
    };

    const qDia = () => {
      host("Boa! Qual o melhor <strong>dia</strong> pra você ir ao plantão?");
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
    const ansDia = (t: string) => { A.dia = t; me(t.split(",")[0]); typing(() => { host("E você prefere <strong>de manhã</strong> ou <strong>à tarde</strong>? O consultor confirma o horário exato com você no WhatsApp."); qTurno(); }); };
    const qTurno = () => grid([
      { t: "De manhã", fn: () => ansTurno("Manhã") },
      { t: "À tarde", fn: () => ansTurno("Tarde") },
      { t: "Tanto faz", fn: () => ansTurno("Qualquer horário") },
    ]);
    const ansTurno = (t: string) => { A.turno = t; me(t); typing(() => finish("visita"), 800); };

    const finish = (mode: "visita" | "corretor") => {
      const temp = score >= 4 ? "quente" : score >= 2 ? "morno" : "frio";
      enviarLead(mode, temp);
      fbqCustom(mode === "visita" ? "VisitaAgendada" : "FalarComCorretor", { content_name: "Casa Tua Santos Ferreira", value: score });
      const bookHtml = `<div class="book"><div class="cover"><div class="bk">Uhome · Book exclusivo</div><div class="bt">Casa Tua<br>Santos Ferreira</div><div class="bs">Baixado ✓</div><div class="btag">PRÉ-LANÇAMENTO</div></div></div>`;
      let inner: string;
      if (mode === "visita") {
        const diaNum = (A.dia.match(/\d+/) || ["16"])[0];
        inner = `<h3 style="margin-top:14px">Visita pré-agendada, ${A.nome}! 🎉</h3><p>Nosso time vai te chamar no WhatsApp pra <b>confirmar o horário</b> e garantir sua condição de pré-venda.</p><div class="appt"><div class="cal"><small>${A.dia.split(",")[0].slice(0, 3)}</small><b>${diaNum}</b></div><div class="info"><b>${A.dia} · ${A.turno}</b><span>Plantão Casa Tua · Av. Santos Ferreira, 3511 — Canoas</span></div></div>`;
      } else {
        inner = `<h3 style="margin-top:14px">Tudo certo, ${A.nome}! 🎉</h3><p>Nosso time vai te chamar <b>agora no WhatsApp</b> pra seguir seu atendimento e tirar todas as dúvidas do Casa Tua.</p>`;
      }
      body.innerHTML = "";
      const wrap = document.createElement("div"); wrap.className = "row";
      wrap.innerHTML = `<div class="bubble" style="max-width:100%"><div class="final">${bookHtml}${inner}<a class="dl" style="margin-top:14px" href="${GUIA}" download="Guia-Casa-Tua-Santos-Ferreira.pdf">⬇️ Baixar o Book de novo</a></div></div>`;
      body.appendChild(wrap);
      clearDock();
      const h = document.createElement("div"); h.className = "hint"; h.innerHTML = `📞 Time da Uhome vai te chamar no WhatsApp ${A.zap}`; dock.appendChild(h); scroll();
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
          <span className="gift">📘</span><b>Book Casa Tua</b>
          <span className="pips"><span className="pip" /><span className="pip" /><span className="pip" /><span className="pip" /></span>
          <span className="pc" id="ct-pc">0/4</span>
        </div>
        <div className="body" id="ct-body" />
        <div className="dock" id="ct-dock" />
      </div>
    </div>
  );
}
