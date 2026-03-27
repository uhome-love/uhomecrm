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

function ProgressBar({ valor, meta, cor }) {
  const pct = Math.min((valor / meta) * 100, 100);
  return (
    <div style={{ background: "#1e1e2e", borderRadius: 99, height: 20, overflow: "hidden", position: "relative" }}>
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
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 11,
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
  const hoje = getHoje();

  async function carregar() {
    try {
      // 1. Buscar gestores em profiles
      const { data: gestoresData, error: gErr } = await supabase
        .from("profiles")
        .select("id,nome,user_id")
        .eq("cargo", "gestor");
      if (gErr) throw gErr;

      // 2. Buscar corretores ativos em team_members
      const { data: membros, error: mErr } = await supabase
        .from("team_members")
        .select("user_id,gerente_id,nome")
        .eq("status", "ativo");
      if (mErr) throw mErr;

      // 3. Monta mapa: gestor profile_id -> nome e user_ids dos corretores
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

      // 4. Identifica equipes pelo nome do gestor
      const equipeIds = { gabrielle: [], bruno: [], gabriel: [] };
      Object.entries(gestorNomes).forEach(([gid, gnome]) => {
        const n = (gnome || "").toLowerCase();
        if (n.includes("gabrielle")) equipeIds.gabrielle = gestorMap[gid] || [];
        else if (n.includes("bruno")) equipeIds.bruno = gestorMap[gid] || [];
        else if (n.includes("gabriel") && !n.includes("gabrielle")) equipeIds.gabriel = gestorMap[gid] || [];
      });

      // 5. Buscar visitas do dia para cada equipe
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
          .select("id,corretor_id,data_visita,status")
          .in("corretor_id", userIds)
          .gte("data_visita", inicioHoje)
          .lte("data_visita", fimHoje);
        if (vErr) throw vErr;
        novosDados[key] = visitas || [];
      }

      // Detecta nova visita (flash)
      for (const key of Object.keys(novosDados)) {
        const novoTotal = novosDados[key].length;
        if (prevTotais.current[key] !== undefined && novoTotal > prevTotais.current[key]) {
          setFlashEquipe(key);
          setTimeout(() => setFlashEquipe(null), 1500);
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
  const metaAtingida = totalGeral >= META_VISITAS;

  // Ranking individual de corretores (top 3)
  const [ranking, setRanking] = useState([]);
  useEffect(() => {
    async function buscarRanking() {
      try {
        const inicioHoje = `${hoje}T00:00:00`;
        const fimHoje = `${hoje}T23:59:59`;

        // Buscar todas as visitas do dia
        const { data: visitas, error: vErr } = await supabase
          .from("visitas")
          .select("corretor_id")
          .gte("data_visita", inicioHoje)
          .lte("data_visita", fimHoje);
        if (vErr || !visitas) return;

        // Contar por corretor_id (user_id)
        const contagemPorUser = {};
        visitas.forEach((v) => {
          contagemPorUser[v.corretor_id] = (contagemPorUser[v.corretor_id] || 0) + 1;
        });

        // Buscar nomes dos corretores via team_members
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

  const styles = {
    root: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #0a0a1a 100%)",
      fontFamily: "'Bebas Neue', 'Impact', sans-serif",
      color: "#fff",
      padding: 0,
      margin: 0,
    },
    header: {
      textAlign: "center",
      padding: "32px 24px 16px",
      borderBottom: "1px solid #ffffff14",
      position: "relative",
    },
    titulo: {
      fontSize: "clamp(36px, 6vw, 72px)",
      letterSpacing: 4,
      margin: 0,
      background: "linear-gradient(90deg, #F59E0B, #EF4444, #9333EA)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      textTransform: "uppercase",
    },
    subtitulo: {
      fontSize: "clamp(14px, 2vw, 20px)",
      letterSpacing: 8,
      color: "#ffffff66",
      margin: "4px 0 0",
      textTransform: "uppercase",
      fontFamily: "monospace",
      fontWeight: 400,
    },
    metaBar: {
      padding: "16px 32px",
      background: "#ffffff08",
      borderBottom: "1px solid #ffffff14",
    },
    metaLabel: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      fontSize: 13,
      letterSpacing: 2,
      color: "#ffffff88",
      textTransform: "uppercase",
      fontFamily: "monospace",
    },
    totalNum: {
      fontSize: "clamp(28px, 5vw, 56px)",
      fontWeight: 900,
      color: metaAtingida ? "#22c55e" : "#F59E0B",
      lineHeight: 1,
      letterSpacing: 2,
    },
    equipeGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 16,
      padding: "24px 24px",
    },
    equipeCard: (equipe, flash) => ({
      background: flash === equipe.id ? `${equipe.cor}22` : "#0d0d20",
      border: `2px solid ${flash === equipe.id ? equipe.cor : equipe.corBorda + "44"}`,
      borderRadius: 16,
      padding: "24px",
      transition: "all 0.3s",
      position: "relative",
      overflow: "hidden",
      boxShadow: flash === equipe.id ? `0 0 40px ${equipe.cor}66` : "none",
    }),
    posicaoBadge: (pos) => ({
      position: "absolute",
      top: 12,
      right: 12,
      fontSize: 24,
      opacity: pos === 1 ? 1 : 0.5,
    }),
    equipeNome: {
      fontSize: "clamp(18px, 3vw, 28px)",
      letterSpacing: 2,
      textTransform: "uppercase",
      margin: "0 0 4px",
    },
    equipeCount: (cor) => ({
      fontSize: "clamp(64px, 10vw, 96px)",
      fontWeight: 900,
      color: cor,
      lineHeight: 1,
      letterSpacing: -2,
      textShadow: `0 0 40px ${cor}66`,
      margin: "8px 0",
    }),
    equipeLabel: {
      fontSize: 12,
      letterSpacing: 3,
      color: "#ffffff55",
      textTransform: "uppercase",
      fontFamily: "monospace",
      marginBottom: 12,
    },
    rankingSection: {
      padding: "8px 24px 24px",
    },
    rankingTitle: {
      fontSize: "clamp(16px, 2.5vw, 24px)",
      letterSpacing: 4,
      textTransform: "uppercase",
      color: "#ffffff88",
      marginBottom: 12,
      textAlign: "center",
    },
    rankingGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 12,
    },
    rankingCard: (i) => ({
      background: i === 0 ? "#1a1400" : i === 1 ? "#0d0d14" : "#0a100a",
      border: `1px solid ${i === 0 ? "#F59E0B44" : i === 1 ? "#9CA3AF44" : "#16A34A44"}`,
      borderRadius: 12,
      padding: "16px 12px",
      textAlign: "center",
    }),
    rankingNome: {
      fontSize: "clamp(11px, 1.5vw, 14px)",
      color: "#ffffffcc",
      marginTop: 4,
      fontFamily: "monospace",
      letterSpacing: 1,
      wordBreak: "break-word",
    },
    rankingCount: (i) => ({
      fontSize: "clamp(28px, 4vw, 44px)",
      fontWeight: 900,
      color: i === 0 ? "#F59E0B" : i === 1 ? "#9CA3AF" : "#16A34A",
      lineHeight: 1,
    }),
    footer: {
      textAlign: "center",
      padding: "12px 24px 24px",
      color: "#ffffff33",
      fontSize: 11,
      fontFamily: "monospace",
      letterSpacing: 2,
    },
    pulso: {
      display: "inline-block",
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "#22c55e",
      marginRight: 6,
      animation: "pulse 1.5s infinite",
    },
  };

  if (loading) {
    return (
      <div style={{ ...styles.root, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 24, letterSpacing: 4, color: "#ffffff88" }}>CARREGANDO PLACAR...</div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ ...styles.root, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#EF4444" }}>
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
        @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <div style={styles.root}>
        <Confetti active={metaAtingida} />

        {/* Header */}
        <div style={styles.header}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: "#ffffff44", fontFamily: "monospace", marginBottom: 8 }}>
            UHOME NEGÓCIOS IMOBILIÁRIOS
          </div>
          <h1 style={styles.titulo}>⚡ Fechamento Day ⚡</h1>
          <p style={styles.subtitulo}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Meta geral */}
        <div style={styles.metaBar}>
          <div style={styles.metaLabel}>
            <span>🎯 Meta do dia — visitas marcadas</span>
            <span style={styles.totalNum}>{totalGeral} / {META_VISITAS}</span>
          </div>
          <ProgressBar valor={totalGeral} meta={META_VISITAS} cor={metaAtingida ? "#22c55e" : "#F59E0B"} />
          {metaAtingida && (
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 20, letterSpacing: 4, color: "#22c55e", animation: "flash 1s infinite" }}>
              🎉 META BATIDA! CHURRASCO GARANTIDO! 🎉
            </div>
          )}
        </div>

        {/* Cards das equipes */}
        <div style={styles.equipeGrid}>
          {ordemEquipes.map((equipe, posGlobal) => {
            const total = totais[equipe.id];
            return (
              <div key={equipe.id} style={styles.equipeCard(equipe, flashEquipe)} className="equipe-card">
                <div style={styles.posicaoBadge(posGlobal + 1)}>
                  {posGlobal === 0 ? "🥇" : posGlobal === 1 ? "🥈" : "🥉"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 28 }}>{equipe.emoji}</span>
                  <h2 style={{ ...styles.equipeNome, color: equipe.cor }}>{equipe.nome}</h2>
                </div>
                <div style={styles.equipeCount(equipe.cor)}>{total}</div>
                <div style={styles.equipeLabel}>visitas marcadas hoje</div>
                <ProgressBar valor={total} meta={META_VISITAS} cor={equipe.cor} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#ffffff44", fontFamily: "monospace", letterSpacing: 1 }}>
                  <span>META: {META_VISITAS}</span>
                  <span>FALTAM: {Math.max(META_VISITAS - total, 0)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ranking individual */}
        {ranking.length > 0 && (
          <div style={styles.rankingSection}>
            <div style={styles.rankingTitle}>🏅 Ranking individual — top 3 corretores</div>
            <div style={styles.rankingGrid}>
              {ranking.map((c, i) => (
                <div key={c.nome} style={styles.rankingCard(i)}>
                  <div style={{ fontSize: 28 }}>{medalhas[i]}</div>
                  <div style={styles.rankingCount(i)}>{c.count}</div>
                  <div style={styles.rankingNome}>{c.nome}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.pulso} />
          AO VIVO · ATUALIZA A CADA 30S
          {ultimaAtualizacao && ` · ÚLTIMA ATUALIZAÇÃO: ${formatTime(ultimaAtualizacao)}`}
        </div>
      </div>
    </>
  );
}
