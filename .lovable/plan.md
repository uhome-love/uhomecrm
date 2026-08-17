# Vendas cadastradas em 16/08: impedir retorno como lead novo

## Diagnóstico confirmado

A auditoria cruzou `negocios`, `pipeline_leads`, etapas, perfis e histórico de distribuição em horário BRT.

- O lote alterado em 16/08 contém **9 vendas ganhas**; todas estão na etapa **Ganho** e vinculadas a um negócio.
- **3 vendas voltaram de fato à distribuição hoje**, repetindo Isla/Alto Lindoia:
  - Ana Paula Cruz / Verdes Campos — venda de Larissa Barbosa.
  - Lucas Machado / Open Bosque — venda de Larissa Barbosa.
  - Fernando / Hola — venda de Matheus Pasin.
- Os três ficaram `pendente_distribuicao`, sem corretor no lead, e foram oferecidos novamente; há rejeições registradas hoje pelos próprios corretores.
- Outros **4 leads ganhos do lote** permanecem com aceite antigo `pendente`, embora ainda tenham corretor. Não estão na Fila CEO agora, mas não estão no estado final correto.
- Apenas Isla e Alto Lindoia já foram corrigidos para `aceito`; o lote ainda tem **7 de 9** leads ganhos com aceite não resolvido.
- No universo de **98 vendas ganhas ativas**, há **9 relações lead/venda fora do estado canônico** e **3** atualmente expostas na Fila CEO.

### Causa confirmada

A proteção adicionada hoje em `distribuir_lead_atomico` bloqueia uma nova distribuição, mas atua tarde: `rejeitar_lead`, `expirar_aceites_roleta` e `reciclar_leads_expirados` ainda podem limpar o corretor e gravar `pendente_distribuicao` sem verificar se o lead já está em Ganho/Contrato ou possui negócio ganho.

Além disso, ao mover um card para Ganho, `usePipeline.moveLead` sincroniza etapa e negócio, mas não consolida no lead `aceite_status='aceito'`, corretor dono da venda e fim do SLA de aceite. Por isso estados antigos sobrevivem e depois são reciclados.

## Fase 1 — Saneamento imediato dos dados

1. Corrigir os **7 leads ganhos do lote de 16/08** que não estão canônicos:
   - manter etapa `Ganho` e vínculo com o negócio;
   - definir o corretor do lead usando `profiles.user_id` do `negocios.corretor_id`;
   - definir `aceite_status='aceito'` e `aceito_em` sem apagar histórico;
   - limpar somente campos transitórios de distribuição/expiração.
2. Incluir na mesma correção os **2 outros ganhos ativos divergentes** identificados pela varredura global, após classificar os casos de ex-corretores para preservar o responsável histórico correto.
3. Não alterar VGV, assinatura, fase, comissão, negócio ou histórico de distribuição.

## Fase 2 — Regra única ao registrar Ganho

Criar uma função transacional no banco para consolidar qualquer lead que passe a Ganho:

- resolver corretamente `negocios.corretor_id` (perfil) → `pipeline_leads.corretor_id` (usuário de autenticação);
- garantir etapa `Ganho`, `negocio_id`, `aceite_status='aceito'`, `aceito_em` e corretor da venda;
- cancelar qualquer aceite aguardando e limpar expiração;
- registrar auditoria da consolidação;
- ser idempotente, para poder rodar novamente sem duplicar registros.

O frontend passará a chamar essa operação única ao fechar a venda, em vez de depender de várias atualizações independentes em `usePipeline.moveLead`.

## Fase 3 — Fechar todos os caminhos de retorno

Adicionar a mesma guarda de estado final, antes de qualquer mutação, nos caminhos irmãos:

- `rejeitar_lead`;
- `expirar_aceites_roleta`;
- `reciclar_leads_expirados`;
- ações administrativas/estagnação que mandam para a Fila CEO;
- repasse manual e distribuição forçada.

Para lead em `venda`/`contrato_gerado` ou com negócio `ganho`, a operação deve retornar bloqueada e preservar corretor, aceite e etapa. A guarda atual de `distribuir_lead_atomico` permanece como última barreira.

## Fase 4 — Validação ponta a ponta sem mexer em lead real

1. Criar ou usar um lead de teste controlado com corretor e negócio.
2. Percorrer no preview: pipeline → registrar venda → Ganho.
3. Confirmar no banco:
   - negócio em `fase='ganho'`, assinatura e VGV preservados;
   - lead em etapa `Ganho`, `aceito`, com o mesmo corretor da venda e vínculo bidirecional;
   - zero presença na Fila CEO, Roleta e aguardando aceite.
4. Tentar os caminhos de rejeição, expiração, reciclagem, repasse e distribuição forçada; todos devem bloquear sem mudar o lead.
5. Validar as telas de Ganhos, Vendas Realizadas, PDN e Dashboard CEO para garantir que contagens/VGV não mudaram.
6. Rodar novamente a auditoria global e exigir:
   - `0` ganhos na Fila CEO;
   - `0` ganhos com aceite pendente;
   - `0` ganhos sem o corretor correto;
   - nenhum novo histórico de distribuição para vendas ganhas após a correção.

## Execução em fases

1. Aplicar e validar somente o saneamento dos dados.
2. Aplicar a consolidação transacional ao registrar Ganho.
3. Aplicar as guardas nos caminhos irmãos.
4. Executar a bateria ponta a ponta e apresentar evidências antes de declarar concluído.

## Detalhes técnicos

- A correção de dados será feita pela ferramenta de dados, não por migration.
- Mudanças de funções/guardas serão uma única migration DDL, respeitando o limite operacional de migrations e evitando múltiplos reloads da API.
- A migration deverá preservar permissões atuais das funções e bloquear por regra de negócio, sem ampliar acesso.
- O teste usará exclusivamente lead de teste e ações canceláveis; nenhum lead real será clicado ou movimentado para validação.