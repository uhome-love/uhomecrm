import { describe,it,expect } from "vitest";
import { PROPOSTA_ENVIO,validarEnvio,dentroJanelaEnvio } from "./envioProgramado";
import { grupoFicha,materiaisFicha,type FichaLia } from "../components/lia-hub/liaConhecimento";
import { fichaVigente,ultimasExecucoes } from "../components/lia-hub/liaLaboratorioEstado";
import type { Execucao } from "../components/lia-hub/LiaCenarioCard";

describe("envio programado da Lia",()=>{
 it("piloto tem teto concreto 100 e rejeita 101",()=>{expect(PROPOSTA_ENVIO.limite_dia).toBe(100);expect(validarEnvio({...PROPOSTA_ENVIO,limite_dia:101})).not.toBeNull();});
 it("espera 24h sem aceitar 23",()=>{expect(PROPOSTA_ENVIO.espera_horas).toBe(24);expect(validarEnvio({...PROPOSTA_ENVIO,espera_horas:23})).not.toBeNull();});
 it.each([['2026-11-04T11:59:00Z',false],['2026-11-04T12:00:00Z',true],['2026-11-04T22:59:00Z',true],['2026-11-04T23:00:00Z',false]])("horário BRT %s %s",(d,ok)=>expect(dentroJanelaEnvio(PROPOSTA_ENVIO,new Date(d))).toBe(ok));
 it("permite sábado e bloqueia domingo",()=>{expect(dentroJanelaEnvio(PROPOSTA_ENVIO,new Date('2026-11-07T15:00:00Z'))).toBe(true);expect(dentroJanelaEnvio(PROPOSTA_ENVIO,new Date('2026-11-08T15:00:00Z'))).toBe(false);});
 it("virada UTC ainda segue o dia BRT",()=>{const c={...PROPOSTA_ENVIO,inicio:'00:00',fim:'23:59'};expect(dentroJanelaEnvio(c,new Date('2026-11-08T01:00:00Z'))).toBe(true);expect(dentroJanelaEnvio(c,new Date('2026-11-08T03:00:00Z'))).toBe(false);});
 it("sem dias e janela invertida são inválidos",()=>{expect(validarEnvio({...PROPOSTA_ENVIO,dias:[]})).not.toBeNull();expect(validarEnvio({...PROPOSTA_ENVIO,inicio:'20:00',fim:'09:00'})).not.toBeNull();});
});
describe("conhecimento e versão de simulação",()=>{
 const p:FichaLia={id:'1',slug:'golden-lake',nome:'Golden Lake',nome_publico:null,ativo:true,updated_at:'2026-11-04T20:00:00Z',ficha:'dados',midias:{foto:'https://example.com/golden.jpg',inseguro:'javascript:alert(1)'}};
 it("Golden Lake e Essence usam seus próprios slugs",()=>{expect(grupoFicha(p)).toBe('natal');expect(grupoFicha({...p,slug:'essence-canoas'})).toBe('natal');expect(materiaisFicha(p)).toEqual([['foto','https://example.com/golden.jpg']]);});
 it("backup não vira ficha da campanha",()=>expect(grupoFicha({...p,slug:'golden-lake__backup-20261104'})).toBe('anteriores'));
 const e:Execucao={id:'a',cenario_id:'c',conversa:[],conferencias:[],sinal_final:null,passou_automatico:true,avaliacao:'ok',comentario:null,created_at:'2026-11-04T20:00:00Z',ficha_versao:p.updated_at};
 it("nova ficha invalida aprovação antiga sem apagar execução",()=>{expect(fichaVigente(e,p.updated_at)).toBe(true);expect(fichaVigente(e,'2026-11-04T21:00:00Z')).toBe(false);expect(e.avaliacao).toBe('ok');});
 it("empate das datas tem ordenação determinística",()=>expect(ultimasExecucoes([e,{...e,id:'b'}]).get('c')?.id).toBe('b'));
});