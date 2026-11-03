// Placar de Natal (TV): peças visuais e faixas extras. Removível apagando src/natal/.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { diasAte18 } from "./config";
import { brlCurto, META_EQUIPE, META_UHOME } from "./missao";
import { NeveSuave } from "./NeveSuave";

export const NATAL_OURO = "#D4AF37";
export const NATAL_FUNDO = "radial-gradient(ellipse at center, #141a4a 0%, #0a0a1a 60%, #06060f 100%)";
export const NATAL_CONFETE = ["#A8202A", "#D4AF37", "#16A34A", "#FFFFFF"];
export const NATAL_NOTAS_MARCADA = [1319, 1568, 2093];
export const NATAL_NOTAS_REALIZADA = [659, 659, 659, 659, 659, 659, 659, 784, 523, 587, 659];
export const NATAL_TITULO_GRAD = "linear-gradient(90deg, #B8860B, #F5D77A, #D4AF37, #F5D77A, #B8860B)";

/** Luzes no topo da tela, neve de fundo, Homi à esquerda e contagem à direita. */
export function PlacarNatalDecor() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5, zIndex: 0 }}>
        <NeveSuave altura={1200} flocos={60} />
      </div>
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 26, backgroundImage: "url(/natal/luzes_varal_faixa_larga.svg)", backgroundRepeat: "repeat-x", backgroundSize: "auto 26px", pointerEvents: "none", zIndex: 2 }} />
      <img src="/natal/homi_noel.png" alt="" aria-hidden style={{ position: "absolute", top: 18, left: 18, height: 72, zIndex: 3, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 22, right: 24, textAlign: "right", zIndex: 3, color: NATAL_OURO, lineHeight: 1.05 }}>
        <div style={{ fontSize: 13, letterSpacing: 3 }}>NATAL CHAVE DE OURO</div>
        <div style={{ fontSize: "clamp(20px, 2.4vw, 32px)", letterSpacing: 2 }}>FALTAM {diasAte18()} DIAS</div>
        <div style={{ fontSize: 13, letterSpacing: 3 }}>PARA 18/12</div>
      </div>
    </>
  );
}

/** Barra dourada com a chave na ponta (meta da empresa). */
export function BarraOuroTv({ valor, meta }: { valor: number; meta: number }) {
  const pct = Math.min((valor / Math.max(1, meta)) * 100, 100);
  return (
    <div style={{ position: "relative", height: 16, borderRadius: 99, background: "#1e1e2e" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #8a6a12, #D4AF37, #F5D77A)", boxShadow: "0 0 16px #D4AF3788", transition: "width .8s" }} />
      <img src="/natal/chave_de_ouro_com_laco.svg" alt="" aria-hidden style={{ position: "absolute", top: "50%", left: `calc(${pct}% - 14px)`, transform: "translateY(-50%)", height: 34, pointerEvents: "none" }} />
    </div>
  );
}

type DadosNatal = { vgv_ano: number; equipes: { equipe: string; vgv: number }[]; top_semana: { nome: string; equipe: string; n: number }[] };

/** Duas faixas do rodapé: Missão 100 milhões e Prêmio surpresa da semana (Uhome toda). */
export function FaixasPlacarNatal() {
  const [d, setD] = useState<DadosNatal | null>(null);
  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      const { data } = await supabase.rpc("rpc_placar_natal");
      if (vivo && data) setD(data as unknown as DadosNatal);
    };
    carregar();
    const iv = setInterval(carregar, 120_000);
    return () => { vivo = false; clearInterval(iv); };
  }, []);
  if (!d) return null;
  const medalha = ["🥇", "🥈", "🥉"];
  const caixa = { background: "#ffffff0a", border: `1px solid ${NATAL_OURO}44`, borderRadius: 12, padding: "8px 14px" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10, padding: "0 20px 4px", flexShrink: 0, position: "relative", zIndex: 1 }}>
      <div style={caixa}>
        <div style={{ display: "flex", justifyContent: "space-between", letterSpacing: 2, fontSize: "clamp(14px, 1.6vw, 20px)" }}>
          <span>🔑 MISSÃO 100 MILHÕES</span>
          <span style={{ color: NATAL_OURO }}>{brlCurto(Number(d.vgv_ano))} / R$ 100 mi</span>
        </div>
        <div style={{ margin: "6px 0" }}><BarraOuroTv valor={Number(d.vgv_ano)} meta={META_UHOME} /></div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#ffffffaa", letterSpacing: 1 }}>
          CAMPANHA: {d.equipes.length ? d.equipes.map((e) => `${e.equipe} ${brlCurto(Number(e.vgv))}`).join(" · ") : "sem vendas ainda"} (META {brlCurto(META_EQUIPE)} CADA)
        </div>
      </div>
      <div style={caixa}>
        <div style={{ letterSpacing: 2, fontSize: "clamp(14px, 1.6vw, 20px)" }}>🎁 PRÊMIO SURPRESA DA SEMANA</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "4px 0", fontSize: "clamp(14px, 1.6vw, 20px)" }}>
          {d.top_semana.length ? d.top_semana.map((t, i) => <span key={i}>{medalha[i]} {t.nome} · {t.n}</span>) : <span style={{ color: "#ffffff66" }}>Ninguém realizou visita ainda</span>}
        </div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: NATAL_OURO, letterSpacing: 1 }}>VISITAS REALIZADAS NA UHOME TODA · FECHA DOMINGO 23:59</div>
      </div>
    </div>
  );
}
