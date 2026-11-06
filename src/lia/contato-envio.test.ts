import { describe,it,expect,vi } from "vitest";
import { contatoPodeReceber,registrarResposta } from "../../supabase/functions/_shared/contatoEnvio";
import type { SupabaseClient } from "@supabase/supabase-js";
const client = (rpc: ReturnType<typeof vi.fn>) => ({rpc}) as unknown as SupabaseClient;
describe("Fase 2: proteção compartilhada",()=>{
  it("falha de leitura nunca autoriza envio",async()=>{
    expect(await contatoPodeReceber(client(vi.fn().mockResolvedValue({error:{message:"offline"},data:null})),"5500000000087")).toBe(false);
  });
  it("bloqueio global nega envio",async()=>{
    expect(await contatoPodeReceber(client(vi.fn().mockResolvedValue({error:null,data:{allowed:false}})),"5500000000087")).toBe(false);
  });
  it("cancelar mensagens preserva a frase original e vira pedido de saída",async()=>{
    const rpc=vi.fn().mockResolvedValue({error:null,data:{acao:"opt_out",bloqueado:true}});
    await registrarResposta(client(rpc),{telefone:"5500000000087",mensagem:"cancelar mensagens",evento:"teste"});
    expect(rpc).toHaveBeenCalledWith("registrar_resposta_recuperacao",expect.objectContaining({p_mensagem:"cancelar mensagens",p_payload:"lia_recupera_opt_out"}));
  });
  it("novo contato não é perdido pela deduplicação da recepção",async()=>{
    const rpc=vi.fn().mockResolvedValue({error:null,data:{acao:"seguir",bloqueado:false}});
    await registrarResposta(client(rpc),{telefone:"5500000000087",mensagem:"Quero voltar a procurar imóvel",evento:"wa:87",novoContato:true});
    expect(rpc).toHaveBeenCalledWith("registrar_resposta_recuperacao",expect.objectContaining({p_evento:"retorno:wa:87",p_novo_contato:true}));
  });
});