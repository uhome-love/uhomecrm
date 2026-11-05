/** Authenticated integration without model calls or changing the real system flag.
 * HOMI_QA_SESSION_FILE=/tmp/.../session.json bun scripts/homi/test-tool.ts
 * Requires the test-only HOMI QA fixtures; never supply real lead names.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { executeHomiTool } from "../../supabase/functions/homi-chat/homi-tools";
const sessionPath = process.env.HOMI_QA_SESSION_FILE;
if (!sessionPath) throw Error("HOMI_QA_SESSION_FILE required");
const env = readFileSync(".env", "utf8");
const value = (name: string) => {
  const match = env.match(new RegExp(name + '="?([^"\\n]+)'));
  if (!match) throw Error("configuration missing");
  return match[1];
};
const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const real = createClient(value("VITE_SUPABASE_URL"),value("VITE_SUPABASE_PUBLISHABLE_KEY"),{
  global:{headers:{Authorization:"Bearer "+session.access_token}},
});
const client = {
  rpc: real.rpc.bind(real),
  from: (table: string) => table === "system_flags"
    ? {select:()=>({eq:()=>({maybeSingle:async()=>({data:{flag_value:true},error:null})})})}
    : real.from(table),
};
const out=await executeHomiTool("contexto_lead",{lead_nome:"HOMI QA Lia"},client,session.user.id);
if (!out.modelResult.includes("Busca casa 3 dormitórios até março.")) throw Error("Dossier missing");
if (out.modelResult.includes("QA renda") || out.modelResult.includes("QA documento")) throw Error("Personal data leaked");
console.log("PASS authenticated context uses dossier; personal answers excluded");
const partner=await executeHomiTool("contexto_lead",{lead_nome:"HOMI QA Parceria"},client,session.user.id);
if (!partner.modelResult.includes("700000")) throw Error("Partnership context missing");
console.log("PASS authorized partnership resolves in tool");
const flag=await real.from("system_flags").select("flag_value").eq("flag_name","homi_dossie_ativo").single();
if (flag.error || flag.data.flag_value !== false) throw Error("Real flag changed");
console.log("PASS real activation flag remains false");