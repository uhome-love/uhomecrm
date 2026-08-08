// Alerta da Lia: notificação in-app para admins (o push sai automático pelo
// trigger trg_push_on_notification) + registro em ops_events com dedup.
//
// Mesmo padrão do capi-health-alert. Existe porque falha silenciosa é o modo
// de falha que estamos eliminando: bloqueio duro sem alerta é morte silenciosa.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEDUP_HORAS_PADRAO = 6;

export async function alertarAdminsLia(
  supabase: SupabaseClient,
  args: {
    dedupKey: string;
    titulo: string;
    mensagem: string;
    ctx?: Record<string, unknown>;
    dedupHoras?: number;
    link?: string;
  },
): Promise<boolean> {
  const dedupHoras = args.dedupHoras ?? DEDUP_HORAS_PADRAO;
  const desde = new Date(Date.now() - dedupHoras * 3600_000).toISOString();

  const { data: anterior } = await supabase
    .from("ops_events")
    .select("id")
    .eq("fn", "lia-brain")
    .eq("category", "alert")
    .eq("message", args.dedupKey)
    .gte("created_at", desde)
    .limit(1);

  if ((anterior ?? []).length > 0) return false;

  const { data: adminRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const admins = adminRows ?? [];

  if (admins.length > 0) {
    await supabase.from("notifications").insert(
      admins.map((a: { user_id: string }) => ({
        user_id: a.user_id,
        tipo: "sistema",
        categoria: "sla_urgente",
        titulo: args.titulo,
        mensagem: args.mensagem,
        dados: { ...(args.ctx ?? {}), link: args.link ?? "/admin/lia" },
        lida: false,
      })),
    );
  }

  await supabase.from("ops_events").insert({
    fn: "lia-brain",
    level: "error",
    category: "alert",
    message: args.dedupKey,
    ctx: { ...(args.ctx ?? {}), admins_notified: admins.length },
  });

  return true;
}
