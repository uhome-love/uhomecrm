import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { todayBRT } from "@/lib/utils";
import { toast } from "sonner";
import { CheckSquare } from "lucide-react";

const DEFAULT_ITEMS = [
  "Alinhamento rápido de manhã",
  "Revisão de metas do dia",
  "Auditoria de follow-up",
  "Checagem de visitas marcadas",
  "Checagem de visitas realizadas",
  "Checagem de propostas",
  "Fechamento do dia",
];

interface CheckItem {
  id: string;
  item: string;
  concluido: boolean;
}

export default function ManagerChecklist() {
  const { user } = useAuth();
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("manager_checklist")
      .select("*")
      .eq("gerente_id", user.id)
      .eq("data", today)
      .order("created_at");

    if (!error && data && data.length > 0) {
      setItems(data.map((d: any) => ({ id: d.id, item: d.item, concluido: d.concluido })));
    } else {
      // Create default items
      const inserts = DEFAULT_ITEMS.map((item) => ({
        gerente_id: user.id,
        data: today,
        item,
      }));
      const { data: created } = await supabase.from("manager_checklist").insert(inserts).select();
      if (created) {
        setItems(created.map((d: any) => ({ id: d.id, item: d.item, concluido: d.concluido })));
      }
    }
    setLoading(false);
  }, [user, today]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item: CheckItem) => {
    const next = !item.concluido;
    await supabase.from("manager_checklist").update({
      concluido: next,
      concluido_em: next ? new Date().toISOString() : null,
    }).eq("id", item.id);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, concluido: next } : i));
    if (next) toast.success(`✅ ${item.item}`);
  };

  const done = items.filter((i) => i.concluido).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <CheckSquare className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Checklist do Gerente</h3>
          <span className="ml-auto text-xs font-medium text-muted-foreground">{done}/{total} ({pct}%)</span>
        </div>

        <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-4">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer transition-colors ${item.concluido ? "bg-success/5 border-success/20" : "hover:bg-muted/30"}`}
              >
                <Checkbox checked={item.concluido} onCheckedChange={() => toggle(item)} />
                <span className={`text-sm ${item.concluido ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.item}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
