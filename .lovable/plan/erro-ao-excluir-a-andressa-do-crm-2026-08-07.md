# Erro ao excluir a Andressa do CRM

O descarte da carteira funcionou; o que falhou foi o passo final de apagar o login dela ("Database error deleting user").

## Causa confirmada

Apagar o login apaga junto o perfil dela. Mas o perfil ainda está amarrado a registros históricos de Roleta e Oferta Ativa, e o banco bloqueia a exclusão:

- Fila da Oferta Ativa: 503 registros
- Credenciamentos da Roleta: 147
- Distribuições da Roleta: 299
- Fila da Roleta: 147

Nenhum outro vínculo bloqueia (leads, negócios, tarefas, academia estão zerados).

## Correção proposta

Na função de exclusão (`create-broker-user`, ação `delete_user`), antes de apagar o login, limpar essas referências históricas — todas as colunas envolvidas aceitam vazio, então o histórico (data, lead, resultado) continua existindo, só deixa de apontar para o perfil apagado:

1. `oferta_ativa_fila`: zerar `ultimo_corretor_id`, `locked_by`, `claimed_by`
2. `roleta_credenciamentos`: apagar as linhas do corretor (credenciamento é estado atual, não histórico útil)
3. `roleta_fila`: apagar as linhas do corretor (fila é estado atual)
4. `roleta_distribuicoes`: zerar `corretor_id` (mantém o histórico de distribuição)

Depois disso o `auth.admin.deleteUser` roda normal. Também vou tornar o erro mais claro na tela: se ainda sobrar algum vínculo, mostrar qual tabela travou em vez de "Database error".

## Depois do fix

Rodar a exclusão da Andressa de novo pela tela Meu Time (a carteira dela já foi descartada, então a segunda tentativa não vai duplicar nada — o descarte é idempotente por etapa).

## Detalhes técnicos

- Arquivo único: `supabase/functions/create-broker-user/index.ts`, bloco `delete_user`, antes do `auth.admin.deleteUser`.
- Sem migration; nenhuma FK é alterada.
- As colunas `corretor_id`/`locked_by`/`claimed_by`/`ultimo_corretor_id` já são nuláveis (verificado).
