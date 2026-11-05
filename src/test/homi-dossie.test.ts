import { describe, it, expect } from "vitest";
import { sanitizeDossier, dossierForAI, dossierEnabled } from "../../supabase/functions/_shared/homiDossie";

describe("Privacidade e ativação do dossiê HOMI", () => {
  it("não envia telefone, e-mail, CPF, renda nem documento", () => {
    const clean = JSON.stringify(sanitizeDossier({ telefone:"51987654321", email:"qa@example.com", cpf:"12345678901", renda:10000, documento:"arquivo", preferencia:"casa 3 quartos" }));
    expect(clean).toBe('{"preferencia":"casa 3 quartos"}');
  });
  it("filtra perguntas pessoais do form_respostas, preservando qualificação", () => {
    expect(sanitizeDossier({form_respostas:[{pergunta:"Qual sua renda?",resposta:"10000"},{pergunta:"CPF",resposta:"123"},{pergunta:"Qual tamanho?",resposta:"3 dormitórios"}]})).toEqual({form_respostas:[{pergunta:"Qual tamanho?",resposta:"3 dormitórios"}]});
  });
  it("redige identificadores e remove sentenças pessoais de texto livre", () => {
    expect(sanitizeDossier("Busca casa. CPF 123.456.789-01. Contato qa@example.com. Mora em apartamento.")).toBe("Busca casa. Contato [restrito]. Mora em apartamento.");
  });
  it("preserva todos os fatos datados da timeline e resultados", () => {
    const text=dossierForAI({timeline:{status:"ok",dados:{fatos:Array.from({length:20},(_,i)=>({data:`2026-10-${i+1}`,fonte:"pipeline_atividades",resultado:"não atendeu"}))}}});
    expect(text.match(/não atendeu/g)).toHaveLength(20);
    expect(text).toContain('"data":"2026-10-1"');
  });
  it("mantém autor, data e marca de corretor anterior", () => {
    expect(sanitizeDossier({memoria:{dados:[{autor:"Anterior",data:"2026-10-20",outro_corretor:true,valor:"decide com cônjuge"}]}})).toEqual({memoria:{dados:[{autor:"Anterior",data:"2026-10-20",outro_corretor:true,valor:"decide com cônjuge"}]}});
  });
  it("erro ou flag desligada nunca ativam o dossiê", async () => {
    const client = (data: unknown, error: unknown) => ({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data,error})})})})});
    expect(await dossierEnabled(client({flag_value:false},null) as Parameters<typeof dossierEnabled>[0])).toBe(false);
    expect(await dossierEnabled(client(null,{message:"falha"}) as Parameters<typeof dossierEnabled>[0])).toBe(false);
    expect(await dossierEnabled(client({flag_value:true},null) as Parameters<typeof dossierEnabled>[0])).toBe(true);
  });
});