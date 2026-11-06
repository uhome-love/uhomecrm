import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeDossier, dossierForAI, dossierEnabled, loadDossier, dossiersForList } from "../../supabase/functions/_shared/homiDossie";
import { groupAttempts } from "../../supabase/functions/_shared/homiDossieCompact";

describe("Privacidade e ativação do dossiê HOMI", () => {
  it("não envia telefone, e-mail, CPF, renda nem documento", () => {
    const clean = JSON.stringify(sanitizeDossier({ telefone:"51987654321", email:"qa@example.com", cpf:"12345678901", renda:10000, documento:"arquivo", preferencia:"casa 3 quartos" }));
    expect(clean).toBe('{"preferencia":"casa 3 quartos"}');
  });
  it("filtra perguntas pessoais do form_respostas, preservando qualificação", () => {
    expect(sanitizeDossier({form_respostas:[{pergunta:"Qual sua renda?",resposta:"10000"},{pergunta:"CPF",resposta:"123"},{pergunta:"Qual tamanho?",resposta:"3 dormitórios"}]})).toEqual({form_respostas:[{pergunta:"Qual tamanho?",resposta:"3 dormitórios"}]});
  });
  it("redige identificadores e remove sentenças pessoais de texto livre", () => {
    expect(sanitizeDossier("Busca casa. CPF 123.456.789-01. Contato qa@example.com. Mora em apartamento.")).toBe("Busca casa. CPF [restrito]. Contato [restrito]. Mora em apartamento.");
  });
  it("preserva todos os fatos datados da timeline e resultados", () => {
    const text=dossierForAI({timeline:{status:"ok",dados:{fatos:Array.from({length:20},(_,i)=>({data:`2026-10-${i+1}`,fonte:"pipeline_atividades",resultado:"agendou_proximo"}))}}});
    expect(text.match(/agendou_proximo/g)).toHaveLength(20);
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
  it("flag desligada impede qualquer chamada de dossiê", async () => {
    let calls=0;
    const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{flag_value:false},error:null})})})}),rpc:async()=>{calls++;return {data:{},error:null};}};
    expect(await loadDossier(client as Parameters<typeof loadDossier>[0],"lead")).toBeNull();
    expect(calls).toBe(0);
  });
  it("dados indisponíveis não viram zeros na projeção", () => {
    expect(dossierForAI({oferta_ativa:{status:"indisponível",dados:null}})).toContain('"status":"indisponível","dados":null');
  });
  it("preserva integralmente a visita real 05/11, objeção, próximo passo e feedback", () => {
    const visit = "05/11/2026 · 19:00 · Imóvel: Casa Tua Alto Petrópolis · Resultado: 🏠 Continuar visitando · Temperatura: 🌡️ Morno · Objeção: Condições de pagamento · Próximo passo: Pegar documentos com a lead (10/11/2026) · Cliente gostou do empreendimento. Disse que vai enviar a documentação para fazer uma análise de crédito, assim já consigo ver as condições de parcela e se é aprovado ou não, para conseguir colocar ela em outro empreendimento se for o caso. Disse também que podemos verificar para visitar no sabado dia 14/11 com o pai dela junto, que também gosta deste tipo de empreendimento e pode querer comprar.";
    expect(sanitizeText(visit)).toBe(visit);
    expect(dossierForAI({atividades_recentes:{status:"ok",dados:[{descricao:visit}]}})).toContain(visit);
  });
  it("Documentação, documentos e anexo comerciais não são dados pessoais", () => {
    expect(sanitizeText("Documentação")).toBe("Documentação");
    expect(sanitizeText("Pegar documentos. Anexo com proposta enviada.")).toBe("Pegar documentos. Anexo com proposta enviada.");
  });
  it("datas e horários não são telefone", () => {
    expect(sanitizeText("Visita 05/11/2026 às 19:00; retorno 10/11/2026 e 2026-11-14.")).toBe("Visita 05/11/2026 às 19:00; retorno 10/11/2026 e 2026-11-14.");
  });
  it("redige CPF, RG, número de documento e telefone sem apagar a frase", () => {
    expect(sanitizeText("CPF 12345678901, RG 12.345.678-9, número do documento 12345678; ligar (51) 98765-4321.")).toBe("CPF [restrito], [restrito], [restrito]; ligar [restrito].");
  });
  it("renda e salário ainda removem a frase inteira", () => {
    expect(sanitizeText("Gostou. Renda de 10000. Salário 8000. Enviar documentação.")).toBe("Gostou. Enviar documentação.");
  });
  it("agrupa 13 tentativas sem retorno, sem perder entrada, visita e objeção", () => {
    const output = groupAttempts([...Array.from({length:13},(_,i)=>({data:`2026-09-${String(i+1).padStart(2,"0")}`,tipo:"ligacao",resultado:"nao_atendeu",fonte:"pipeline_atividades"})),
      {data:"2026-09-01",titulo:"Entrada do lead"},{data:"2026-10-13",titulo:"Visita realizada",descricao_resumo:"Objeção: pagamento",resultado:"quer_proposta"}]);
    expect(output).toHaveLength(3);
    expect(output.find(f=>f.tipo==="tentativas_agrupadas")?.quantidade).toBe(13);
    expect(output.some(f=>f.titulo==="Entrada do lead")).toBe(true);
    expect(output.some(f=>f.descricao_resumo==="Objeção: pagamento")).toBe(true);
  });
  it("mantém o envio em até 12 KB com JSON válido", () => {
    const text = dossierForAI({timeline:{status:"ok",dados:{fatos:Array.from({length:100},(_,i)=>({data:`2026-09-${i}`,tipo:"ligacao",resultado:"nao_atendeu",descricao_resumo:"Sem retorno ".repeat(100)}))}},atividades_recentes:{status:"ok",dados:[{descricao:"Feedback importante ".repeat(500)}]}});
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(12*1024);
    expect(()=>JSON.parse(text.slice(text.indexOf("\n")+1))).not.toThrow();
  });
  it("versão curta limita a cinco fatos e mantém lacunas", () => {
    const text = dossierForAI({timeline:{dados:{fatos:Array.from({length:10},(_,i)=>({data:String(i),resultado:"agendou_proximo"}))}},lacunas:["prazo_decisao: não informado"]},true);
    const data=JSON.parse(text.slice(text.indexOf("\n")+1));
    expect(data.fatos).toHaveLength(5);
    expect(data.lacunas).toEqual(["prazo_decisao: não informado"]);
  });
  it("autor zero é sistema e Lia não é outro corretor", () => {
    expect(sanitizeDossier({autor_id:"00000000-0000-0000-0000-000000000000",outro_corretor:true,fonte:"pipeline_atividades"})).toMatchObject({autor_tipo:"sistema",outro_corretor:false});
    expect(sanitizeDossier({autor_id:null,outro_corretor:true,fonte:"lia_estado"})).toMatchObject({autor_tipo:"Lia",outro_corretor:false});
  });
  it("busca múltiplos dossiês em paralelo, lendo a flag uma única vez", async () => {
    let active=0,maxActive=0,flags=0;
    const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{flags++;return {data:{flag_value:true},error:null};}})})}),rpc:async()=>{active++;maxActive=Math.max(active,maxActive);await new Promise(r=>setTimeout(r,5));active--;return {data:{lacunas:["sem tarefa futura"]},error:null};}};
    const list=await dossiersForList(client as Parameters<typeof dossiersForList>[0],["a","b","c"]);
    expect(list.size).toBe(3); expect(maxActive).toBe(3); expect(flags).toBe(1);
  });
});