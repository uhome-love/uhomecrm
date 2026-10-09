# Ana Maria entrou sem história: ligar a resposta ao disparo

## O que aconteceu (verificado)
- A Ana Maria recebeu o disparo **outlet_openbosque** em 08/10 às 23:17 e leu. Hoje às 10:35 ela respondeu **escrevendo uma mensagem**, sem clicar no botão.
- O número do disparo foi gravado **com o 9** (51 9 9213-1848). A resposta chegou do WhatsApp **sem o 9** (51 9213-1848). Por isso o sistema não achou o disparo e tratou a mensagem como de um **contato desconhecido**.
- Nesse caminho, o sistema cria um lead genérico ("Reengajamento (Nutrição)"), sem empreendimento, sem a mensagem do disparo e sem a resposta na história. Foi o que você viu.
- O lead foi para um corretor, mas sem saber que era do **Open Bosque**.

## O que vou fazer
1. Quando chegar mensagem de um número desconhecido, procurar disparos dos **últimos 7 dias** pelos **8 últimos dígitos** (assim, com ou sem o 9 dá certo).
2. Se achar, tratar como resposta àquele disparo: lead entra com o **empreendimento do modelo** (ex.: Open Bosque), e a história mostra **a mensagem enviada + o que o cliente escreveu**.
3. Mesma regra de sempre: quem já tem corretor continua com ele e recebe o aviso; quem não tem segue o fluxo normal.
4. **Corrigir a Ana Maria:** marcar como Open Bosque e colocar na história a mensagem do outlet e a resposta dela. Ela continua com o mesmo corretor.
5. Conferir se outros leads de hoje entraram assim e corrigir do mesmo jeito.

## Detalhes técnicos
- `supabase/functions/whatsapp-webhook/index.ts`, `handleUnknownReply`: antes de criar lead, buscar `reengajamento_meta_disparos` por `right(phone,8)` nos últimos 7 dias; se houver, preencher `responded_at`/`response_text`, usar `empreendimentoFromTemplate` para `campanha` (dispara o recálculo do empreendimento canônico) e chamar `registrarMensagemEnviadaNaTimeline`.
- Backfill pontual do lead `30d9b4d1-…` (campanha + registro na história). Deploy do `whatsapp-webhook`. Sem migration.
