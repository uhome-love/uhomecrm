# Limpar o histórico "nurturing_sequencia" que aparece a cada mensagem no WhatsApp

## O que aconteceu (conferido nos dados)
- Não é nutrição rodando. Esse lead (55 51 9180-4401) mandou 2 mensagens no WhatsApp hoje (18:34 e 18:40).
- A primeira mensagem veio de um número que o CRM não conhecia, então o sistema criou o lead ("WhatsApp remetente novo") — por isso está em Novo Lead, sem nome.
- A cada mensagem recebida, o robô de pontuação grava **3 registros** na História: "respondeu via whatsapp", "Evento: whatsapp_respondeu" (score) e "Sugestão IA para abordagem". 2 mensagens = 6 registros. Se o cliente mandar 10 mensagens, viram 30.
- Isso acontece com qualquer lead que responde no WhatsApp, não só este.

## O que será feito
1. **Parar de poluir a História:** o robô continua calculando a pontuação e avisando o corretor, mas grava no máximo **1 registro curto** por conversa ("Cliente respondeu no WhatsApp") a cada 6 horas, em vez de 3 por mensagem. Pontuação e "Sugestão IA" deixam de virar item da História.
2. **Esconder os já gravados:** os registros antigos desse tipo saem da aba Narrativa e vão para a aba Sistema (nada apagado; gestão continua podendo ver).
3. Nada muda em corretor, etapa, roleta, Fila do CEO ou na mensagem do disparo com o "Sim".

## Validação
- Abrir este lead no preview: Narrativa sem os 6 itens repetidos.
- Mandar mensagens de um lead de teste e conferir que entra só 1 registro.

## Detalhes técnicos
- `supabase/functions/nurturing-orchestrator/index.ts` (inserts em `pipeline_atividades`, linhas ~225–293): para evento `whatsapp_respondeu`, não inserir score/sugestão IA; inserir resumo único com dedup de 6h por lead (checar última atividade `tipo='nurturing_sequencia'`). Deploy só dessa função.
- Frontend (aba História): classificar `tipo='nurturing_sequencia'` como Sistema, não Narrativa.
- Sem migration, sem apagar dados.
