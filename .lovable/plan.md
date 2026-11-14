# Leads do reengajamento sem produto e sem histórico

## O que encontrei
- **Aveino Carvalho** respondeu hoje às 15h57 com o botão **"Sim, pode enviar"**. O CRM não tem registro de mensagem nenhuma enviada a ele com esse botão. O disparo de hoje (convite Open Arvoredo) tem outros botões: "Sim! Gostaria de ir amanhã" e "Não tenho interesse". E o telefone dele não está entre os 1.915 envios. Ele também não estava em nenhuma fila de disparo ativa. Por isso não dá para afirmar qual mensagem ele clicou: ela foi enviada fora do registro do CRM.
- **Ele já é cliente conhecido.** Está na Base Única como "Avelino Derli Carvalho", com formulário do Facebook do **Vista Nova Carlos Gomes**, de 31/10/2024. O CRM não fez essa ligação porque o WhatsApp devolveu o número sem o 9.
- **Mesma situação:** 7 leads entraram como "Reengajamento (Nutrição)" sem produto nos últimos 60 dias. Em 6 deles, achei no registro a mensagem que receberam pouco antes de responder:

| Lead | Respondeu em | Mensagem recebida antes | Produto |
|---|---|---|---|
| Aveino Carvalho | 14/11 | não registrada no CRM | Vista Nova Carlos Gomes (pela Base Única) |
| Andre Medeiros Farias | 08/10 | Outlet Open Bosque | Open Bosque |
| ✨ (sem nome) | 02/10 | Outlet Open Bosque | Open Bosque |
| Letícia Martins | 02/10 | Outlet Open Bosque | Open Bosque |
| mara | 01/10 | Casa Tua Canoas, espaço | Casa Tua Canoas |
| Luana | 29/09 | Casa Tua Canoas, espaço | Casa Tua Canoas |
| Daniela Rodrigues | 22/09 | Abertura Casa Tua Canoas | Casa Tua Canoas |

## O que será feito
1. **Corrigir os 7 leads:** preencher o produto da tabela acima e acrescentar ao histórico uma anotação com a mensagem que o cliente recebeu, o texto ou botão que ele respondeu e a data. No caso do Aveino, a anotação diz que a mensagem original não está registrada no CRM e que o produto veio do cadastro antigo dele. Corretor, etapa e distribuição continuam iguais.
2. **Evitar novos casos:** quando alguém desconhecido responder no WhatsApp e virar lead, o CRM procura nesta ordem:
   - a mensagem respondida, pelo código do WhatsApp;
   - o último disparo para aquele telefone, com ou sem o 9;
   - o cadastro na Base Única.
   
   O primeiro que encontrar define o produto e a origem. O histórico sempre mostra o que o cliente respondeu, se foi texto ou botão, e qual mensagem originou a resposta. Quando a mensagem não for achada, o histórico diz isso claramente.
3. **Guardar o código da mensagem respondida.** Hoje esse código se perde nas respostas por botão, e é ele que identifica exatamente a mensagem que o cliente clicou.

## Validação
- Conferir os 7 leads no banco e abrir a ficha do Aveino no computador e no celular (390px), só para ver, sem alterar nada.
- Teste simulando uma resposta de um número sem o 9, com cadastro na Base Única, para confirmar que o produto e o histórico são preenchidos. O teste não cria nem distribui lead real.

## Detalhes técnicos
- Backfill via run_sql: `pipeline_leads.empreendimento` + `campanha` (o produto oficial é recalculado pelo gatilho a partir da campanha), mais `pipeline_atividades` do tipo `nurturing_sequencia`.
- `whatsapp-webhook`: no ramo "remetente novo", guardar `msg.context.id` em `whatsapp_respostas.payload_raw` e reaproveitar `resolveReengEmpreendimento`. Como último recurso, consultar `base_leads.telefone_key` (últimos 8 dígitos) → `empreendimento_texto`/`primeiro_formulario` em `origem_detalhe`. Sem migration.
