# Cauã Santos — leads remanescentes para o Junior Padilha

## O que foi verificado no sistema

- Cauã Santos (caua.uhome@gmail.com) **já está desligado**: cadastro inativo e status "inativo" no time do Junior. O acesso dele está encerrado.
- O que sobrou é a carteira: **18 leads ainda no nome dele**, sendo 11 já arquivados e **7 ativos aparecendo no pipeline**:
  - Sem Contato: Marcos, Adriana Wagner Avulso
  - Qualificação: Marisete Vuaden, Nilson Schneider, Jéssica Goulart
  - Aquecimento: Sandra Joseane
  - Caiu: Edna
- Todos já estão com aceite concluído (nenhum preso em fila de aceite).
- Nenhum negócio aberto e nenhuma visita marcada no nome dele.
- Tarefas: 5 pendentes ligadas a esses leads (as demais já concluídas/canceladas).

## O que será feito

Passar os leads remanescentes do Cauã para **Junior Padilha (gerente)**:

1. Transferir os **6 leads ativos** (Sem Contato, Qualificação, Aquecimento) para o Junior, mantendo a etapa atual — sem voltar para "Novo Lead" e sem novo fluxo de aceite.
2. O lead em **Caiu (Edna)** também passa para o Junior, para não ficar órfão no histórico.
3. As **5 tarefas pendentes** acompanham os leads (passam a aparecer para o Junior).
4. Os **11 leads arquivados** também trocam de dono, para o histórico/relatórios não ficarem apontando para um corretor desligado.
5. Registrar a movimentação no histórico de cada lead ("Carteira transferida — corretor desligado").

## O que NÃO muda

- Etapa, substatus, anotações, histórico e dados dos leads.
- Nada é descartado nem apagado.
- Cadastro do Cauã continua inativo como está.

## Detalhes técnicos

- Data change (sem migration): `UPDATE public.pipeline_leads SET corretor_id = '7a270cc1-…' (auth_id do Junior), updated_at = now() WHERE corretor_id = '2e7b12d9-…'` — inclui arquivados.
- `pipeline_tarefas` pendentes: atualizar `responsavel`/`corretor_id` conforme a coluna usada, junto com os leads.
- Insert em `pipeline_historico` por lead, com observação da transferência.
- Não mexe em `negocios` (zero registros), `visitas` (zero marcadas), `team_members` nem `profiles`.

## Validação depois

- Abrir o Pipeline filtrando por Junior Padilha e conferir os 7 leads ativos.
- Conferir que Cauã não aparece mais com carteira em Meu Time / filtros de corretor.
- Conferir as 5 tarefas pendentes agora na Central de Tarefas do Junior.
