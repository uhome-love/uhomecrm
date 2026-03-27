// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const META_VISITAS = 50;

const EQUIPES = [
  { nome: "Gabrielle", cor: "#9333EA", corClara: "#F3E8FF", corBorda: "#7C3AED", emoji: "💜", id: "gabrielle" },
  { nome: "Bruno Schuler", cor: "#2563EB", corClara: "#EFF6FF", corBorda: "#1D4ED8", emoji: "💙", id: "bruno" },
  { nome: "Gabriel", cor: "#16A34A", corClara: "#F0FDF4", corBorda: "#15803D", emoji: "💚", id: "gabriel" },
];

function formatTime(d) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getHoje() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tocarSom() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

function Confetti({ active }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -10,
      vy: 2 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 2,
      size: 6 + Math.random() * 8,
      color: ["#9333EA", "#2563EB", "#16A34A", "#F59E0B", "#EF4444"][Math.floor(Math.random() * 5)],
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 6,
    }));
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotV;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
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
  const [gestores, setGestores] = useState({});
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const prevTotais = useRef({});
  const [flashEquipe, setFlashEquipe] = useState(null);
  const [floatEquipe, setFloatEquipe] = useState(null);
  const hoje = getHoje();

  async function carregar() {
    try {
      const { data: gestoresData, error: gErr } = await supabase
        .from("profiles")
        .select("id,nome,user_id")
        .eq("cargo", "gestor");
      if (gErr) throw gErr;

      const { data: membros, error: mErr } = await supabase
        .from("team_members")
        .select("user_id,gerente_id,nome")
        .eq("status", "ativo");
      if (mErr) throw mErr;

      const gestorNomes = {};
      const gestorMap = {};
      (gestoresData || []).forEach((g) => {
        gestorNomes[g.id] = g.nome;
        gestorMap[g.id] = [];
      });
      (membros || []).forEach((m) => {
        if (m.gerente_id && gestorMap[m.gerente_id] !== undefined && m.user_id) {
          gestorMap[m.gerente_id].push(m.user_id);
        }
      });
      setGestores(gestorNomes);

      const equipeIds = { gabrielle: [], bruno: [], gabriel: [] };
      Object.entries(gestorNomes).forEach(([gid, gnome]) => {
        const n = (gnome || "").toLowerCase();
        if (n.includes("gabrielle")) equipeIds.gabrielle = gestorMap[gid] || [];
        else if (n.includes("bruno")) equipeIds.bruno = gestorMap[gid] || [];
        else if (n.includes("gabriel") && !n.includes("gabrielle")) equipeIds.gabriel = gestorMap[gid] || [];
      });

      const inicioHoje = `${hoje}T00:00:00`;
      const fimHoje = `${hoje}T23:59:59`;

      const novosDados = {};
      for (const [key, userIds] of Object.entries(equipeIds)) {
        if (userIds.length === 0) {
          novosDados[key] = [];
          continue;
        }
        const { data: visitas, error: vErr } = await supabase
          .from("visitas")
          .select("id,corretor_id,created_at,status")
          .in("corretor_id", userIds)
          .gte("created_at", inicioHoje)
          .lte("created_at", fimHoje);
        if (vErr) throw vErr;
        novosDados[key] = visitas || [];
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

      setDados(novosDados);
      setUltimaAtualizacao(new Date());
      setLoading(false);
      setErro(null);
    } catch (e) {
      setErro(e.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 30000);
    return () => clearInterval(interval);
  }, []);

  const totais = {
    gabrielle: dados.gabrielle.length,
    bruno: dados.bruno.length,
    gabriel: dados.gabriel.length,
  };

  const totalGeral = totais.gabrielle + totais.bruno + totais.gabriel;
  const algumaBateu = Object.values(totais).some((t) => t >= META_VISITAS);

  // Ranking individual
  const [ranking, setRanking] = useState([]);
  useEffect(() => {
    async function buscarRanking() {
      try {
        const inicioHoje = `${hoje}T00:00:00`;
        const fimHoje = `${hoje}T23:59:59`;
        const { data: visitas, error: vErr } = await supabase
          .from("visitas")
          .select("corretor_id")
          .gte("created_at", inicioHoje)
          .lte("created_at", fimHoje);
        if (vErr || !visitas) return;

        const contagemPorUser = {};
        visitas.forEach((v) => {
          contagemPorUser[v.corretor_id] = (contagemPorUser[v.corretor_id] || 0) + 1;
        });

        const userIds = Object.keys(contagemPorUser);
        if (userIds.length === 0) { setRanking([]); return; }

        const { data: members } = await supabase
          .from("team_members")
          .select("user_id,nome")
          .in("user_id", userIds);

        const nomeMap = {};
        (members || []).forEach((m) => { if (m.user_id) nomeMap[m.user_id] = m.nome; });

        const sorted = Object.entries(contagemPorUser)
          .map(([uid, count]) => ({ nome: nomeMap[uid] || uid.slice(0, 8), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((item, i) => ({ ...item, pos: i + 1 }));
        setRanking(sorted);
      } catch (_) {}
    }
    buscarRanking();
    const iv = setInterval(buscarRanking, 30000);
    return () => clearInterval(iv);
  }, [hoje]);

  const medalhas = ["🥇", "🥈", "🥉"];
  const ordemEquipes = [...EQUIPES].sort((a, b) => totais[b.id] - totais[a.id]);

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
        @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .card-pulse { animation: cardPulse 0.6s ease-out; }
        .float-up { animation: floatUp 1.5s ease-out forwards; pointer-events: none; }
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
        <Confetti active={algumaBateu} />

        {/* Header */}
        <div style={{ textAlign: "center", padding: "12px 24px 8px", borderBottom: "1px solid #ffffff14", flexShrink: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#ffffff44", fontFamily: "monospace", marginBottom: 4 }}>
            UHOME NEGÓCIOS IMOBILIÁRIOS
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 56px)",
            letterSpacing: 4,
            margin: 0,
            background: "linear-gradient(90deg, #F59E0B, #EF4444, #9333EA)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textTransform: "uppercase",
          }}>⚡ Fechamento Day ⚡</h1>
          <p style={{
            fontSize: "clamp(10px, 1.3vw, 14px)",
            letterSpacing: 6,
            color: "#ffffff55",
            margin: "2px 0 0",
            textTransform: "uppercase",
            fontFamily: "monospace",
            fontWeight: 400,
          }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}TOTAL GERAL: {totalGeral} VISITAS
          </p>
        </div>

        {/* Cards das equipes */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          padding: "14px 24px",
          flex: 1,
          minHeight: 0,
        }}>
          {ordemEquipes.map((equipe, posGlobal) => {
            const total = totais[equipe.id];
            const metaBatida = total >= META_VISITAS;
            const isFlash = flashEquipe === equipe.id;
            const isFloat = floatEquipe === equipe.id;
            return (
              <div
                key={equipe.id}
                className={isFlash ? "card-pulse" : ""}
                style={{
                  background: isFlash ? `${equipe.cor}22` : "#0d0d20",
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
                {/* Position badge */}
                <div style={{ position: "absolute", top: 8, right: 10, fontSize: 22, opacity: posGlobal === 0 ? 1 : 0.5 }}>
                  {posGlobal === 0 ? "🥇" : posGlobal === 1 ? "🥈" : "🥉"}
                </div>

                {/* +1 float animation */}
                {isFloat && (
                  <div className="float-up" style={{
                    position: "absolute",
                    top: "30%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 32,
                    fontWeight: 900,
                    color: equipe.cor,
                    zIndex: 5,
                    textShadow: `0 0 20px ${equipe.cor}`,
                  }}>
                    +1 🎯
                  </div>
                )}

                {/* Team name */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>{equipe.emoji}</span>
                  <h2 style={{
                    fontSize: "clamp(16px, 2.5vw, 24px)",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    margin: "0 0 2px",
                    color: equipe.cor,
                  }}>{equipe.nome}</h2>
                </div>

                {/* Count */}
                <div style={{
                  fontSize: "clamp(56px, 9vw, 88px)",
                  fontWeight: 900,
                  color: equipe.cor,
                  lineHeight: 1,
                  letterSpacing: -2,
                  textShadow: `0 0 40px ${equipe.cor}66`,
                  margin: "4px 0",
                }}>{total}</div>

                <div style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  color: "#ffffff55",
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                  marginBottom: 8,
                }}>visitas marcadas hoje</div>

                {/* Progress bar per team */}
                <ProgressBar valor={total} meta={META_VISITAS} cor={equipe.cor} />

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#ffffff44", fontFamily: "monospace", letterSpacing: 1 }}>
                  <span>META: {META_VISITAS}</span>
                  <span>{metaBatida ? "✅ CONCLUÍDA" : `FALTAM: ${META_VISITAS - total}`}</span>
                </div>

                {/* Meta batida indicator */}
                {metaBatida && (
                  <div style={{
                    textAlign: "center",
                    marginTop: 8,
                    fontSize: "clamp(14px, 2vw, 20px)",
                    letterSpacing: 3,
                    color: equipe.cor,
                    animation: "metaPulse 1.5s infinite",
                    fontWeight: 900,
                  }}>
                    🏆 META BATIDA!
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Ranking individual */}
        {ranking.length > 0 && (
          <div style={{ padding: "4px 24px 6px", flexShrink: 0 }}>
            <div style={{
              fontSize: "clamp(12px, 1.8vw, 16px)",
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#ffffff77",
              marginBottom: 6,
              textAlign: "center",
            }}>🏅 Top 3 corretores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {ranking.map((c, i) => (
                <div key={c.nome} style={{
                  background: i === 0 ? "#1a1400" : i === 1 ? "#0d0d14" : "#0a100a",
                  border: `1px solid ${i === 0 ? "#F59E0B44" : i === 1 ? "#9CA3AF44" : "#16A34A44"}`,
                  borderRadius: 10,
                  padding: "8px 6px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 22 }}>{medalhas[i]}</div>
                  <div style={{
                    fontSize: "clamp(20px, 3vw, 32px)",
                    fontWeight: 900,
                    color: i === 0 ? "#F59E0B" : i === 1 ? "#9CA3AF" : "#16A34A",
                    lineHeight: 1,
                  }}>{c.count}</div>
                  <div style={{
                    fontSize: "clamp(9px, 1.1vw, 12px)",
                    color: "#ffffffcc",
                    marginTop: 2,
                    fontFamily: "monospace",
                    letterSpacing: 1,
                    wordBreak: "break-word",
                  }}>{c.nome}</div>
                </div>
              ))}
            </div>
          </div>
        )}

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
          AO VIVO · ATUALIZA A CADA 30S
          {ultimaAtualizacao && ` · ${formatTime(ultimaAtualizacao)}`}
        </div>
      </div>
    </>
  );
}
