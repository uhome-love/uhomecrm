# Ficha do lead · rodada de refinamento 2 (só visual)

Só muda a aparência da ficha. Sem migration e sem mudar nada que é gravado. Tudo o que já foi aprovado continua.

## Ordem de trabalho (regra fixa do projeto)
1. Mockup primeiro: um desenho isolado mostrando os itens 2, 3 e 4 (desktop, celular e tema escuro), para você aprovar. A ficha real não é tocada antes disso.
2. Construção só depois do mockup aprovado, em duas fases: linha do tempo (itens 2, 3, 4d e 4h) e cards/abas (itens 4a–4c, 4e–4g e 4i).
3. Validação ao vivo, sem salvar nada, nos leads pedidos: desktop, celular e tema escuro.

## 2. "X dias sem registro" mais discreto
- Sai a caixa e o círculo. No trecho da linha vertical que corresponde ao intervalo, a linha vira tracejada fina, com o texto pequeno em âmbar ao lado ("7 dias sem registro").
- Sai a frase "Nenhum contato registrado nesse período."
- Continua aparecendo só para intervalos de 7 dias ou mais.

## 3. Cor nas atividades (só no círculo; caixas continuam cinza; sem emoji)
- Ligação: azul-claro (sky). WhatsApp: verde do WhatsApp. E-mail: roxo. Presencial: índigo. Nota do corretor: amarelo, com ícone amarelo-escuro.
- Marcos (avançou, voltou, visita, ganho, descarte) mantêm as cores aprovadas.
- Novas cores como tokens do tema, com versão clara e escura.

## 4. Acabamentos
- a) Título da tarefa sem o nome do lead: tira ": {nome}" e " — {nome}" do fim (só na exibição).
- b) Orçamento "0" ou vazio: "Não informado · Preencher".
- c) Novo Lead sem tarefa: "Fazer o primeiro contato · entrou há {tempo}", com Ligar e WhatsApp. Âmbar só se já passou do prazo da etapa; antes disso, neutro.
- d) Formulário do Meta: esconde as linhas internas ("Message Lead Gerado do Formulário…", "Property contract 1"). Mostra só pergunta e resposta, em lista limpa.
- e) "ig" vira "Instagram" e "fb" vira "Facebook", na aba Dados e em todo lugar da ficha onde aparecer.
- f) Aba Dados do lead: sai a barra "Resumo" antiga do topo. Ficam campanha, conjunto, anúncio, formulário e entrou em.
- g) Situação vazia fora de Aquecimento: pill discreta "+ situação", tracejada e cinza. Preenchida, mostra o valor.
- h) Visita realizada com trecho repetido na observação: mostra uma vez só.
- i) Card Negócio: "Assinatura prevista: hoje / amanhã / {dd mmm}", quando houver previsão. Na aba Negócio, valor no mesmo formato da ficha ("R$ 599 mil").

## 5. Investigação (nada muda nesta rodada)
**"Próximo passo: Enviar proposta · 01/05/2026" no Termômetro do Leandro**
- O Termômetro lê dois campos antigos de texto livre do próprio lead (próxima ação e data da próxima ação), não a lista de Tarefas. No Leandro, esses campos têm "Enviar proposta" com data 01/05/2026.
- O card "Próximo passo" da esquerda lê só as tarefas pendentes. O Leandro não tem nenhuma, por isso aparece "Sem próximo passo".
- São duas fontes diferentes. Ninguém atualizou o campo antigo desde maio, e o lápis do Termômetro ainda grava nele.
- Sugestão para uma rodada futura, com sua aprovação: o Termômetro passar a mostrar a próxima tarefa, ou esse campo antigo ser aposentado.

**"Temperatura –" no Termômetro, com o lead Quente**
- O banco tem "quente" gravado no Leandro, então o dado está certo.
- O erro é de exibição: o Termômetro desenha o seletor de temperatura antes de receber o valor. O seletor guarda o primeiro valor que recebeu (vazio, que aparece como "–") e não se atualiza quando o valor chega.
- Correção futura possível, só visual: esperar o valor antes de desenhar o seletor. Não está incluída nesta rodada.

## Testes
- Ivo Xavier: dias sem registro e atividades coloridas.
- Maria Rosa: Novo Lead, formulário limpo e "Instagram".
- Leandro da Nóbrega: orçamento, "Assinatura prevista: hoje" e aba Dados sem a barra antiga.
- Eduarda Vanzin: título da tarefa sem o nome.
- Cássio Gerhardt: "+ situação" e texto repetido.
- Desktop 1280/1440, celular 390 px, claro e escuro, sem salvar.

## Detalhes técnicos
- Arquivos: `DrawerAgora.tsx`, `LeadHistoricoTab.tsx`, `DrawerTimelineGroup.tsx` (linha tracejada), `src/lib/timelineNarrativa.ts` (deduplicação, limpeza do formulário, ig/fb), `ResumoLeadLateral.tsx`, `PipelineLeadDetail.tsx`, `LeadFormRespostas.tsx` / `DrawerOrigemLead.tsx` (aba Dados), `DrawerNegocioTab.tsx` (card e aba Negócio), mais os tokens de cor em `src/index.css`.
- A previsão de assinatura vem do campo do negócio já carregado pela ficha. Os dias são contados em BRT.
- Testes: limpeza do título da tarefa, deduplicação da observação, mapa ig/fb e "orçamento 0 = não informado".
