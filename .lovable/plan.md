## Diagnóstico

A aba **Equipes** do Pipeline falha para **todos os perfis autorizados** (CEO/admin e diretora Gabrielle), não é problema de permissão. A função de backend `get_pipeline_equipes_overview()` referencia duas colunas que não existem na tabela de metas mensais:

- usa `cm.gerente_auth_id`, mas a coluna real é `gerente_id`
- usa `cm.meta_vgv`, mas a coluna real é `meta_vgv_assinado`

Por isso a função lança erro e a tela mostra "Não foi possível carregar a visão de equipes".

Confirmado: `ceo_metas_mensais.gerente_id` guarda o ID de autenticação do gestor (mesmo usado no restante da função), então o join fica correto após o ajuste.

## Plano

1. **Corrigir a função `get_pipeline_equipes_overview()` (migração no backend)**
   - Trocar o join `cm.gerente_auth_id = go.gerente_id` por `cm.gerente_id = go.gerente_id`.
   - Trocar `cm.meta_vgv` por `cm.meta_vgv_assinado` (mantendo a chave `meta_vgv` no JSON de saída, que o frontend já espera).
   - Manter todo o resto da lógica igual (BRT, filtros de fase, acesso só para admin/diretor).

2. **Validar**
   - Rodar a função autenticado como CEO e confirmar retorno com escritório + gestores + corretores.
   - Confirmar na tela `/pipeline-leads` → aba Equipes que carrega para o CEO (Lucas) e para a diretora (Gabrielle).

## Detalhes técnicos

Somente uma migração de banco (substituição da função via `CREATE OR REPLACE FUNCTION`). Nenhuma mudança de RLS necessária — as políticas e o grant `EXECUTE` já estão corretos. Nenhuma alteração de frontend obrigatória; o hook `useEquipesView` volta a funcionar assim que a função parar de dar erro.