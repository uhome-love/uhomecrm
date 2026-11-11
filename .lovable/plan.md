# Lia: corrigir de uma vez as chamadas ao "cérebro" e testar de novo

## O que encontrei
- A última recusa ("lia-chat HTTP 401") foi às 16:59, **antes** de a versão corrigida entrar no ar (17:00). Depois disso ninguém escreveu para a Lia, então a correção ainda não foi testada.
- Revisando todas as partes da Lia, ainda há **3 pontos** que chamam o cérebro sem a senha interna e seriam recusados do mesmo jeito:
  1. Seguimento automático: o resumo da conversa.
  2. Seguimento automático: a mensagem de retomada (reengajar).
  3. Laboratório: a segunda simulação.
- As respostas no WhatsApp (o seu teste) e o primeiro passo do Laboratório já mandam a senha.

## O que vou fazer
1. Criar um único "crachá" interno da Lia, usado por todas as rotinas que chamam o cérebro, para não esquecer nenhuma de novo.
2. Usar esse crachá nos 3 pontos acima e nos que já funcionam (resposta no WhatsApp, resumo, Laboratório).
3. Colocar no ar todas as rotinas da Lia de uma vez: cérebro, WhatsApp, seguimento, Laboratório e recuperação.
4. Conferir que chamadas de fora, sem o crachá, continuam recusadas.
5. Conferir que a trava de teste continua ligada, com só o seu número liberado, e que o seu número não tem bloqueio.

## Depois disso, o seu teste
- Você manda "oi" para a Lia.
- Eu confiro nos registros que o cérebro aceitou o pedido, que a resposta saiu só para o final 7097 e que a conversa aparece em Lia › Conversas.

## O que não muda
- O envio para clientes não é ligado, e a trava de teste continua protegendo.
- Nenhuma mudança no banco de dados.
- Fila CEO, corretores e Roleta não são afetados.

## Detalhes técnicos
- Novo `supabase/functions/_shared/liaInternoHeaders.ts`: devolve `x-lia-cron-secret` (LIA_CRON_SECRET), `apikey` e `Authorization: Bearer <service role>`.
- Usar em: `lia-followup` (linhas ~262, ~447, ~544), `lia-whatsapp` (~565, ~825), `lia-laboratorio` (~37, ~85).
- `lia-chat` mantém a checagem atual (crachá interno ou `requireRealUser` admin/diretor).
- Deploy: lia-chat, lia-whatsapp, lia-followup, lia-laboratorio, lia-reengajar-dispatch.
- Verificação: chamada sem crachá deve dar 401; leitura de `ia_config` (modo_teste/numero_teste) e da supressão do número de teste; logs de lia-whatsapp/lia-chat após o "oi".
