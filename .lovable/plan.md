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
  `ia_turnos.contexto` e mostrada na sala ao vivo como um aviso ("a Lia
  entendeu que a apresentação foi aceita"). Não dispara nada.
- O disparo passa a nascer do registro, por gatilho no banco sobre
  `ia_apresentacoes`:
  - `aceite_em` indo de vazio para preenchido → `LeadQualificado`.
  - `confirmada_em` indo de vazio para preenchido → `VisitaMarcada`.
  - O gatilho chama `enqueue_meta_capi_event_lia`, que já é idempotente pelo
    par (lead, nome do evento) e já bloqueia sem `meta_lead_id`.
- Quem preenche esses campos: a sala ao vivo ganha duas ações explícitas
  ("Apresentação aceita" e "Confirmar data da visita"), e a data confirmada é
  escolhida da lista de horários que o sistema gerou — a mesma lista que a
  trava de horário já usa.

O modelo propõe, o código grava, o gatilho converte.

## 3. Depois disso, a bateria nos dois modelos

Com as duas brechas fechadas, rodo os 20 turnos com o `google/gemini-3.6-flash`
que está em `ia_config`, depois os mesmos 20 com um modelo de faixa acima
(troca só no banco, sem deploy), e devolvo a comparação item a item. Itens 16,
17 e 18 são portão duro nos dois. A primeira execução vira a linha de base.

## Detalhes técnicos

- `scripts/lia-prompt.mjs`: gerar e verificar, sem dependência nova; `prebuild`
  no `package.json` e um teste vitest chamando o mesmo verificador.
- Migration única (fora do horário de expediente, dentro do orçamento do dia):
  função de gatilho + `AFTER UPDATE OF aceite_em, confirmada_em` e
  `AFTER INSERT` em `public.ia_apresentacoes`, disparando só na transição de
  nulo para valor, com `EXCEPTION WHEN OTHERS` para nunca derrubar a escrita.
- `supabase/functions/lia-brain/index.ts`: remover a chamada de
  `registrarConversoes`, manter a sugestão apenas em `ia_turnos.contexto`.
- `src/pages/admin/LiaSalaAoVivo.tsx`: aviso de sugestão do modelo e as duas
  ações que escrevem em `ia_apresentacoes`.
- Nada disso liga o envio: `enviar_habilitado` continua falso e `captura_lia`
  vazia.
