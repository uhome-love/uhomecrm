// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const META_VISITAS = 50;

const EQUIPES = [
  { nome: "Gabrielle", cor: "#9333EA", corClara: "#F3E8FF", corBorda: "#7C3AED", emoji: "💜", id: "gabrielle" },
  { nome: "Bruno Schuler", cor: "#2563EB", corClara: "#EFF6FF", corBorda: "#1D4ED8", emoji: "💙", id: "bruno" },
  { nome: "Gabriel", cor: "#16A34A", corClara: "#F0FDF4", corBorda: "#15803D", emoji: "💚", id: "gabriel" },
];

const GERENTES = [
  { user_id: "7882d73e-ff5c-4b23-9b08-2adeadcd1800", equipe: "gabrielle" },
  { user_id: "fb61ecda-5c4b-49d7-bda7-ccf9b589da07", equipe: "bruno" },
  { user_id: "b3a1c3a4-f109-40ae-b5d4-15eff3a541ab", equipe: "gabriel" },
];

function formatTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getHoje() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function ProgressBar({ valor, meta, cor }) {
  const pct = Math.min((valor / meta) * 100, 100);
  return (
    <div style={{ background: "#1e1e2e", borderRadius: 99, height: 16, overflow: "hidden", position: "relative" }}>
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
      <span
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 10,
          fontWeight: 700,
          color: "#fff",
          textShadow: "0 1px 4px #0008",
          letterSpacing: 0.5,
        }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// Bug 2+3 fix: Confetti recycles particles
function Confetti({ active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!active) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      vy: 2 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 2,
      size: 6 + Math.random() * 8,
      color: ["#9333EA", "#2563EB", "#16A34A", "#F59E0B", "#EF4444"][Math.floor(Math.random() * 5)],
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 6,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotV;
        // Recycle: when particle exits bottom, reset to top
        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }}
    />
  );
}

