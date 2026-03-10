import { Dispatch, SetStateAction, useState } from "react";
import { subDays, addDays } from "date-fns";
import {
  ChevronLeft, ChevronRight, Calendar, RefreshCw, Copy,
  RotateCcw, Save, Lock, Phone, Award, MapPin, UserCheck, Pencil,
} from "lucide-react";
import { type CheckpointRow, pct, fmt, fmtR } from "@/pages/CheckpointGerente";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  ok: { label: "✅ OK", bg: "bg-green-50", text: "text-green-700" },
  parcial: { label: "📈 Parcial", bg: "bg-blue-50", text: "text-blue-700" },
  pendente: { label: "⏳ Pendente", bg: "bg-amber-50", text: "text-amber-700" },
  zero: { label: "❌ Zero", bg: "bg-red-50", text: "text-red-700" },
  ausente_status: { label: "🔒 Ausente", bg: "bg-slate-50", text: "text-slate-500" },
};

const presencaOptions = [
  { value: "nao_informado", label: "⚪ Não informado", style: "bg-gray-100 text-gray-500" },
  { value: "presente", label: "✅ Presente", style: "bg-green-100 text-green-700" },
  { value: "meio_periodo", label: "⏰ Meio período", style: "bg-blue-100 text-blue-700" },
  { value: "ausente", label: "❌ Ausente", style: "bg-red-100 text-red-700" },
  { value: "atestado", label: "🏥 Atestado", style: "bg-orange-100 text-orange-700" },
  { value: "folga", label: "🏖️ Folga", style: "bg-cyan-100 text-cyan-700" },
];

interface Props {
  rows: CheckpointRow[];
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  dateFmt: string;
  checkpointStatus: "aberto" | "publicado";
  totalLig: number;
  totalAprov: number;
  totalVm: number;
  presentes: number;
  syncing: boolean;
  saving: boolean;
  onSync: () => void;
  onCopyYesterday: () => void;
  onZero: () => void;
  onSave: () => void;
  onPublish: () => void;
  onUpdateRow: (id: string, field: keyof CheckpointRow, value: any) => void;
}

function ObsGerenteCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setExpanded(false)}
        autoFocus
        rows={2}
        placeholder="Observação do gerente..."
        className="w-full text-xs border border-blue-300 rounded-md py-1.5 px-2 focus:outline-none focus:border-blue-400 resize-none"
      />
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-1.5 text-xs border border-gray-200 rounded-md py-1.5 px-2 hover:border-blue-300 transition-colors text-left min-h-[30px]"
          >
            <Pencil size={10} className="text-gray-400 shrink-0" />
            <span className={value ? "text-gray-700 truncate" : "text-gray-400 truncate"}>
              {value || "Obs..."}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Observação do gerente para este corretor hoje
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function CheckpointTableTab({
  rows, selectedDate, setSelectedDate, dateFmt, checkpointStatus,
  totalLig, totalAprov, totalVm, presentes, syncing, saving,
  onSync, onCopyYesterday, onZero, onSave, onPublish, onUpdateRow,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl overflow-hidden">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
          <button onClick={() => setSelectedDate(d => subDays(d, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={14} /></button>
          <Calendar size={14} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-700 mx-1">{dateFmt}</span>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={14} /></button>
        </div>

        <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${checkpointStatus === "publicado" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {checkpointStatus === "publicado" ? "Publicado" : "Aberto"}
        </span>

        <div className="hidden md:flex items-center gap-3 ml-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Phone size={11} className="text-blue-400" /><b className="text-gray-700">{totalLig}</b> lig.</span>
          <span className="flex items-center gap-1"><Award size={11} className="text-green-400" /><b className="text-gray-700">{totalAprov}</b> aprov.</span>
          <span className="flex items-center gap-1"><MapPin size={11} className="text-amber-400" /><b className="text-gray-700">{totalVm}</b> visitas</span>
          <span className="flex items-center gap-1"><UserCheck size={11} className="text-purple-400" /><b className="text-gray-700">{presentes}</b> presentes</span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <button onClick={onSync} disabled={syncing} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} /> Sincronizar OA
          </button>
          <button onClick={onCopyYesterday} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all">
            <Copy size={13} /> Copiar ontem
          </button>
          <button onClick={onZero} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-red-200 hover:text-red-500 px-3 py-1.5 rounded-lg transition-all">
            <RotateCcw size={13} /> Zerar
          </button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
            <Save size={13} /> {saving ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={onPublish} className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-all font-semibold">
            <Lock size={13} /> Publicar
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky left-0 z-10 w-36">Corretor</th>
              <th className="px-2 py-2.5 text-xs font-semibold text-gray-400 w-32">Presença</th>
              <th colSpan={3} className="text-center py-2.5 text-xs font-bold text-blue-600 bg-blue-50/50 border-l border-r border-blue-100">METAS DO DIA</th>
              <th className="px-2 py-2.5 text-xs font-semibold text-gray-400 bg-blue-50/50 border-r border-blue-100 w-40">Obs Gerente</th>
              <th colSpan={4} className="text-center py-2.5 text-xs font-bold text-green-600 bg-green-50/50 border-r border-green-100">RESULTADO DO DIA</th>
              <th className="px-2 py-2.5 text-xs font-semibold text-gray-400 bg-green-50/50 border-r border-green-100 w-32">Obs Dia</th>
              <th className="px-2 py-2.5 text-xs font-semibold text-gray-400 w-24 text-center">Status</th>
            </tr>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-xs text-gray-400 font-medium">
              <th className="px-4 py-2 sticky left-0 bg-gray-50/80 z-10" />
              <th className="px-2 py-2" />
              <th className="px-2 py-2 text-center bg-blue-50/30">Ligações</th>
              <th className="px-2 py-2 text-center bg-blue-50/30">Aprov.</th>
              <th className="px-2 py-2 text-center bg-blue-50/30">V.Marcar</th>
              <th className="px-2 py-2 bg-blue-50/30" />
              <th className="px-2 py-2 text-center bg-green-50/30">Ligações</th>
              <th className="px-2 py-2 text-center bg-green-50/30">Aprov.</th>
              <th className="px-2 py-2 text-center bg-green-50/30">V.Marc.</th>
              <th className="px-2 py-2 text-center bg-green-50/30">V.Real.</th>
              <th className="px-2 py-2 bg-green-50/30" />
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const sc = statusConfig[row.status] || statusConfig.pendente;
              const presOption = presencaOptions.find(p => p.value === row.presenca) || presencaOptions[0];
              const ligPct = row.meta_ligacoes > 0 ? pct(row.res_ligacoes, row.meta_ligacoes) : null;
              const isAbsent = ["ausente", "atestado", "folga"].includes(row.presenca);
              return (
                <tr key={row.corretor_id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${isAbsent ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2 sticky left-0 bg-white z-10 font-medium text-gray-800 text-sm">{row.nome}</td>
                  <td className="px-2 py-2">
                    <select
                      value={row.presenca}
                      onChange={e => onUpdateRow(row.corretor_id, "presenca", e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${presOption.style}`}
                    >
                      {presencaOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 bg-blue-50/20 text-center">
                    <input type="number" min={0} value={row.meta_ligacoes || ""} onChange={e => onUpdateRow(row.corretor_id, "meta_ligacoes", parseInt(e.target.value) || 0)} placeholder="0" className="w-14 text-center text-sm border border-gray-200 rounded-md py-1 focus:outline-none focus:border-blue-400" />
                  </td>
                  <td className="px-2 py-2 bg-blue-50/20 text-center">
                    <input type="number" min={0} value={row.meta_aproveitados || ""} onChange={e => onUpdateRow(row.corretor_id, "meta_aproveitados", parseInt(e.target.value) || 0)} placeholder="0" className="w-14 text-center text-sm border border-gray-200 rounded-md py-1 focus:outline-none focus:border-blue-400" />
                  </td>
                  <td className="px-2 py-2 bg-blue-50/20 text-center">
                    <input type="number" min={0} value={row.meta_visitas_marcar || ""} onChange={e => onUpdateRow(row.corretor_id, "meta_visitas_marcar", parseInt(e.target.value) || 0)} placeholder="0" className="w-14 text-center text-sm border border-gray-200 rounded-md py-1 focus:outline-none focus:border-blue-400" />
                  </td>
                  <td className="px-2 py-2 bg-blue-50/20">
                    <ObsGerenteCell
                      value={row.obs_gerente}
                      onChange={v => onUpdateRow(row.corretor_id, "obs_gerente", v)}
                    />
                  </td>
                  <td className="px-2 py-2 bg-green-50/20 text-center">
                    <div className="flex flex-col items-center">
                      <input type="number" min={0} value={row.res_ligacoes || ""} onChange={e => onUpdateRow(row.corretor_id, "res_ligacoes", parseInt(e.target.value) || 0)} placeholder="0" className="w-14 text-center text-sm border border-gray-200 rounded-md py-1 focus:outline-none focus:border-green-400" />
                      {ligPct !== null && <span className={`text-[10px] font-bold mt-0.5 ${ligPct >= 80 ? "text-green-500" : ligPct >= 50 ? "text-amber-500" : "text-red-400"}`}>{ligPct}%</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2 bg-green-50/20 text-center text-sm"><span className="font-semibold text-green-700">{row.res_aproveitados}</span></td>
                  <td className="px-2 py-2 bg-green-50/20 text-center text-sm text-gray-600">{row.res_visitas_marcadas}</td>
                  <td className="px-2 py-2 bg-green-50/20 text-center text-sm text-gray-600">{row.res_visitas_realizadas}</td>
                  <td className="px-2 py-2 bg-green-50/20">
                    <input type="text" value={row.obs_dia} onChange={e => onUpdateRow(row.corretor_id, "obs_dia", e.target.value)} placeholder="..." className="w-full text-xs border border-gray-200 rounded-md py-1 px-2 focus:outline-none focus:border-green-400" />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${sc.bg} ${sc.text}`}>{sc.label}</span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400 text-sm">Nenhum corretor no time. Adicione membros em "Painel do Time".</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
              <td className="px-4 py-3 sticky left-0 bg-gray-50 text-gray-600">Totais</td>
              <td className="px-2 py-3 text-center text-xs text-gray-500">{presentes} presentes</td>
              <td className="px-2 py-3 text-center bg-blue-50/30 text-blue-700">{rows.reduce((a, r) => a + r.meta_ligacoes, 0)}</td>
              <td className="px-2 py-3 text-center bg-blue-50/30 text-blue-700">{rows.reduce((a, r) => a + r.meta_aproveitados, 0)}</td>
              <td className="px-2 py-3 text-center bg-blue-50/30 text-blue-700">{rows.reduce((a, r) => a + r.meta_visitas_marcar, 0)}</td>
              <td className="bg-blue-50/30" />
              <td className="px-2 py-3 text-center bg-green-50/30 text-green-700">{totalLig}</td>
              <td className="px-2 py-3 text-center bg-green-50/30 text-green-700 font-bold">{totalAprov}</td>
              <td className="px-2 py-3 text-center bg-green-50/30 text-green-700">{totalVm}</td>
              <td className="px-2 py-3 text-center bg-green-50/30 text-green-700">{rows.reduce((a, r) => a + r.res_visitas_realizadas, 0)}</td>
              <td className="bg-green-50/30" />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
