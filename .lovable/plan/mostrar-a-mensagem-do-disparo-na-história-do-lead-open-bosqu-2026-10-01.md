# Mostrar a mensagem do disparo na história do lead (Open Bosque e demais)

## O que aconteceu (verificado)
- O registro com o texto do template **nunca foi gravado**. Na Rafaela não existe nenhum registro desse tipo; o "Movido para Novo Lead" que aparece vem de outro lugar.
- Motivo: o registro precisa dizer "quem criou", e o código não preenchia esse campo. O sistema recusava a gravação sem mostrar erro. Por isso nenhum lead que respondeu "Sim" ganhou a mensagem na história.

## O que vai ser feito
1. **Corrigir a gravação:** o registro passa a ser assinado como "sistema", igual aos outros avisos automáticos. Também passa a registrar no log quando falhar.
2. **Preencher os que já responderam:** todos os leads que responderam "Sim" ao `outlet_openbosque` (e aos outros reengajamentos de hoje) ganham agora o registro, com a hora da resposta:
   - título: "Mensagem do disparo outlet_openbosque — cliente respondeu SIM"
   - texto: a mensagem que ele recebeu, com o primeiro nome dele, e "Cliente respondeu: Sim, manda as informações".
3. Nada muda em corretor, etapa, Fila do CEO ou roleta.

## Validação
- Abrir a Rafaela no preview e conferir que a mensagem aparece na História.
- Conferir a contagem: um registro por lead que respondeu "Sim", sem duplicar.

## Detalhes técnicos
- `supabase/functions/whatsapp-webhook/index.ts` → `registrarMensagemEnviadaNaTimeline`: adicionar `created_by: '00000000-0000-0000-0000-000000000000'`, checar `error` do insert e logar em `ops_events`. Deploy só de `whatsapp-webhook`.
- Preenchimento retroativo via `run_sql` (insert em `pipeline_atividades`) a partir das respostas "sim" em `reengajamento_meta_disparos` de hoje, com corpo do template buscado na Graph API; pula leads que já tenham o registro.
- Sem migration.
