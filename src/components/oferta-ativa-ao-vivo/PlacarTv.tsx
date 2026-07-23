// @ts-nocheck
/**
 * PlacarTv — Placar TV do Mutirão Inteligente
 * Identidade visual do Placar do Dia + essência do Mutirão (pontos, ligações, visitas).
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutiraoRanking } from "@/hooks/useMutiraoRealtime";

const META_EQUIPE = 10;
const DEFAULT_META_EMPRESA = 30;

// Paleta fixa por equipe conhecida; fallback cinza para novas equipes
const EQUIPE_COLORS: Record<string, { cor: string; emoji: string }> = {
  "Bruno Schuler": { cor: "#3350E6", emoji: "💙" },
  "Bruno": { cor: "#3350E6", emoji: "💙" },
  "Gabriel": { cor: "#16A34A", emoji: "💚" },
  "Junior Padilha": { cor: "#EA580C", emoji: "🧡" },
  "Junior": { cor: "#EA580C", emoji: "🧡" },
};
const FALLBACK_COLORS = ["#9333EA", "#0EA5E9", "#F59E0B", "#EC4899", "#14B8A6"];
function equipeStyle(nome: string | null | undefined, idx: number) {
  const key = nome ?? "Sem equipe";
  return EQUIPE_COLORS[key] ?? { cor: FALLBACK_COLORS[idx % FALLBACK_COLORS.length], emoji: "⭐" };
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
}

function ProgressBar({ valor, meta, cor }: any) {
  const pct = Math.min((valor / meta) * 100, 100);
  return (
    <div style={{ background: "#1e1e2e", borderRadius: 99, height: 14, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: cor,
          borderRadius: 99,
          transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
          boxShadow: `0 0 16px ${cor}88`,
        }}
      />
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px #0008", letterSpacing: 0.5 }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) { if (animRef.current) cancelAnimationFrame(animRef.current); return; }
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height * -1,
      vy: 2 + Math.random() * 3, vx: (Math.random() - 0.5) * 2,
      size: 6 + Math.random() * 8,
      color: ["#9333EA", "#3350E6", "#16A34A", "#F59E0B", "#EF4444"][Math.floor(Math.random() * 5)],
      rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 6,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y += p.vy; p.x += p.vx; p.rot += p.rotV;
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [active]);
  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }} />;
}

interface FeedItem { corretor: string; hora: string; tipo: "aproveitado" | "visita_agendada"; empreendimento?: string | null; cliente?: string | null; }

interface OverrideData {
  corretores: any[];
  equipes: any[];
  feed?: any[];
}

export function PlacarTv({ sessaoId, overrideData }: { sessaoId: string | null; overrideData?: OverrideData }) {
  const isPublic = !!overrideData;
  const rankAuth = useMutiraoRanking(isPublic ? null : sessaoId);
  const rank = isPublic
    ? { data: { corretores: overrideData!.corretores ?? [], equipes: overrideData!.equipes ?? [] } }
    : rankAuth;
  const [relogio, setRelogio] = useState(new Date());
  const [feed, setFeed] = useState<FeedItem[]>(() =>
    (overrideData?.feed ?? []).map((f: any) => ({
      corretor: f.corretor, hora: f.hora, tipo: f.tipo, cliente: f.cliente, empreendimento: f.empreendimento,
    }))
  );
  const [announcement, setAnnouncement] = useState<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevPontosRef = useRef<Record<string, number>>({});
  const [flashCorretor, setFlashCorretor] = useState<string | null>(null);
  const [meta, setMeta] = useState(() => {
    const s = typeof window !== "undefined" ? Number(localStorage.getItem("placar_tv_meta_mutirao")) : NaN;
    return Number.isFinite(s) && s > 0 ? s : DEFAULT_META_EMPRESA;
  });
  const isAdminMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "true";


  function tocarSom(tipo: "visita" | "aproveitado" = "visita") {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current!;
      const gain = ctx.createGain(); gain.connect(ctx.destination);
      const visita = tipo === "visita";
      gain.gain.setValueAtTime(visita ? 0.4 : 0.28, ctx.currentTime);
      const notas = visita ? [523, 659, 784, 1047, 1319, 1568, 2093] : [523, 784, 1047];
      const passo = visita ? 0.1 : 0.1;
      const dur = visita ? 0.18 : 0.14;
      notas.forEach((f, i) => {
        const osc = ctx.createOscillator(); osc.connect(gain);
        osc.frequency.value = f; osc.type = visita ? "triangle" : "sine";
        osc.start(ctx.currentTime + i * passo); osc.stop(ctx.currentTime + i * passo + dur);
      });
    } catch {}
  }

  useEffect(() => {
    const iv = setInterval(() => setRelogio(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Realtime: só no modo autenticado (público usa polling da RPC)
  useEffect(() => {
    if (isPublic || !sessaoId) return;
    const ch = supabase
      .channel(`placar-tv-mutirao-${sessaoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "oferta_ativa_ligacoes", filter: `sessao_id=eq.${sessaoId}` },
        async (payload: any) => {
          const row = payload.new;
          if (row.resultado !== "visita_agendada" && row.resultado !== "aproveitado") return;
          const corretores = rank.data?.corretores ?? [];
          const corr = corretores.find((c: any) => c.corretor_id === row.corretor_id);
          const nomeCompleto = corr?.nome ?? "Corretor";
          const primeiroNome = nomeCompleto.split(" ")[0];

          let empreendimento: string | null = null; let cliente: string | null = null;
          if (row.resultado === "visita_agendada") {
            const { data: v } = await supabase.from("visitas").select("empreendimento, nome_cliente").eq("pipeline_lead_id", row.pipeline_lead_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
            empreendimento = v?.empreendimento ?? null; cliente = v?.nome_cliente ?? null;
          }

          const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
          setFeed((prev) => [{ corretor: primeiroNome, hora, tipo: row.resultado, empreendimento, cliente }, ...prev].slice(0, 12));

          setAnnouncement({ nome: primeiroNome, cliente, empreendimento, tipo: row.resultado, cor: equipeStyle(corr?.equipe, 0).cor, key: Date.now() });
          tocarSom(row.resultado === "visita_agendada" ? "visita" : "aproveitado");
          setFlashCorretor(row.corretor_id);
          setTimeout(() => setAnnouncement(null), 4200);
          setTimeout(() => setFlashCorretor(null), 2000);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isPublic, sessaoId, rank.data]);

  // Modo público: sincroniza feed vindo da RPC e dispara celebração para novas conquistas
  const prevFeedKeysRef = useRef<Set<string>>(new Set((overrideData?.feed ?? []).map((f: any) => `${f.corretor_id}-${f.created_at}`)));
  useEffect(() => {
    if (!isPublic || !overrideData?.feed) return;
    const items: FeedItem[] = overrideData.feed.map((f: any) => ({
      corretor: f.corretor, hora: f.hora, tipo: f.tipo, cliente: f.cliente, empreendimento: f.empreendimento,
    }));
    setFeed(items);
    // Detecta novas entradas para tocar som + celebração
    const currentKeys = new Set<string>();
    const novos: any[] = [];
    for (const f of overrideData.feed) {
      const k = `${f.corretor_id}-${f.created_at}`;
      currentKeys.add(k);
      if (!prevFeedKeysRef.current.has(k)) novos.push(f);
    }
    if (prevFeedKeysRef.current.size > 0 && novos.length > 0) {
      const f = novos[0];
      const corr = (overrideData.corretores ?? []).find((c: any) => c.corretor_id === f.corretor_id);
      setAnnouncement({ nome: f.corretor, cliente: f.cliente, empreendimento: f.empreendimento, tipo: f.tipo, cor: equipeStyle(corr?.equipe, 0).cor, key: Date.now() });
      tocarSom(f.tipo === "visita_agendada" ? "visita" : "aproveitado");
      setFlashCorretor(f.corretor_id);
      setTimeout(() => setAnnouncement(null), 4200);
      setTimeout(() => setFlashCorretor(null), 2000);
    }
    prevFeedKeysRef.current = currentKeys;
  }, [isPublic, overrideData]);

  // Detecta subida de pontos p/ animar
  useEffect(() => {
    const corretores = rank.data?.corretores ?? [];
    corretores.forEach((c: any) => {
      const prev = prevPontosRef.current[c.corretor_id];
      if (prev !== undefined && c.pontos > prev) {
        setFlashCorretor(c.corretor_id);
        setTimeout(() => setFlashCorretor(null), 1500);
      }
      prevPontosRef.current[c.corretor_id] = c.pontos;
    });
  }, [rank.data]);


  const equipes = (rank.data?.equipes ?? []).slice().sort((a: any, b: any) => b.visitas - a.visitas || b.pontos - a.pontos);
  const corretores = (rank.data?.corretores ?? []).slice().sort((a: any, b: any) => b.pontos - a.pontos);
  const totalVisitas = corretores.reduce((s: number, c: any) => s + (c.visitas ?? 0), 0);
  const totalLigacoes = corretores.reduce((s: number, c: any) => s + (c.ligacoes ?? 0), 0);
  const totalPontos = corretores.reduce((s: number, c: any) => s + (c.pontos ?? 0), 0);
  const metaBatida = totalVisitas >= meta;
  const medalhas = ["🥇", "🥈", "🥉", "4º", "5º"];
  const liderEquipe = equipes[0];

  const handleMetaChange = (v: number) => {
    const n = Math.max(1, v || 1);
    setMeta(n);
    localStorage.setItem("placar_tv_meta_mutirao", String(n));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(0.8)} }
        @keyframes cardPulse { 0%{transform:scale(1)} 25%{transform:scale(1.03)} 50%{transform:scale(1)} 75%{transform:scale(1.02)} 100%{transform:scale(1)} }
        @keyframes metaPulse { 0%,100%{opacity:1;text-shadow:0 0 10px currentColor} 50%{opacity:.7;text-shadow:0 0 30px currentColor} }
        @keyframes slideDown { 0%{opacity:0;transform:translateY(-20px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100% { box-shadow: 0 0 20px var(--glow-color, #9333EA66); } 50% { box-shadow: 0 0 50px var(--glow-color-strong, #9333EAcc); } }
        @keyframes festaBg { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes announceIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
          25% { transform: translate(-50%, -50%) scale(1); }
          85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
        @keyframes announceBackdrop { 0%{opacity:0} 12%{opacity:1} 88%{opacity:1} 100%{opacity:0} }
        @keyframes rowFlash { 0%,100% { background: transparent } 30% { background: rgba(245,158,11,0.28) } }
        * { box-sizing: border-box; }
        .card-pulse { animation: cardPulse 0.6s ease-out; }
        .glow-leader { animation: glowPulse 2s ease-in-out infinite; }
        .festa-card { background-size: 200% 200% !important; animation: festaBg 3s ease infinite !important; }
        .row-flash { animation: rowFlash 1.5s ease-out; }
      `}</style>

      <div style={{
        height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column",
        background: "linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #0a0a1a 100%)",
        fontFamily: "'Bebas Neue', 'Impact', sans-serif", color: "#fff", position: "relative",
      }}>
        <Confetti active={metaBatida} />

        {/* Anúncio no meio */}
        {announcement && (() => {
          const visita = announcement.tipo === "visita_agendada";
          const cor = announcement.cor || "#F59E0B";
          const detalhe = [announcement.cliente, announcement.empreendimento].filter(Boolean).join(" · ");
          return (
            <div key={announcement.key} style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #000000cc 0%, #000000e6 100%)", animation: "announceBackdrop 4s ease forwards" }} />
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                animation: "announceIn 4s ease forwards", textAlign: "center",
                padding: "40px 64px", borderRadius: 28,
                background: `linear-gradient(135deg, ${cor}22, #0d0d20, ${cor}11)`,
                border: `3px solid ${cor}`,
                boxShadow: `0 0 ${visita ? 120 : 80}px ${cor}${visita ? "cc" : "88"}, inset 0 0 60px ${cor}22`,
                maxWidth: "90vw",
              }}>
                <div style={{ fontSize: "clamp(28px, 4vw, 52px)", letterSpacing: 6, color: cor, textTransform: "uppercase", fontWeight: 900, textShadow: `0 0 30px ${cor}`, marginBottom: 8 }}>
                  {visita ? "🎯 Visita Marcada" : "⚡ Aproveitou o Lead"}
                </div>
                <div style={{ fontSize: "clamp(56px, 10vw, 140px)", lineHeight: 1, letterSpacing: 2, color: "#fff", textTransform: "uppercase", fontWeight: 900, textShadow: `0 0 50px ${cor}aa` }}>
                  {announcement.nome}
                </div>
                {detalhe && (
                  <div style={{ fontSize: "clamp(14px, 2vw, 24px)", letterSpacing: 3, color: "#ffffffbb", marginTop: 14, fontFamily: "monospace", textTransform: "uppercase" }}>
                    {detalhe}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Header */}
        <div style={{ textAlign: "center", padding: "8px 24px 6px", borderBottom: "1px solid #ffffff14", flexShrink: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#ffffff44", fontFamily: "monospace", marginBottom: 2 }}>
            UHOME NEGÓCIOS IMOBILIÁRIOS · MUTIRÃO INTELIGENTE
          </div>
          <h1 style={{
            fontSize: "clamp(20px, 3.5vw, 40px)", letterSpacing: 4, margin: 0, lineHeight: 1.1,
            background: "linear-gradient(90deg, #F59E0B, #EF4444, #9333EA)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase",
          }}>⚡ Mutirão Ao Vivo ⚡</h1>
          <p style={{ fontSize: "clamp(8px, 1vw, 11px)", letterSpacing: 6, color: "#ffffff55", margin: "2px 0 0", textTransform: "uppercase", fontFamily: "monospace", display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
            <span>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}</span>
            <span style={{ color: "#F59E0B", fontSize: "clamp(10px, 1.3vw, 16px)", fontWeight: 700, letterSpacing: 2 }}>{formatTime(relogio)}</span>
          </p>
        </div>

        {/* KPIs + Meta */}
        <div style={{ padding: "6px 24px 8px", background: "#ffffff06", borderBottom: "1px solid #ffffff14", flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 12, alignItems: "center" }}>
          <KPI label="Ligações" value={totalLigacoes} cor="#0EA5E9" />
          <KPI label="Visitas hoje" value={totalVisitas} cor={metaBatida ? "#22c55e" : "#F59E0B"} big />
          <KPI label="Pontos totais" value={totalPontos} cor="#9333EA" />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontSize: 10, letterSpacing: 2, color: "#ffffff77", textTransform: "uppercase", fontFamily: "monospace" }}>
              <span>🎯 Meta do mutirão</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: metaBatida ? "#22c55e" : "#F59E0B", fontFamily: "'Bebas Neue', sans-serif" }}>{totalVisitas}</span>
                <span style={{ color: "#ffffff55" }}>/</span>
                {isAdminMode ? (
                  <input type="number" value={meta} onChange={(e) => handleMetaChange(Number(e.target.value))} style={{ width: 60, background: "transparent", border: "1px solid #ffffff33", borderRadius: 6, color: "#fff", padding: "2px 8px", fontSize: 14, fontFamily: "'Bebas Neue', sans-serif" }} />
                ) : (
                  <span style={{ fontSize: 22, fontWeight: 900, color: metaBatida ? "#22c55e" : "#F59E0B", fontFamily: "'Bebas Neue', sans-serif" }}>{meta}</span>
                )}
              </div>
            </div>
            <ProgressBar valor={totalVisitas} meta={meta} cor={metaBatida ? "#22c55e" : "#F59E0B"} />
            {metaBatida && (
              <div style={{ textAlign: "center", marginTop: 4, fontSize: 14, letterSpacing: 3, color: "#22c55e", animation: "metaPulse 1.5s infinite", fontWeight: 900 }}>
                🎉 META BATIDA!
              </div>
            )}
          </div>
        </div>

        {/* Corpo: Esquerda (equipes horizontais) + Direita (ranking corretores) */}
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 12, padding: "10px 20px 6px", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* Esquerda: 3 equipes empilhadas em linhas horizontais */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
            {equipes.length === 0 && (
              <div style={{ color: "#ffffff33", fontSize: 14, fontFamily: "monospace", textAlign: "center", marginTop: 40 }}>Aguardando equipes…</div>
            )}
            {equipes.slice(0, 3).map((e: any, i: number) => {
              const st = equipeStyle(e.equipe, i);
              const isLider = liderEquipe && e.equipe === liderEquipe.equipe && e.visitas > 0;
              const bateuMeta = e.visitas >= META_EQUIPE;
              const pct = Math.min((e.visitas / META_EQUIPE) * 100, 100);
              // Foto do líder da equipe (primeiro corretor daquela equipe no ranking)
              const lider = corretores.find((c: any) => c.equipe === e.equipe);
              return (
                <div key={e.equipe ?? i} className={[isLider ? "glow-leader" : "", bateuMeta ? "festa-card" : ""].filter(Boolean).join(" ")} style={{
                  "--glow-color": `${st.cor}66`, "--glow-color-strong": `${st.cor}cc`,
                  flex: 1, minHeight: 0,
                  background: bateuMeta ? `linear-gradient(135deg, ${st.cor}33, #0d0d20, ${st.cor}22)` : `linear-gradient(90deg, ${st.cor}22 0%, #0d0d20 40%)`,
                  border: `2px solid ${st.cor}66`,
                  borderRadius: 16, padding: "10px 16px", position: "relative", overflow: "hidden",
                  display: "grid", gridTemplateColumns: "auto auto 1fr auto auto auto 1.2fr", alignItems: "center", gap: 14,
                  boxShadow: bateuMeta ? `0 0 30px ${st.cor}66` : `0 0 20px ${st.cor}22`,
                } as any}>
                  {/* Rank badge grande */}
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(48px, 6vw, 88px)", lineHeight: 0.85, color: st.cor, textShadow: `0 0 30px ${st.cor}aa`, minWidth: 60, textAlign: "center" }}>
                    {i + 1}<span style={{ fontSize: "0.4em", verticalAlign: "super" }}>º</span>
                  </div>
                  {/* Escudo da equipe */}
                  <div style={{ width: 68, height: 68, borderRadius: 14, background: `linear-gradient(135deg, ${st.cor}55, ${st.cor}22)`, border: `3px solid ${st.cor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: `0 0 20px ${st.cor}66` }}>
                    {st.emoji}
                  </div>
                  {/* Nome da equipe + tamanho */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: 4, color: "#ffffff77", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 2 }}>
                      Equipe
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(26px, 3.2vw, 46px)", letterSpacing: 2, color: st.cor, lineHeight: 1, textShadow: `0 0 20px ${st.cor}66`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "uppercase" }}>
                      {e.equipe ?? "—"}
                    </div>
                    <div style={{ fontSize: 10, letterSpacing: 2, color: "#ffffff66", textTransform: "uppercase", fontFamily: "monospace", marginTop: 3 }}>
                      {e.corretores ?? 0} corretor{(e.corretores ?? 0) === 1 ? "" : "es"}
                    </div>
                  </div>
                  {/* Stats: Ligações */}
                  <Stat label="Ligações" value={e.ligacoes} icon="📞" cor={st.cor} />
                  {/* Stats: Aprovações (aproveitamentos) */}
                  <Stat label="Aprovações" value={e.aproveitamentos} icon="✅" cor={st.cor} />
                  {/* Stats: Pontos */}
                  <Stat label="Pontos" value={e.pontos} icon="🏆" cor="#F59E0B" />
                  {/* Progresso da meta */}
                  <div style={{ minWidth: 120 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, letterSpacing: 2, color: "#ffffff77", textTransform: "uppercase", fontFamily: "monospace" }}>Progresso da meta</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: bateuMeta ? "#22c55e" : st.cor, lineHeight: 1 }}>{Math.round(pct)}%</span>
                    </div>
                    <ProgressBar valor={e.visitas} meta={META_EQUIPE} cor={bateuMeta ? "#22c55e" : st.cor} />
                    <div style={{ fontSize: 9, color: "#ffffff55", fontFamily: "monospace", letterSpacing: 1, marginTop: 3, textAlign: "right" }}>
                      {bateuMeta ? "✅ META BATIDA" : `${e.visitas} DE ${META_EQUIPE} VISITAS`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Direita: Ranking dos Corretores */}
          <div style={{ background: "#0a0a18", border: "1px solid #ffffff14", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <div style={{ fontSize: "clamp(13px, 1.4vw, 17px)", letterSpacing: 4, textTransform: "uppercase", color: "#F59E0B", marginBottom: 10, textAlign: "center", fontWeight: 900, flexShrink: 0, textShadow: "0 0 20px #F59E0B66" }}>
              🏅 Ranking dos Corretores
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 5 }}>
              {corretores.length === 0 && (
                <div style={{ color: "#ffffff33", fontSize: 12, fontFamily: "monospace", textAlign: "center", marginTop: 20 }}>Aguardando corretores…</div>
              )}
              {corretores.slice(0, 8).map((c: any, i: number) => {
                const st = equipeStyle(c.equipe, i);
                const isFlash = flashCorretor === c.corretor_id;
                return (
                  <div key={c.corretor_id} className={isFlash ? "row-flash" : ""} style={{
                    display: "grid", gridTemplateColumns: "36px 40px 1fr auto", alignItems: "center", gap: 10,
                    padding: "6px 10px", borderRadius: 10,
                    background: i === 0 ? "#1a1400" : "#0d0d14",
                    border: `1px solid ${i === 0 ? "#F59E0B66" : st.cor + "22"}`,
                  }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: i === 0 ? "#F59E0B" : "#ffffff88", textAlign: "center", lineHeight: 1 }}>
                      {i + 1}<span style={{ fontSize: "0.55em", verticalAlign: "super" }}>º</span>
                    </div>
                    {c.foto_url ? (
                      <img src={c.foto_url} alt={c.nome} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `2px solid ${st.cor}` }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: st.cor + "22", border: `2px solid ${st.cor}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: st.cor }}>
                        {(c.nome || "?").slice(0, 1)}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, color: "#fff", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(c.nome || "—").split(" ")[0].toUpperCase()}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 9, color: st.cor, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
                        Equipe {c.equipe ?? "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 50 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1, color: "#F59E0B", textShadow: "0 0 15px #F59E0B66" }}>{c.pontos}</div>
                      <div style={{ fontSize: 8, letterSpacing: 2, color: "#ffffff55", fontFamily: "monospace" }}>PONTOS</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Últimas Conquistas — faixa horizontal na base */}
        <div style={{ padding: "6px 20px 10px", flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto repeat(4, 1fr)", gap: 10, background: "#0a0a18", border: "1px solid #ffffff14", borderRadius: 14, padding: "10px 14px", alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: 14, borderRight: "1px solid #ffffff14", minWidth: 130 }}>
              <div style={{ fontSize: "clamp(13px, 1.4vw, 18px)", letterSpacing: 3, color: "#F59E0B", textTransform: "uppercase", fontWeight: 900, textShadow: "0 0 20px #F59E0B66", lineHeight: 1 }}>Últimas</div>
              <div style={{ fontSize: "clamp(13px, 1.4vw, 18px)", letterSpacing: 3, color: "#F59E0B", textTransform: "uppercase", fontWeight: 900, textShadow: "0 0 20px #F59E0B66", lineHeight: 1 }}>Conquistas</div>
              <div style={{ fontSize: 22, marginTop: 4 }}>🏆</div>
            </div>
            {feed.length === 0 && (
              <div style={{ gridColumn: "span 4", color: "#ffffff33", fontSize: 12, fontFamily: "monospace", textAlign: "center", alignSelf: "center" }}>Nenhuma conquista ainda — bora fechar!</div>
            )}
            {feed.slice(0, 4).map((v, i) => {
              const visita = v.tipo === "visita_agendada";
              const cor = visita ? "#22c55e" : "#F59E0B";
              const corr = corretores.find((c: any) => (c.nome || "").split(" ")[0] === v.corretor);
              const st = equipeStyle(corr?.equipe, i);
              return (
                <div key={`${v.corretor}-${v.hora}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "4px 6px",
                  borderLeft: i === 0 ? `3px solid ${cor}` : "3px solid transparent",
                  animation: i === 0 ? "slideDown 0.4s ease-out" : "none",
                }}>
                  {corr?.foto_url ? (
                    <img src={corr.foto_url} alt={v.corretor} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: `2px solid ${st.cor}` }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: st.cor + "22", border: `2px solid ${st.cor}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: st.cor, flexShrink: 0 }}>
                      {(v.corretor || "?").slice(0, 1)}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, color: st.cor, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {(v.corretor || "").toUpperCase()}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#ffffffbb", letterSpacing: 1, textTransform: "uppercase", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {visita ? "Marcou uma visita" : "Aproveitou um lead"}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: cor, letterSpacing: 1, marginTop: 2, fontWeight: 700 }}>
                      {v.hora}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "2px 24px 6px", color: "#ffffff33", fontSize: 9, fontFamily: "monospace", letterSpacing: 2, flexShrink: 0 }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#22c55e", marginRight: 6, animation: "pulse 1.5s infinite" }} />
          AO VIVO · MUTIRÃO INTELIGENTE · {corretores.length} CORRETOR{corretores.length === 1 ? "" : "ES"} NO PLACAR
        </div>
      </div>
    </>
  );
}

function KPI({ label, value, cor, big }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 8px", borderRight: "1px solid #ffffff10" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: "#ffffff55", textTransform: "uppercase", fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: big ? "clamp(32px, 4.5vw, 48px)" : "clamp(24px, 3.5vw, 36px)", fontWeight: 900, color: cor, lineHeight: 1, textShadow: `0 0 20px ${cor}66`, fontFamily: "'Bebas Neue', sans-serif" }}>
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, cor }: any) {
  return (
    <div style={{ textAlign: "center", minWidth: 74, padding: "0 6px", borderLeft: "1px solid #ffffff10" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(24px, 2.6vw, 38px)", color: cor, lineHeight: 1, textShadow: `0 0 15px ${cor}66` }}>{value}</span>
      </div>
      <div style={{ fontSize: 9, letterSpacing: 2, color: "#ffffff77", textTransform: "uppercase", fontFamily: "monospace", marginTop: 3 }}>{label}</div>
    </div>
  );
}
