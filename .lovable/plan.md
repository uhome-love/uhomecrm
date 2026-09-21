# Eliseu Domingues — voltar para Novo Lead com o Ebert

## Situação atual (confirmada)

- Lead: Eliseu Domingues, 51 99444464, domingues.travel@gmail.com, entrou em 10/04 por anúncio do Casa Tua (vídeo 3D).
- Está ativo no funil do **Ebert Silva**, etapa **Em Negociação** desde 11/09.
- Visita realizada em 29/04 com o Ebert.
- Negócio criado pelo Ebert em 10/09: imóvel avulso na Rua Angelo Dourado, 334, R$ 460 mil (420 mil em carta de crédito + 40 mil em 5x), proposta aguardando aceite, documentação em leitura de contrato, sem assinatura e sem valor final. Esse negócio está **arquivado** desde 11/09.

## O que será feito

1. Mover o lead para a etapa **Novo Lead**, mantendo o **Ebert Silva** como dono (ele já tem histórico relevante com o cliente — visita e proposta).
2. Registrar na linha do tempo do lead o motivo da volta: novo interesse, retomada do atendimento pelo mesmo corretor.
3. Notificar o Ebert no sistema (sininho + pop-up) avisando do novo interesse, com botão para abrir o lead.
4. O negócio antigo continua arquivado — nada muda nele, nem em VGV/relatórios de venda.

## Detalhes técnicos

- `pipeline_leads` (id `89c318b7-b40f-4ed0-a5a7-985303117442`): `stage_id` → Novo Lead (`d3843b2f-2fa1-4c31-9129-4eb0ed21f019`), `stage_changed_at = now()`, `flag_status` limpo, `corretor_id` inalterado (`cc857f25-…` = Ebert), `aceite_status` permanece `aceito` (sem passar por roleta/Fila do CEO).
- Inserir linha em `pipeline_historico` (stage anterior Em Negociação → Novo Lead) com observação descrevendo o novo interesse.
- Inserir linha em `notifications` para o `user_id` do Ebert (`cc857f25-…`), `tipo` de lead reativado/novo interesse, `dados` com `lead_id` e rota para abrir o lead — mesmo padrão já usado nos avisos de reengajamento, que dispara o pop-up em tempo real.
- Tudo via alteração de dados (sem migration, sem mudança de estrutura, RLS ou grants); nenhuma edge function nem frontend muda.

## Validação

- Conferir por consulta que o lead está em Novo Lead com o Ebert e sem marca de arquivado.
- Abrir o preview e confirmar que o card aparece na coluna Novo Lead com o histórico preservado.
- Confirmar que a notificação foi criada para o Ebert.
