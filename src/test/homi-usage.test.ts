import {describe,it,expect} from "vitest";
import {usageColumns,usageStart,usageFinish} from "../../supabase/functions/_shared/homiUsage";
describe("Medição HOMI",()=>{
  it("grava usage real inclusive cache e raciocínio",()=>{
    expect(usageColumns({prompt_tokens:123,completion_tokens:45,prompt_tokens_details:{cached_tokens:50},completion_tokens_details:{reasoning_tokens:9}})).toEqual({tokens_entrada:123,tokens_saida:45,tokens_cache:50,tokens_raciocinio:9});
  });
  it("não inventa tokens quando usage não veio",()=>{
    expect(usageFinish(null,154.6,true)).toEqual({tokens_entrada:0,tokens_saida:0,tokens_cache:0,tokens_raciocinio:0,latencia_ms:155,sucesso:true,erro:"usage_nao_retornado"});
  });
  it("cada início carrega função, modelo, versão, usuário e lead",()=>{
    expect(usageStart({funcao:"homi-chat",versaoPrompt:"2026-11-06",userId:"user",leadId:"lead"},"modelo")).toMatchObject({funcao:"homi-chat",versao_prompt:"2026-11-06",user_id:"user",lead_id:"lead",modelo:"modelo",sucesso:false,erro:"em_andamento"});
  });
  it("erro registra insucesso sem incluir texto ou segredo",()=>{
    expect(usageFinish(null,400,false,"rate_limit")).toMatchObject({sucesso:false,erro:"rate_limit",latencia_ms:400});
  });
});