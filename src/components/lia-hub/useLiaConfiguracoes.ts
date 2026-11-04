import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EnvioProgramado } from "@/lia/envioProgramado";

export type ConfigLia = { config:EnvioProgramado|null;versao:string;motor:boolean|null;lotes:{status:string;cap_dia:number;nome:string|null}[];isolado:{envio:boolean;inicio:string;fim:string};historico:{created_at:string;antes:EnvioProgramado|null;depois:EnvioProgramado}[] };
export function useLiaConfiguracoes() {
  const qc=useQueryClient();
  const q=useQuery({queryKey:["lia-hub","configuracoes"],queryFn:async()=>{
    const {data,error}=await supabase.rpc("lia_ler_configuracoes");if(error)throw error;
    if(!data)throw new Error("Configuração indisponível.");return data as unknown as ConfigLia;
  }});
  const salvar=useMutation({mutationFn:async({config,versao}:{config:EnvioProgramado;versao:string})=>{
    const {data,error}=await supabase.rpc("lia_salvar_configuracoes",{p_config:config,p_versao:versao});if(error)throw error;
    if(!data)throw new Error("Não foi possível confirmar o salvamento.");
    await qc.invalidateQueries({queryKey:["lia-hub","configuracoes"]});return data;
  },onError:(e:Error)=>toast.error(e.message),onSuccess:()=>toast.success("Configurações salvas. Motor e lotes preservados.")});
  return {...q,salvar};
}