export default function FechamentoDay() {
  const [dados, setDados] = useState({ gabrielle: [], bruno: [], gabriel: [] });
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const prevTotais = useRef({});
  const [flashEquipe, setFlashEquipe] = useState(null);
  const [floatEquipe, setFloatEquipe] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [relogio, setRelogio] = useState(new Date());
  const [ultimaVisita, setUltimaVisita] = useState({});
  const [ultimasVisitas, setUltimasVisitas] = useState([]);
  const [debugData, setDebugData] = useState(null);

  // Bug 4 fix: single AudioContext via ref
  const audioCtxRef = useRef(null);
  function tocarSom() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      const notas = [523, 659, 784, 1047];
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gainNode);
        osc.frequency.value = freq;
        osc.type = "sine";
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.15);
      });
    } catch (_) {}
  }

  // Melhoria 1: relógio ao vivo
  useEffect(() => {
    const iv = setInterval(() => setRelogio(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Bug 6+7 fix: hoje recalculado a cada chamada, lógica unificada
  const atualizarTudo = useCallback(async () => {
    try {
      const hoje = getHoje();
      const inicioHoje = `${hoje}T00:00:00`;
      const fimHoje = `${hoje}T23:59:59`;

      // Buscar membros ativos
      const { data: membros, error: mErr } = await supabase
        .from("team_members")
        .select("user_id,gerente_id,nome")
        .eq("status", "ativo");
      if (mErr) throw mErr;

      const equipeIds = { gabrielle: [], bruno: [], gabriel: [] };
      const nomeMap = {};
      (membros || []).forEach((m) => {
        const gerente = GERENTES.find(g => g.user_id === m.gerente_id);
        if (gerente && m.user_id) {
          equipeIds[gerente.equipe].push(m.user_id);
        }
        if (m.user_id) nomeMap[m.user_id] = m.nome;
      });

      // Buscar todas as visitas de hoje (para equipes + ranking)
      const allUserIds = Object.values(equipeIds).flat();
      let todasVisitas = [];
      if (allUserIds.length > 0) {
        const { data: visitas, error: vErr } = await supabase
          .from("visitas")
          .select("id,corretor_id,created_at,status")
          .in("corretor_id", allUserIds)
          .gte("created_at", inicioHoje)
          .lte("created_at", fimHoje);
        if (vErr) throw vErr;
        todasVisitas = visitas || [];
      }

      // Separar por equipe
      const novosDados = { gabrielle: [], bruno: [], gabriel: [] };
      const ultimaPorEquipe = {};
      for (const [key, userIds] of Object.entries(equipeIds)) {
        const visitasEquipe = todasVisitas.filter(v => userIds.includes(v.corretor_id));
        novosDados[key] = visitasEquipe;

        // Melhoria 5: última visita por equipe
        if (visitasEquipe.length > 0) {
          const maisRecente = visitasEquipe.reduce((a, b) =>
            new Date(a.created_at) > new Date(b.created_at) ? a : b
          );
          const hora = new Date(maisRecente.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          ultimaPorEquipe[key] = {
            nome: nomeMap[maisRecente.corretor_id] || "—",
            hora,
          };
        }
      }

      // Detecta nova visita (flash + som)
      for (const key of Object.keys(novosDados)) {
        const novoTotal = novosDados[key].length;
        if (prevTotais.current[key] !== undefined && novoTotal > prevTotais.current[key]) {
          setFlashEquipe(key);
          setFloatEquipe(key);
          tocarSom();
          setTimeout(() => setFlashEquipe(null), 2000);
          setTimeout(() => setFloatEquipe(null), 1500);
        }
        prevTotais.current[key] = novoTotal;
      }

      // Ranking individual
      const contagemPorUser = {};
      todasVisitas.forEach((v) => {
        contagemPorUser[v.corretor_id] = (contagemPorUser[v.corretor_id] || 0) + 1;
      });
      const sorted = Object.entries(contagemPorUser)
        .map(([uid, count]) => ({ nome: nomeMap[uid] || uid.slice(0, 8), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((item, i) => ({ ...item, pos: i + 1 }));

      // Feed últimas visitas
      const feedVisitas = [...todasVisitas]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(v => {
          const equipe = Object.entries(equipeIds).find(([, ids]) => ids.includes(v.corretor_id))?.[0];
          return {
            nome: nomeMap[v.corretor_id] || "—",
            hora: new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            equipe,
          };
        });
      setUltimasVisitas(feedVisitas);

      setDebugData({
        hoje,
        totalVisitas: todasVisitas.length,
        porEquipe: {
          gabrielle: novosDados.gabrielle.length,
          bruno: novosDados.bruno.length,
          gabriel: novosDados.gabriel.length,
        },
        primeiraVisita: todasVisitas[0] ?? null,
        ultimaVisitaArr: todasVisitas[todasVisitas.length - 1] ?? null,
        membrosCarregados: {
          gabrielle: equipeIds.gabrielle.length,
          bruno: equipeIds.bruno.length,
          gabriel: equipeIds.gabriel.length,
        },
      });

      setRanking(sorted);
      setDados(novosDados);
      setUltimaVisita(ultimaPorEquipe);
      setUltimaAtualizacao(new Date());
      setLoading(false);
      setErro(null);
    } catch (e) {
      setErro(e.message);
      setLoading(false);
    }
  }, []);

  // Melhoria 7: Realtime + fallback polling
  useEffect(() => {
    atualizarTudo();

    // Fallback polling 30s
    const interval = setInterval(atualizarTudo, 30000);

    // Realtime subscription
    const channel = supabase
      .channel("visitas-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visitas" }, () => {
        atualizarTudo();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [atualizarTudo]);

  const totais = {
    gabrielle: dados.gabrielle.length,
    bruno: dados.bruno.length,
    gabriel: dados.gabriel.length,
  };

  const totalGeral = totais.gabrielle + totais.bruno + totais.gabriel;
  const metaGeralAtingida = totalGeral >= META_VISITAS;

  const medalhas = ["🥇", "🥈", "🥉"];
  const ordemEquipes = [...EQUIPES].sort((a, b) => totais[b.id] - totais[a.id]);
  const liderEquipe = ordemEquipes[0]?.id;

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #0a0a1a 100%)", fontFamily: "'Bebas Neue', 'Impact', sans-serif", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 24, letterSpacing: 4, color: "#ffffff88" }}>CARREGANDO PLACAR...</div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #0a0a1a 100%)", fontFamily: "'Bebas Neue', 'Impact', sans-serif", color: "#EF4444" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>Erro ao carregar dados</div>
          <div style={{ fontSize: 14, fontFamily: "monospace", opacity: 0.7 }}>{erro}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(0.8)} }
        @keyframes cardPulse { 0%{transform:scale(1)} 25%{transform:scale(1.03)} 50%{transform:scale(1)} 75%{transform:scale(1.02)} 100%{transform:scale(1)} }
        @keyframes floatUp { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-60px) scale(1.3)} }
        @keyframes metaPulse { 0%,100%{opacity:1;text-shadow:0 0 10px currentColor} 50%{opacity:.7;text-shadow:0 0 30px currentColor} }
        @keyframes slideDown { 0%{opacity:0;transform:translateY(-20px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 20px var(--glow-color, #9333EA66); }
          50% { box-shadow: 0 0 50px var(--glow-color-strong, #9333EAcc); }
        }
        @keyframes festaBg {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .card-pulse { animation: cardPulse 0.6s ease-out; }
        .float-up { animation: floatUp 1.5s ease-out forwards; pointer-events: none; }
        .glow-leader { animation: glowPulse 2s ease-in-out infinite; }
        .festa-card { background-size: 200% 200% !important; animation: festaBg 3s ease infinite !important; }
      `}</style>
      <div style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #0a0a1a 100%)",
        fontFamily: "'Bebas Neue', 'Impact', sans-serif",
        color: "#fff",
        padding: 0,
        margin: 0,
        position: "relative",
      }}>
        <Confetti active={metaGeralAtingida} />

        {/* Header */}
        <div style={{ textAlign: "center", padding: "10px 24px 6px", borderBottom: "1px solid #ffffff14", flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#ffffff44", fontFamily: "monospace", marginBottom: 2 }}>
            UHOME NEGÓCIOS IMOBILIÁRIOS
          </div>
          <h1 style={{
            fontSize: "clamp(24px, 4vw, 48px)",
            letterSpacing: 4,
            margin: 0,
            background: "linear-gradient(90deg, #F59E0B, #EF4444, #9333EA)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textTransform: "uppercase",
          }}>⚡ Fechamento Day ⚡</h1>
          <p style={{
            fontSize: "clamp(9px, 1.2vw, 13px)",
            letterSpacing: 6,
            color: "#ffffff55",
            margin: "2px 0 0",
            textTransform: "uppercase",
            fontFamily: "monospace",
            fontWeight: 400,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
          }}>
            <span>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
            <span style={{ color: "#F59E0B", fontSize: "clamp(12px, 1.5vw, 18px)", fontWeight: 700, letterSpacing: 2 }}>
              {formatTime(relogio)}
            </span>
          </p>
        </div>

        {/* Meta geral da empresa */}
        <div style={{ padding: "6px 32px 8px", background: "#ffffff06", borderBottom: "1px solid #ffffff14", flexShrink: 0 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
            fontSize: 11,
            letterSpacing: 2,
            color: "#ffffff77",
            textTransform: "uppercase",
            fontFamily: "monospace",
          }}>
            <span>🎯 META DA EMPRESA — VISITAS MARCADAS HOJE</span>
            <span style={{
              fontSize: "clamp(20px, 3vw, 36px)",
              fontWeight: 900,
              color: metaGeralAtingida ? "#22c55e" : "#F59E0B",
              lineHeight: 1,
              letterSpacing: 2,
              fontFamily: "'Bebas Neue', 'Impact', sans-serif",
            }}>{totalGeral} / {META_VISITAS}</span>
          </div>
          <ProgressBar valor={totalGeral} meta={META_VISITAS} cor={metaGeralAtingida ? "#22c55e" : "#F59E0B"} />
          {metaGeralAtingida && (
            <div style={{ textAlign: "center", marginTop: 4, fontSize: "clamp(14px, 2vw, 20px)", letterSpacing: 4, color: "#22c55e", animation: "metaPulse 1.5s infinite", fontWeight: 900 }}>
              🎉 CHURRASCO GARANTIDO! 🎉
            </div>
          )}
        </div>

        {/* DEBUG TEMPORÁRIO */}
        {debugData && (
          <pre style={{
            background: "#000",
            color: "#0f0",
            fontSize: 11,
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
            maxHeight: 200,
            margin: "0 24px",
            flexShrink: 0,
          }}>
            {JSON.stringify(debugData, null, 2)}
          </pre>
        )}

        {/* Main content: Cards + Feed lateral */}
        <div style={{ display: "flex", gap: 14, padding: "14px 24px", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* Left: Cards + Ranking (3/4) */}
          <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
            {/* Cards das equipes */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
              flex: 1,
              minHeight: 0,
            }}>
              {ordemEquipes.map((equipe, posGlobal) => {
                const total = totais[equipe.id];
                const metaBatida = total >= META_VISITAS;
                const isFlash = flashEquipe === equipe.id;
                const isFloat = floatEquipe === equipe.id;
                const isLider = equipe.id === liderEquipe && total > 0;
                const ultima = ultimaVisita[equipe.id];

                return (
                  <div
                    key={equipe.id}
                    className={[
                      isFlash ? "card-pulse" : "",
                      isLider ? "glow-leader" : "",
                      metaBatida ? "festa-card" : "",
                    ].filter(Boolean).join(" ")}
                    style={{
                      "--glow-color": `${equipe.cor}66`,
                      "--glow-color-strong": `${equipe.cor}cc`,
                      background: metaBatida
                        ? `linear-gradient(135deg, ${equipe.cor}33, #0d0d20, ${equipe.cor}22)`
                        : isFlash
                        ? `${equipe.cor}22`
                        : "#0d0d20",
                      border: `2px solid ${isFlash ? equipe.cor : metaBatida ? equipe.cor + "88" : equipe.corBorda + "44"}`,
                      borderRadius: 16,
                      padding: "16px 20px",
                      transition: "all 0.3s",
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: isFlash
                        ? `0 0 50px ${equipe.cor}88, inset 0 0 30px ${equipe.cor}22`
                        : metaBatida
                        ? `0 0 30px ${equipe.cor}44`
                        : "none",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ position: "absolute", top: 8, right: 10, fontSize: 22, opacity: posGlobal === 0 ? 1 : 0.5 }}>
                      {posGlobal === 0 ? "🥇" : posGlobal === 1 ? "🥈" : "🥉"}
                    </div>
                    {isFloat && (
                      <div className="float-up" style={{
                        position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
                        fontSize: 32, fontWeight: 900, color: equipe.cor, zIndex: 5,
                        textShadow: `0 0 20px ${equipe.cor}`,
                      }}>+1 🎯</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{equipe.emoji}</span>
                      <h2 style={{ fontSize: "clamp(16px, 2.5vw, 24px)", letterSpacing: 2, textTransform: "uppercase", margin: "0 0 2px", color: equipe.cor }}>{equipe.nome}</h2>
                    </div>
                    <div style={{ fontSize: "clamp(56px, 9vw, 88px)", fontWeight: 900, color: equipe.cor, lineHeight: 1, letterSpacing: -2, textShadow: `0 0 40px ${equipe.cor}66`, margin: "4px 0" }}>{total}</div>
                    <div style={{ fontSize: 10, letterSpacing: 2, color: "#ffffff55", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6, minHeight: 14 }}>
                      {ultima ? `Última: ${ultima.nome} às ${ultima.hora}` : "visitas marcadas hoje"}
                    </div>
                    <ProgressBar valor={total} meta={META_VISITAS} cor={equipe.cor} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#ffffff44", fontFamily: "monospace", letterSpacing: 1 }}>
                      <span>META: {META_VISITAS}</span>
                      <span>{metaBatida ? "✅ CONCLUÍDA" : `FALTAM: ${META_VISITAS - total}`}</span>
                    </div>
                    {metaBatida && (
                      <div style={{ textAlign: "center", marginTop: 8, fontSize: "clamp(14px, 2vw, 20px)", letterSpacing: 3, color: equipe.cor, animation: "metaPulse 1.5s infinite", fontWeight: 900 }}>
                        🏆 META BATIDA!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ranking individual */}
            {ranking.length > 0 && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "clamp(12px, 1.8vw, 16px)", letterSpacing: 4, textTransform: "uppercase", color: "#ffffff77", marginBottom: 6, textAlign: "center" }}>🏅 Top 3 corretores</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {ranking.map((c, i) => (
                    <div key={c.nome} style={{
                      background: i === 0 ? "#1a1400" : i === 1 ? "#0d0d14" : "#0a100a",
                      border: `1px solid ${i === 0 ? "#F59E0B44" : i === 1 ? "#9CA3AF44" : "#16A34A44"}`,
                      borderRadius: 10, padding: "8px 6px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 22 }}>{medalhas[i]}</div>
                      <div style={{ fontSize: "clamp(20px, 3vw, 32px)", fontWeight: 900, color: i === 0 ? "#F59E0B" : i === 1 ? "#9CA3AF" : "#16A34A", lineHeight: 1 }}>{c.count}</div>
                      <div style={{ fontSize: "clamp(9px, 1.1vw, 12px)", color: "#ffffffcc", marginTop: 2, fontFamily: "monospace", letterSpacing: 1, wordBreak: "break-word" }}>{c.nome}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Feed lateral (1/4) */}
          <div style={{
            flex: 1,
            background: "#0a0a18",
            border: "1px solid #ffffff14",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}>
            <div style={{
              fontSize: "clamp(12px, 1.5vw, 16px)",
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#F59E0B",
              marginBottom: 12,
              textAlign: "center",
              fontWeight: 900,
              flexShrink: 0,
            }}>⚡ ÚLTIMAS VISITAS</div>

            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 6 }}>
              {ultimasVisitas.length === 0 ? (
                <div style={{ color: "#ffffff33", fontSize: 11, fontFamily: "monospace", textAlign: "center", marginTop: 20 }}>
                  Nenhuma visita hoje ainda
                </div>
              ) : (
                ultimasVisitas.map((v, i) => {
                  const corBolinha = v.equipe === "gabrielle" ? "#9333EA" : v.equipe === "bruno" ? "#2563EB" : v.equipe === "gabriel" ? "#16A34A" : "#666";
                  return (
                    <div
                      key={`${v.nome}-${v.hora}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        background: i === 0 ? "#ffffff08" : "transparent",
                        borderRadius: 8,
                        border: i === 0 ? "1px solid #ffffff14" : "1px solid transparent",
                        animation: i === 0 ? "slideDown 0.4s ease-out" : "none",
                        transition: "all 0.3s",
                      }}
                    >
                      {/* Bolinha da equipe */}
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: corBolinha,
                        boxShadow: `0 0 8px ${corBolinha}88`,
                        flexShrink: 0,
                      }} />
                      {/* Nome */}
                      <div style={{
                        flex: 1,
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        color: "#ffffffcc",
                        fontFamily: "monospace",
                        letterSpacing: 0.5,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>{v.nome}</div>
                      {/* Hora */}
                      <div style={{
                        fontSize: "clamp(9px, 1vw, 12px)",
                        color: "#ffffff55",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        letterSpacing: 1,
                        flexShrink: 0,
                      }}>{v.hora}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center",
          padding: "4px 24px 8px",
          color: "#ffffff33",
          fontSize: 9,
          fontFamily: "monospace",
          letterSpacing: 2,
          flexShrink: 0,
        }}>
          <span style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22c55e",
            marginRight: 6,
            animation: "pulse 1.5s infinite",
          }} />
          AO VIVO · REALTIME + POLLING 30S
          {ultimaAtualizacao && ` · ${formatTime(ultimaAtualizacao)}`}
        </div>
      </div>
    </>
  );
}
