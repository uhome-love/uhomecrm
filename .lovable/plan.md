# Joyce Brazil — por que "sumiu" para o William

## O que a base mostra (verificado)

- O lead **Joyce Brazil** (51998372394) existe uma única vez, **não está arquivado** e **não foi descartado**.
- Responsável: **William Brizola**, `aceite_status = aceito`.
- Hoje 18:16 BRT ela voltou do arquivo para a roleta ("Lead descartado retornou"); às 19:47 BRT o próprio William registrou WhatsApp e o card foi de **Novo Lead → Sem Contato**.
- As políticas de acesso do pipeline liberam o lead para ele (`corretor_id = usuário`), então não é bloqueio de permissão.

Conclusão: o lead está no pipeline dele, na coluna **Sem Contato**. O que falhou foi a **visibilidade na tela**, não o dado.

## Causa provável (ainda não confirmada)

A busca do pipeline é **apenas local**: ela filtra a lista de leads já carregada na tela. Se a lista estiver desatualizada (lead recém-aceito, aba aberta há tempo, cache do app), a busca devolve "nada encontrado" mesmo com o lead existindo no banco — exatamente o sintoma relatado.

Primeiro passo do trabalho é confirmar isso reproduzindo o caso (aceitar um lead de teste e buscar sem recarregar a página).

## O que fazer

1. **Confirmar o diagnóstico**: reproduzir com lead de teste — aceitar e buscar sem recarregar; observar se o card só aparece após refresh.
2. **Atualizar a lista ao aceitar**: garantir que aceitar um lead force a recarga do pipeline, para o card aparecer na hora.
3. **Busca com rede de segurança**: quando a busca local não encontrar nada, consultar o banco pelo termo (nome/telefone) dentro do escopo do usuário e mostrar o resultado com a etapa em que o lead está, com um aviso "encontrado em Sem Contato".
4. **Validar ao vivo** no preview com lead de teste (sem alterar leads reais) antes de considerar pronto.

## Detalhes técnicos

- `src/pages/PipelineKanban.tsx`: `filters.search` filtra em memória sobre `pipeline.leads`.
- `src/hooks/usePipeline.ts` → `loadLeads()`: carrega `arquivado=false` com escopo por papel; corretor vê `corretor_id in [userId, profileId]` e `aceite_status in (aceito, pendente, aguardando_aceite)`.
- Alterações previstas: invalidação/recarga após aceite e um fallback de busca server-side (mesma consulta de `loadLeads`, filtrando por `nome ilike` / `telefone ilike`), sem migration e sem mudança de RLS.

## Fora de escopo

- Não mover, reatribuir ou alterar o lead da Joyce (ele já está correto).
- Nenhuma mudança em regras de descarte, roleta ou reengajamento.
