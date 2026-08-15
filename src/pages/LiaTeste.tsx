/**
 * LiaTeste — página pública de TESTE da LIA (rota /lia-teste).
 * Conversa real com a função lia-chat (cérebro da LIA, método do doc).
 * Serve pra validar o comportamento antes de ligar no WhatsApp de produção.
 * Não grava lead, não integra WhatsApp. Uso interno da Uhome.
 */
import { useEffect, useRef, useState } from "react";
import { EDGE_BASE_URL } from "@/lib/edgeBaseUrl";

const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const LIA_URL = `${EDGE_BASE_URL}/functions/v1/lia-chat`;

const CSS = `
#lia-root{--wa:#008069;--bg:#EFE7DE;--out:#D9FDD3;--ink:#111B21;--muted:#667781;--tick:#53BDEB;
  position:fixed;inset:0;display:flex;flex-direction:column;background:var(--bg);
  font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:var(--ink)}
#lia-root *{box-sizing:border-box;margin:0}
#lia-root .head{background:var(--wa);color:#fff;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;display:flex;align-items:center;gap:10px;flex:none}
#lia-root .av{width:38px;height:38px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}
#lia-root .nm{font-size:15px;font-weight:600;display:flex;align-items:center;gap:5px}
#lia-root .st{font-size:11.5px;opacity:.9;margin-top:1px}
#lia-root .badge{margin-left:auto;background:rgba(255,255,255,.18);font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:.03em}
#lia-root .body{flex:1;overflow-y:auto;padding:14px 10px 8px;display:flex;flex-direction:column;gap:6px;
  background-color:#EFE7DE;background-image:radial-gradient(rgba(0,0,0,.03) 1px,transparent 1px);background-size:22px 22px}
#lia-root .body::-webkit-scrollbar{width:0}
#lia-root .row{display:flex;animation:r .25s ease both}
#lia-root .row.me{justify-content:flex-end}
@keyframes r{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
#lia-root .b{max-width:80%;padding:6px 10px 5px;border-radius:8px;font-size:14.5px;line-height:1.45;box-shadow:0 1px .5px rgba(0,0,0,.13);white-space:pre-wrap;word-wrap:break-word}
#lia-root .b.in{background:#fff;border-top-left-radius:2px}
#lia-root .b.me{background:var(--out);border-top-right-radius:2px}
#lia-root .typing{background:#fff;border-radius:8px;border-top-left-radius:2px;padding:11px 13px;box-shadow:0 1px .5px rgba(0,0,0,.13);display:flex;gap:4px;width:fit-content}
#lia-root .typing i{width:7px;height:7px;border-radius:50%;background:#B9C1C6;animation:bl 1s infinite}
#lia-root .typing i:nth-child(2){animation-delay:.15s}#lia-root .typing i:nth-child(3){animation-delay:.3s}
@keyframes bl{0%,60%,100%{opacity:.35}30%{opacity:1}}
#lia-root .err{align-self:center;background:#FDECEA;color:#B23A2E;font-size:12px;padding:6px 12px;border-radius:8px;margin:4px 20px}
#lia-root .dock{background:#F0F2F5;padding:8px 10px calc(9px + env(safe-area-inset-bottom));display:flex;gap:8px;align-items:center;flex:none}
#lia-root .dock input{flex:1;border:none;outline:none;background:#fff;border-radius:22px;padding:11px 15px;font:inherit;font-size:14.5px}
#lia-root .snd{width:44px;height:44px;border-radius:50%;background:var(--wa);color:#fff;border:none;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;flex:none}
#lia-root .snd:disabled{opacity:.5}
`;

type Bubble = { who: "lia" | "me"; text: string };

export default function LiaTeste() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const scroll = () => requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; });

  useEffect(() => { scroll(); }, [bubbles, busy]);

  const callLia = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(LIA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ messages: history.current }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Falha ao falar com a LIA");
      const content = String(data.content || "").trim();
      history.current.push({ role: "assistant", content });
      const parts = content.split(/\s*\|\|\|\s*/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) setBubbles((b) => [...b, { who: "lia", text: p }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    document.title = "LIA · teste de atendimento";
    // Priming invisível: faz a LIA abrir a conversa.
    history.current.push({
      role: "user",
      content: "(Novo lead da campanha do Casa Tua Canoas chegou pelo formulário. O primeiro nome dele é Lucas. Faça a abertura do atendimento: cumprimente pelo nome, se apresente como assistente da Uhome e faça a primeira pergunta que valida interesse.)",
    });
    callLia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = () => {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    setBubbles((b) => [...b, { who: "me", text: t }]);
    history.current.push({ role: "user", content: t });
    callLia();
  };

  return (
    <div id="lia-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="head">
        <div className="av">🏠</div>
        <div>
          <div className="nm">LIA · Uhome ✅</div>
          <div className="st">{busy ? "digitando…" : "online · assistente virtual"}</div>
        </div>
        <div className="badge">TESTE</div>
      </div>
      <div className="body" ref={bodyRef}>
        {bubbles.map((b, i) => (
          <div key={i} className={"row " + (b.who === "me" ? "me" : "")}>
            <div className={"b " + (b.who === "me" ? "me" : "in")}>{b.text}</div>
          </div>
        ))}
        {busy && (
          <div className="row"><div className="typing"><i></i><i></i><i></i></div></div>
        )}
        {err && <div className="err">{err}</div>}
      </div>
      <div className="dock">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Escreva como se fosse o lead…"
          autoComplete="off"
        />
        <button className="snd" onClick={send} disabled={busy} aria-label="Enviar">➤</button>
      </div>
    </div>
  );
}
