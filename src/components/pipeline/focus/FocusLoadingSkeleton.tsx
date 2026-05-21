/**
 * Skeleton de carregamento do Modo Foco.
 *
 * REGRA DE CONTRASTE (Modo Foco / dark scope):
 * Este componente renderiza dentro do escopo `.dark` do DialogContent.
 * Use bg-white/5 e bg-white/10 (não muted) para casar com fundo dark.
 * Reproduz a estrutura real (top strip + grid 3/7) para evitar layout jump.
 */
export default function FocusLoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 max-w-[1400px] mx-auto w-full animate-pulse">
      {/* legenda discreta */}
      <p className="text-xs text-foreground/60 text-center -mb-1">
        Preparando sua sessão de foco...
      </p>

      {/* ====== TOP STRIP skeleton ====== */}
      <div
        className="rounded-2xl p-3 sm:p-4 flex flex-col gap-3"
        style={{
          background: "linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))",
          border: "1px solid rgba(79,70,229,0.25)",
        }}
      >
        {/* Linha 1 — info */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-white/10" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-20 rounded bg-white/10" />
              <div className="h-3 w-10 rounded bg-white/15" />
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 hidden sm:block" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-white/10" />
            <div className="h-3 w-2/3 max-w-sm rounded bg-white/15" />
          </div>
        </div>

        {/* Linha 2 — botões */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 h-12 rounded-xl bg-white/15" />
          <div className="flex gap-2 sm:contents">
            <div className="h-12 sm:w-[120px] flex-1 sm:flex-none rounded-xl bg-white/10" />
            <div className="h-12 sm:w-[140px] flex-1 sm:flex-none rounded-xl bg-white/10" />
            <div className="h-12 sm:w-[130px] flex-1 sm:flex-none rounded-xl bg-white/5 border border-white/10" />
          </div>
        </div>
      </div>

      {/* ====== GRID 3/7 ====== */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-0">
        {/* Painel esquerdo */}
        <div className="lg:col-span-3 min-h-0">
          <div
            className="rounded-2xl p-5 sm:p-6 space-y-4 h-full"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* LeadHeader */}
            <div className="space-y-2">
              <div className="h-5 w-2/3 rounded bg-white/15" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
              <div className="h-3 w-1/3 rounded bg-white/10" />
            </div>
            {/* HOMI Insight */}
            <div className="rounded-xl p-4 space-y-2 bg-white/5 border border-white/10">
              <div className="h-3 w-24 rounded bg-white/15" />
              <div className="h-3 w-full rounded bg-white/10" />
              <div className="h-3 w-5/6 rounded bg-white/10" />
              <div className="h-3 w-3/4 rounded bg-white/10" />
            </div>
            {/* Pending tasks */}
            <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
              <div className="h-3 w-32 rounded bg-white/15" />
              <div className="h-10 rounded-lg bg-white/10" />
              <div className="h-10 rounded-lg bg-white/10" />
            </div>
            {/* Scripts */}
            <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
              <div className="h-3 w-28 rounded bg-white/15" />
              <div className="flex gap-2 flex-wrap">
                <div className="h-6 w-16 rounded-full bg-white/10" />
                <div className="h-6 w-20 rounded-full bg-white/10" />
                <div className="h-6 w-14 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-7 min-h-[400px] lg:min-h-0">
          <div
            className="rounded-2xl p-5 sm:p-6 space-y-4 h-full"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-white/15" />
              <div className="h-3 w-64 rounded bg-white/10" />
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 items-start pt-2">
                <div className="w-9 h-9 rounded-full bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-white/15" />
                  <div className="h-3 w-5/6 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
