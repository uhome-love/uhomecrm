import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

export default function AproveitadosTab({ teamUserIds, teamNameMap }: Props) {
  const { toast } = useToast();
  const [aproveitados, setAproveitados] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");

  const load = useCallback(async () => {
    if (teamUserIds.length === 0) return;
    const { data } = await supabase
      .from("oferta_ativa_tentativas")
      .select("id, corretor_id, created_at, lead_id, oferta_ativa_leads(nome, telefone)")
      .in("corretor_id", teamUserIds)
      .eq("resultado", "com_interesse")
      .order("created_at", { ascending: false })
      .limit(100);
    setAproveitados((data || []).map((d: any) => ({
      id: d.id,
      lead_nome: d.oferta_ativa_leads?.nome || "Sem nome",
      lead_telefone: d.oferta_ativa_leads?.telefone || "",
      corretor_id: d.corretor_id,
      corretor_nome: teamNameMap[d.corretor_id] || "Corretor",
    })));
  }, [teamUserIds, teamNameMap]);

  useEffect(() => { load(); }, [load]);

  const filtered = aproveitados.filter(a => {
    const matchSearch = !search || a.lead_nome?.toLowerCase().includes(search.toLowerCase()) || a.lead_telefone?.includes(search);
    const matchFilter = filter === "todos" || a.corretor_id === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" /> Leads Aproveitados do Time ({filtered.length})
        </h2>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-52 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
        <select value={filter} onChange={e => setFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400">
          <option value="todos">Todos corretores</option>
          {teamUserIds.map(id => <option key={id} value={id}>{teamNameMap[id] || id}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Nenhum lead aproveitado encontrado.</p>
        ) : filtered.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 text-sm">{a.lead_nome}</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Aproveitado</span>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{a.corretor_nome}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{a.lead_telefone}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(`${a.lead_nome}\n${a.lead_telefone ?? ""}`); toast({ title: "Copiado!" }); }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
              <Copy size={12} /> Copiar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
