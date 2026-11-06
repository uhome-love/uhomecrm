# Piloto da Lia Recupera — plano (nada é ligado sem aprovação final do Lucas)

Fases pequenas, cada uma conferida antes da próxima. Todas as regras ficam no arquivo compartilhado da Recupera (vale para simulação, Laboratório e envio).

## Fase 0 — Conferência inicial (só leitura)
- Mapear como a Lia hoje recebe respostas (botões e texto), como inativa opt-out, como manda para a Fila CEO e como mede qualidade do número na Meta.
- Listar o que já existe e o que falta antes de construir. Resultado vai para o Lucas antes da Fase 1.

## Fase 1 — Laboratório das respostas (trava antes de ligar)
- Cenários no Laboratório usando clientes reais da simulação (sem enviar nada):
  - "Sim, quero ver": Lia lê o histórico do CRM e faz só a pergunta que falta do Método, uma por vez; nunca lista/tabela; no máximo 3 opções; sempre puxa para a visita.
  - "Outro perfil": pergunta o que busca hoje e oferece até 3 imóveis do Natal nesse perfil.
  - "Não quero mais contato": frase curta e educada + inativação.
  - Texto livre: vários exemplos (dúvida de preço, pergunta sobre financiamento — 35 anos com ressalva, nunca inventar valor).
  - Cenários de CENARIOS_LABORATORIO, cada um com a ação esperada conferida:
    - "É robô?": confirma com honestidade que é a assistente virtual da Uhome e segue a conversa.
    - Manda áudio: pede para escrever ou reenviar.
    - Pede o corretor antigo: diz que um especialista vai atender, sem citar nome e sem devolver para quem descartou.
    - Fica irritado: pede desculpas, oferece parar e, se o cliente quiser, inativa.
    - "Já comprei": parabeniza, marca já_comprou e para tudo.
    - "Não tenho renda/condição": não insiste, mostra que dá para montar a entrada caso a caso e não promete aprovação.
- Tela mostra a resposta de cada cenário para o Lucas aprovar. Sem aprovação, o piloto não liga.

## Fase 2 — Respostas reais (construído, mas desligado)
- Qualquer resposta para a cadência na hora.
- Opt-out: inativa na hora e entra na lista de nunca enviar.
- Interesse recuperado: Fila CEO com cartão "Recuperado pela Lia" (resumo da conversa), aviso imediato (sino + push) para Lucas e Gabrielle; nunca volta para o corretor que descartou.
- Se ninguém repassar o recuperado em 30 minutos dentro do horário comercial, novo aviso para Lucas e Gabrielle.

## Fase 3 — Cadência e fila de envio (desligada)
- 1ª mensagem (A/B/C/D) → lembrete D+3 → final D+10, só sem resposta.
- Segunda a sábado, 9h–20h BRT. Máximo 100 primeiras mensagens/dia (lembrete e final fora do limite).
- 1ª mensagem só até 07/12; após 18/12 nenhum dos 6 modelos sai.
- Ordem: descartados nos últimos 90 dias (mais recente primeiro), dentro disso C → B → A → D; depois o restante na mesma lógica.
- Conferência no momento de cada envio (1ª, lembrete e final): NÃO envia se, desde que entrou na fila, o cliente voltou ao Pipeline, tem corretor ativo, comprou, pediu para sair ou respondeu por outro canal.
- A trava atual que recusa lotes lia_recupera_* só é retirada no momento da liberação, pela chave própria do piloto (desligada). Reengajar manual segue igual; o lote antigo pausado continua pausado.

## Fase 4 — Proteção do número
- Pausa automática e aviso ao Lucas se, no dia, "Não quero mais contato" + bloqueios > 5% das entregues, ou se a qualidade do número na Meta cair.

## Fase 5 — Painel do piloto
- Por modelo (A, B, C, D, lembrete, final), sempre sobre ENTREGUES: % resposta, % "Sim, quero ver", % "Outro perfil", % "Não quero mais contato", enviados à Fila CEO, visitas marcadas.

## Fase 6 — Teste ponta a ponta com o número do Lucas
- Envia os 6 modelos de verdade para (51) 99259-7097 (liberação só para esse número).
- Lucas clica nos 3 botões e manda uma resposta em texto; conferimos juntos a resposta da Lia, o cartão na Fila CEO, os avisos (incluindo o de 30 min) e a inativação.
- No fim, o número do Lucas é reativado.

## Liberação
- Só depois de: Laboratório aprovado + conferência ao vivo de cada fase + teste ponta a ponta OK + "pode ligar" do Lucas.

## Prioridade
- Fases 0 e 1 primeiro, o quanto antes.

## Testes
- Ordem de envio, limite 100/dia, horário e dias, datas 07/12 e 18/12, cadência parando com resposta, opt-out nunca mais recebe, Fila CEO sem voltar ao corretor anterior, pausa nos 5%, conferência antes de cada envio (5 casos de bloqueio), reaviso de 30 min só em horário comercial.

## Detalhes técnicos
- Regras em `_shared/liaRecuperaModelos.ts` + novo módulo de cadência compartilhado; chave independente `lia_recupera_piloto_ativo` (desligada).
- Envio via o disparador existente, com reserva atômica por tentativa (regra `_shared/liaEnvioRegras`).
- Painel lê agregados no servidor (admin/diretor).
- Migrations respeitando limite de 2/dia em horário comercial.
