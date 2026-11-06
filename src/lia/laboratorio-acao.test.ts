import { describe, it, expect } from "vitest";
import { conferirAcao, ACAO_ESPERADA } from "../../supabase/functions/_shared/liaLaboratorio";

const ok = (id: string, msgs: string[], sinal = "seguindo") => conferirAcao(id, msgs, sinal).every((c) => c.ok);

describe("ação esperada do Laboratório", () => {
  it("tem os 18 cenários combinados", () => expect(Object.keys(ACAO_ESPERADA)).toHaveLength(18));
  it("robô: precisa assumir assistente virtual", () => {
    expect(ok("fora-robo", ["Sou a assistente virtual da Uhome! Ainda procura apê?"])).toBe(true);
    expect(ok("fora-robo", ["Não sou robô, sou a Lia."])).toBe(false);
  });
  it("áudio transcrito: responde o conteúdo, nunca diz que não ouve", () => {
    expect(ok("fora-audio", ["Tem pátio sim, e são 3 dormitórios."])).toBe(true);
    expect(ok("fora-audio", ["Não consigo ouvir áudio, pode escrever?"])).toBe(false);
  });
  it("áudio que falhou: frase aprovada", () => {
    expect(ok("fora-audio-falhou", ["Vi que você mandou um áudio, mas ele não chegou certinho aqui do meu lado 😊 Pode me mandar de novo ou escrever?"])).toBe(true);
    expect(ok("fora-audio-falhou", ["Não consigo ouvir áudio."])).toBe(false);
  });
  it("sim quero ver: uma pergunta por vez e puxa visita", () => {
    expect(ok("int-sim", ["Que bom! É para morar ou investir?", "Dá para marcar uma visita no sábado."])).toBe(true);
    expect(ok("int-sim", ["Morar ou investir? Quantos quartos?", "Vamos visitar?"])).toBe(false);
  });
  it("outro perfil: no máximo 3 imóveis", () => {
    expect(ok("int-outro-perfil", ["O que busca hoje?", "Tem Casa Tua, Essence e Boa Vista."])).toBe(true);
    expect(ok("int-outro-perfil", ["O que busca?", "Open Bosque, Skyglass, Casa Tua e Golden Lake."])).toBe(false);
  });
  it("já comprei: parabeniza e encerra", () => {
    expect(ok("rec-ja-comprou", ["Parabéns pela compra!"], "descartar")).toBe(true);
    expect(ok("rec-ja-comprou", ["Parabéns!"], "morno")).toBe(false);
  });
  it("irritado: desculpa e oferece parar", () => {
    expect(ok("rec-irritado", ["Desculpa o incômodo. Quer que eu pare de enviar?"])).toBe(true);
    expect(ok("rec-irritado", ["Temos ótimas opções!"])).toBe(false);
  });
  it("sem renda: entrada caso a caso", () => {
    expect(ok("fin-sem-renda", ["Dá para montar a entrada caso a caso com o especialista."])).toBe(true);
    expect(ok("fin-sem-renda", ["Infelizmente não dá."])).toBe(false);
  });
  it("opt-out: frase curta e encerra", () => {
    expect(ok("rec-optout", ["Tudo bem, você não vai mais receber mensagens. Desculpe o incômodo."], "descartar")).toBe(true);
    expect(ok("rec-optout", ["Tudo bem."], "morno")).toBe(false);
  });
});
