## Auditoria completa da página PDN + correções

Investiguei o hook (`usePdn.ts`), a página (`PdnGestor.tsx`), o Kanban e as políticas de acesso da tabela `pdn_entries`. Encontrei a causa de cada problema relatado + bugs adicionais.

### 1. José Lauro da Rosa aparecendo em Em Negociação (duplicado)

No banco existem **dois** leads do mesmo cliente (mesmo telefone), ambos da Jéssica França:
- `jose lauro da Rosa` em **Ganho** — é a venda real (a que conta em Vendas Realizadas).
- `jose lauro da Rosa` em **Em Negociação** — duplicata antiga (origem "venda", parada desde março), que polui o PDN.

**Correção:** arquivar (inativar) o lead duplicado de Em Negociação — `arquivado = true`, `tipo_descarte = definitivo`, motivo "Duplicado — venda já registrada". Não toca no lead Ganho nem na venda.

### 2. Causa-raiz (categoria): PDN mostra leads arquivados

A consulta de leads do PDM (`loadDeals` em `usePdn.ts`) busca `pipeline_leads` por etapa **sem filtrar `arquivado`**. Ou seja, qualquer lead arquivado/descartado continua vazando para o PDN — foi exatamente o que aconteceu com o duplicado.

**Correção:** adicionar `.eq("arquivado", false)` na consulta de `pipeline_leads`. Isso resolve o duplicado de forma permanente e previne casos futuros.

### 3. Botões "Apagar" não funcionam

As políticas de acesso da tabela `pdn_entries` só permitem editar/excluir quando `auth.uid() = gerente_id`. Como o PDN é aberto por Admin/CEO/Diretor sobre a planilha de **outro** gestor, ao clicar em excluir/remover:
- linha manual criada por outro gestor → exclusão retorna 0 linhas (falha silenciosa, "sucesso" no toast mas nada some);
- linha do pipeline com overlay de outro gestor → ocultar também falha.

**Correção (migração):** ampliar as políticas de UPDATE e DELETE de `pdn_entries` para permitir também `has_role(admin)` e `has_role(diretor)`, além do próprio gestor. Assim o botão apaga de fato.

### 4. Quebra de linha em Observação e Empreendimento

- **Observação:** hoje o texto fica cortado em 2 linhas (`line-clamp-2`). Vou permitir quebra real de linha (`whitespace-pre-wrap break-words`, limite de ~4 linhas) para o texto envolver sem esticar a coluna.
- **Empreendimento:** hoje é um campo de linha única (`Input`) que trunca nomes longos. Vou trocar por uma célula editável que **quebra o texto em várias linhas** (mostra o nome completo envolvido; clique para editar), mantendo a edição do gestor.

### Observações da auditoria (sem mudança de comportamento além do acima)
- Excluir linha do pipeline continua sendo "ocultar da planilha" (não altera o pipeline do corretor) — correto e mantido.
- O painel "Possíveis duplicados" já sinaliza casos como o do José Lauro; após o filtro de arquivados, o duplicado some da lista.

### Arquivos afetados
- `src/hooks/usePdn.ts` — filtro `arquivado=false` na consulta do pipeline.
- `src/pages/PdnGestor.tsx` — quebra de linha em Observação e Empreendimento.
- Migração de banco — políticas UPDATE/DELETE de `pdn_entries` para admin/diretor.
- Correção de dado — arquivar o lead duplicado José Lauro (Em Negociação).
