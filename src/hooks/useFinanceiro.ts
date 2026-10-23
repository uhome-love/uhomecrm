import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useAuth} from "@/hooks/useAuth";
import {supabase} from "@/integrations/supabase/client";
import {lerFinanceiro} from "@/lib/financeiro";
import {useUserRole} from "@/hooks/useUserRole";
export function useFinanceiro(inicio:string,fim:string){
 const {user}=useAuth();const {isAdmin,isDiretor}=useUserRole();const cache=useQueryClient();
 const query=useQuery({queryKey:["financeiro",user?.id,inicio,fim],enabled:!!user&&(isAdmin||isDiretor),staleTime:15000,queryFn:async()=>{const r=await supabase.rpc("financeiro_dados",{p_inicio:inicio,p_fim:fim});if(r.error)throw r.error;return lerFinanceiro(r.data);}});
 const atualizar=async()=>{await Promise.all([cache.invalidateQueries({queryKey:["financeiro"]}),cache.invalidateQueries({queryKey:["vendas-realizadas"]}),cache.invalidateQueries({queryKey:["negocios"]})]);window.dispatchEvent(new CustomEvent("pipeline-reload"));};
 return {...query,atualizar};
}
