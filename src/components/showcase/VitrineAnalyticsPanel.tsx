import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Eye, Heart, MessageCircle, GitCompareArrows, Clock, TrendingUp, MousePointerClick } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  vitrineId: string;
  imovelNames?: Record<string, string>; // imovel_id -> name mapping
}

interface Interacao {
  id: string;
  imovel_id: string;
  tipo: string;
  created_at: string;
  metadata: any;
}

const EVENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  vitrine_opened: { label: "Abriu vitrine", icon: Eye, color: "#3b82f6" },
  card_click: { label: "Clicou no card", icon: MousePointerClick, color: "#6366f1" },
  detail_click: { label: "Viu detalhes", icon: Eye, color: "#8b5cf6" },
  favorite: { label: "Favoritou", icon: Heart, color: "#ef4444" },
  whatsapp_click: { label: "WhatsApp", icon: MessageCircle, color: "#16a34a" },
  compare_add: { label: "Adicionou comparação", icon: GitCompareArrows, color: "#0ea5e9" },
  compare_open: { label: "Abriu comparação", icon: GitCompareArrows, color: "#0ea5e9" },
  schedule_click: { label: "Agendou visita", icon: Clock, color: "#f59e0b" },
  scroll_50: { label: "Scroll 50%", icon: TrendingUp, color: "#64748b" },
  scroll_100: { label: "Scroll 100%", icon: TrendingUp, color: "#64748b" },
  time_on_page: { label: "Tempo na página", icon: Clock, color: "#64748b" },
};

export default function VitrineAnalyticsPanel({ vitrineId, imovelNames = {} }: Props) {
  const [showAll, setShowAll] = useState(false);

  const { data: interacoes = [], isLoading } = useQuery({
    queryKey: ["vitrine-analytics", vitrineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vitrine_interacoes")
        .select("*")
        .eq("vitrine_id", vitrineId)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []) as Interacao[];
    },
  });

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-slate-400">Carregando analytics...</div>;
  }

  if (interacoes.length === 0) {
    return (
      <div className="p-6 text-center rounded-2xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Nenhuma interação registrada ainda.</p>
      </div>
    );
  }

  // Build heatmap: count by imovel
  const heatmap: Record<string, { clicks: number; favorites: number; whatsapp: number; details: number }> = {};
  const eventCounts: Record<string, number> = {};

  for (const i of interacoes) {
    eventCounts[i.tipo] = (eventCounts[i.tipo] || 0) + 1;
    if (i.imovel_id !== "general") {
      if (!heatmap[i.imovel_id]) heatmap[i.imovel_id] = { clicks: 0, favorites: 0, whatsapp: 0, details: 0 };
      if (i.tipo === "card_click") heatmap[i.imovel_id].clicks++;
      if (i.tipo === "favorite") heatmap[i.imovel_id].favorites++;
      if (i.tipo === "whatsapp_click") heatmap[i.imovel_id].whatsapp++;
      if (i.tipo === "detail_click") heatmap[i.imovel_id].details++;
    }
  }

  // Sort by total interest
  const ranked = Object.entries(heatmap)
    .map(([id, counts]) => ({ id, total: counts.clicks + counts.favorites * 3 + counts.whatsapp * 5 + counts.details * 2, ...counts }))
    .sort((a, b) => b.total - a.total);

  const medals = ["🥇", "🥈", "🥉"];
  const totalViews = eventCounts["vitrine_opened"] || 0;
  const totalFavorites = eventCounts["favorite"] || 0;
  const totalWhatsapp = eventCounts["whatsapp_click"] || 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
          <Eye className="h-4 w-4 text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-black text-blue-700">{totalViews}</p>
          <p className="text-[10px] text-blue-500 font-semibold uppercase">Aberturas</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <Heart className="h-4 w-4 text-red-500 mx-auto mb-1" />
          <p className="text-lg font-black text-red-700">{totalFavorites}</p>
          <p className="text-[10px] text-red-500 font-semibold uppercase">Favoritos</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <MessageCircle className="h-4 w-4 text-green-500 mx-auto mb-1" />
          <p className="text-lg font-black text-green-700">{totalWhatsapp}</p>
          <p className="text-[10px] text-green-500 font-semibold uppercase">WhatsApp</p>
        </div>
      </div>

      {/* Heatmap ranking */}
      {ranked.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ background: "#f8fafc" }}>
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-700">Ranking de Interesse</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {ranked.map((item, idx) => {
              const name = imovelNames[item.id] || `Imóvel ${item.id}`;
              const maxTotal = ranked[0].total;
              const barWidth = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
              return (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 opacity-[0.06]" style={{ width: `${barWidth}%`, background: "#3b82f6" }} />
                  <span className="text-lg w-8 text-center relative z-10">{medals[idx] || `${idx + 1}º`}</span>
                  <div className="flex-1 relative z-10">
                    <p className="text-sm font-bold text-slate-800">{name}</p>
                    <div className="flex gap-3 mt-0.5">
                      {item.clicks > 0 && <span className="text-[10px] text-slate-500">👆 {item.clicks} cliques</span>}
                      {item.favorites > 0 && <span className="text-[10px] text-red-500">❤️ {item.favorites}</span>}
                      {item.whatsapp > 0 && <span className="text-[10px] text-green-500">💬 {item.whatsapp}</span>}
                      {item.details > 0 && <span className="text-[10px] text-violet-500">👁 {item.details}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity feed */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#f8fafc" }}>
          <h3 className="text-sm font-bold text-slate-700">Atividade recente</h3>
          {interacoes.length > 5 && (
            <button onClick={() => setShowAll(!showAll)} className="text-xs text-blue-600 font-semibold">
              {showAll ? "Menos" : `Ver tudo (${interacoes.length})`}
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
          {(showAll ? interacoes : interacoes.slice(0, 5)).map(i => {
            const ev = EVENT_LABELS[i.tipo] || { label: i.tipo, icon: Eye, color: "#64748b" };
            const Icon = ev.icon;
            const name = i.imovel_id !== "general" ? (imovelNames[i.imovel_id] || `#${i.imovel_id}`) : "";
            return (
              <div key={i.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ev.color}15` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: ev.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {ev.label}{name && ` — ${name}`}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatDistanceToNow(new Date(i.created_at), { addSuffix: true, locale: ptBR })}
                    {i.tipo === "time_on_page" && i.metadata?.seconds && ` • ${i.metadata.seconds}s`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
