# Lia · fechar as duas brechas antes da bateria

Sobre o teste ao vivo, respondendo antes do plano: a mensagem que entrou foi
"Boa noite! Vi o anuncio, quero saber valor e se tem 4 dormitorios." O preço foi
perguntado. A Lia não ofereceu valor sem ser questionada — o primeiro turno não
é sinal ruim sobre o modelo. A bateria mede isso de qualquer forma.

Duas correções, ambas pré-condição para ligar o interruptor.

## 1. O .b64.ts não pode divergir do .txt em silêncio

Hoje o hash prova que o que roda é a versão registrada, mas não prova que o
`.txt` do repositório é o que roda. Editar o `.txt` sem regerar o `.b64.ts`
deixa tudo verde e o ar rodando o prompt velho.

A verificação passa a ser mecânica, não lembrada:

- Um gerador (`scripts/lia-prompt.mjs --gerar`) reescreve o `.b64.ts` a partir
  dos bytes do `.txt`.
- Um verificador (`scripts/lia-prompt.mjs --verificar`) decodifica o `.b64.ts`,
  compara byte a byte com o `.txt` e sai com erro quando divergirem, dizendo
  qual comando regera.
- O verificador entra no `prebuild` do `package.json`: divergiu, o build
  quebra. Entra também como teste (`src/test/lia-prompt.test.ts`), para quebrar
  em `npm test` mesmo sem build.
- O hash registrado em `ia_prompt_versoes` passa a ser conferido pelo mesmo
  verificador contra o comentário do arquivo gerado, fechando o triângulo
  `.txt` = `.b64.ts` = registro no banco.

Editar o prompt e esquecer de regerar deixa de ser silêncio e vira build
vermelho.

## 2. Conversão sai do registro, nunca do JSON do modelo

`registrarConversoes()` hoje dispara CAPI lendo `apresentacao_aceita` e
`visita_confirmada_em` da resposta do modelo. Uma alucinação vira evento pago
enviado ao Meta. Isso sai.

- O JSON do modelo continua sendo lido, mas só como **sugestão**: gravada em
  `ia_turnos.contexto` e mostrada na sala ao vivo como aviso ("a Lia entendeu
  que a apresentação foi aceita"). Não dispara nada sozinho.
- O disparo nasce do registro, por gatilho em `ia_apresentacoes`
  (`AFTER INSERT` e `AFTER UPDATE OF aceite_em, confirmada_em`), só na
  transição de nulo para valor: `aceite_em` → `LeadQualificado`,
  `confirmada_em` → `VisitaMarcada`, via `enqueue_meta_capi_event_lia`, que já
  é idempotente pelo par (lead, evento) e já bloqueia sem `meta_lead_id`.
- **O handler de exceção grava, não engole.** Falha de CAPI não derruba a
  escrita do negócio, mas o `EXCEPTION WHEN OTHERS` registra em `ops_events` o
  erro e o id do registro. Sem isso, uma conversão quebrada dispara nada para
  sempre com o painel verde.
- **Dois caminhos para preencher o registro**, porque o autônomo não tem quem
  olhe turno a turno:
  - Sombra e assistido: duas ações na sala ao vivo ("Apresentação aceita" e
    "Confirmar data da visita"), com a data escolhida da lista de horários que
    o sistema gerou — a mesma lista que a trava de horário usa.
  - Autônomo: a **saída já validada pelas travas** preenche o registro sozinha.
    A sugestão do modelo só vira escrita depois de passar pelas travas, e a
    data confirmada precisa estar na lista de horários ofertados. Fica
    implementado agora, senão a Fase 5 sobe com a conversão morta.

A cadeia é: o modelo propõe, as travas validam, o código grava o registro, o
gatilho converte. O que estava errado era o JSON disparar CAPI direto.

## 3. Depois disso, a bateria nos dois modelos

Com as brechas fechadas, rodo os 20 turnos do documento com o
`google/gemini-3.6-flash` que está em `ia_config.lia_model`, depois os mesmos 20
com um modelo de faixa acima (troca por update no banco, sem deploy).

Devolvo a comparação item a item, com o texto que cada modelo produziu e quais
travas dispararam em cada turno. Itens 16, 17 e 18 (robô, documento com CPF,
pedido de não contato) são portão duro nos dois modelos: qualquer falha
bloqueia. Nos outros 17, o mínimo é 15 aprovados. Tudo gravado com data, versão
do prompt e modelo — a primeira execução é a linha de base.

## Detalhes técnicos

- `scripts/lia-prompt.mjs`: gerar e verificar, sem dependência nova; `prebuild`
  no `package.json` e `src/test/lia-prompt.test.ts` chamando o mesmo
  verificador, incluindo a conferência do hash em `ia_prompt_versoes`.
- Migration única do gatilho (autorizada fora da janela 08h-19h): função +
  `AFTER INSERT` e `AFTER UPDATE OF aceite_em, confirmada_em` em
  `public.ia_apresentacoes`, com `EXCEPTION WHEN OTHERS` que grava em
  `ops_events`. Aplico, confirmo que subiu limpa e testo o disparo num registro
  de teste antes de encerrar.
- `supabase/functions/lia-brain/index.ts`: remover `registrarConversoes`,
  manter a sugestão em `ia_turnos.contexto` e gravar o registro a partir da
  saída aprovada pelas travas quando o modo for autônomo.
- `src/pages/admin/LiaSalaAoVivo.tsx`: aviso da sugestão do modelo e as duas
  ações que escrevem em `ia_apresentacoes`.
- Interruptores desligados o tempo todo: `enviar_habilitado = false` e
  `captura_lia` vazia.

