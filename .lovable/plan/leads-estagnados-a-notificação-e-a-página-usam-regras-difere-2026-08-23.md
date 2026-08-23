# Leads estagnados: a notificação e a página usam regras diferentes

## O que está acontecendo (confirmado nos dados)

Existem hoje **dois conceitos de "estagnado"** no sistema, e eles não conversam:

1. **A notificação** que o Bruno recebe vem da **cadência Sem Contato**. Quando a cadência se esgota (T7) ou a tarefa fica 48h atrasada, a rotina do banco marca o lead como `estagnado = true` **e também `arquivado = true`**, e manda a notificação "🛑 Lead estagnado: … Defina o destino na Central de Leads Estagnados".
2. **A página /leads-estagnados** ignora completamente essa marcação. Ela lista apenas leads **não arquivados** cuja *saúde por toque* está "estagnado" (Sem Contato 15 dias, Qualificação/Aquecimento 21 dias sem toque).

Resultado: o lead notificado é arquivado no mesmo instante e some da página. Verificado nos leads notificados hoje ao Bruno (Gabriela Peixoto, Andrea Lima, Martina de Leo, Fabiana Hoffmann, Carol Sanches, Matheus Beck, Simone, Jonathas, Gabriela Eckert, Alex Tarnoski): **todos com `arquivado = true`**, e a maioria com apenas 2-3 dias sem toque (saúde "ambar", nem estagnado pela régua da página).

Escala do problema: **726 leads** marcados `estagnado = true` + `arquivado = true` desde 30/06/2026 — **479 são da equipe do Bruno**. Nenhum deles aparece na página. Não é problema de permissão: a régua de gestor da página funciona (a equipe do Bruno tem 99 leads que se encaixam na régua de saúde e esses ele consegue ver).

## Correção proposta

Unificar: a página passa a ser a caixa de entrada de **tudo que o sistema chamou de estagnado**, que é exatamente o que a notificação promete.

1. A consulta da página passa a incluir também os leads com a **marcação oficial** `estagnado = true` aguardando decisão, mesmo arquivados — hoje eles são invisíveis. Continuam fora: vendidos, descartados de fato e pós-vendas.
2. Separar em duas abas para não misturar as réguas:
   - **Aguardando decisão** (marcação da cadência: T7 esgotado / tarefa 48h atrasada) — é a aba que casa com a notificação, e vira a aba padrão.
   - **Estagnados por inatividade** (régua de saúde por toque, comportamento atual da página).
   - "Em parceria" segue como está.
3. As ações existentes (Devolver, Repassar, Roleta, Descartar) passam a funcionar também para os leads marcados: ao decidir, o lead deixa de ficar arquivado/marcado, conforme a ação.
4. Cada linha mostra **por que** está ali ("cadência esgotada", "tarefa 48h atrasada" ou "X dias sem toque"), para o gestor entender a diferença.

Sem mudar nenhuma regra de cadência, de distribuição ou de descarte — só passa a exibir e permitir decidir sobre o que já foi marcado.

## Detalhes técnicos

- Migration única: `CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()` — adicionar um segundo braço (UNION) para `pipeline_leads` com `estagnado = true AND estagnado_em IS NOT NULL`, sem o filtro `arquivado = false`, mantendo os filtros `negocio_id IS NULL`, `modulo_atual <> 'pos_vendas'` e o mesmo gate de papéis (admin/diretor ou gestor via `team_members.gerente_id = auth.uid()`). Nova categoria `aguardando_decisao` e coluna `motivo` no `RETURNS TABLE`.
- `public.decidir_lead_estagnado` — ao concluir qualquer ação, limpar `estagnado`, `estagnado_em`, `estagnado_aviso_em`, `estagnado_prazo_em` e `arquivado` (exceto na ação `descartar`, que segue arquivando).
- Frontend: `src/hooks/usePipelineEstagnacao.ts` (tipos `CategoriaEstagnacao` + `motivo`) e `src/pages/LeadsEstagnados.tsx` (nova aba padrão, texto explicativo, coluna de motivo). Sem alteração em `src/lib/leadSaude.ts`.
- Validação: rodar a contagem por categoria da equipe do Bruno antes/depois e conferir ao vivo, com um lead notificado hoje, que ele aparece na aba "Aguardando decisão" e que uma ação (em lead de teste, cancelando ao final) o remove da lista.
