# Correção — Configurações do Mutirão some + Vincular apelido bloqueado

Dois bugs distintos, ambos reproduzidos/confirmados.

## Bug 1 — A aba "⚙️ Configurações" do Mutirão abre e fecha sozinha

Reproduzido ao vivo no preview: ao clicar em "⚙️ Configurações", a URL vira
`/oferta-ativa-ao-vivo?view=config` e, milissegundos depois, algo faz um
`replace` de volta para `/oferta-ativa-ao-vivo` — a tela volta para "Painel Ao Vivo".

Causa: como o CRM mantém as abas montadas em segundo plano, duas telas
reescrevem a URL global mesmo quando não estão visíveis:

- `src/pages/AgendaVisitas.tsx` (linhas ~490-497): efeito que monta uma
  `URLSearchParams` do zero e chama `setSearchParams(..., { replace: true })`.
  Como `setSearchParams` muda de identidade a cada navegação, o efeito dispara
  em qualquer troca de aba e apaga a query string de quem está na tela.
- `src/pages/ImoveisPage.tsx` (linhas ~136-139): mesmo padrão com os filtros de imóveis.

Correção:

- Em ambas as páginas, só escrever na URL quando aquela página for a rota ativa
  (comparar `useLocation().pathname` com a rota da própria página) e remover
  `setSearchParams` da lista de dependências do efeito.
- Nenhuma mudança de comportamento para quem está usando Agenda de Visitas ou
  Imóveis: os filtros continuam refletidos na URL enquanto a tela estiver ativa.

Validação: abrir Mutirão → Configurações com as abas Agenda de Visitas e Imóveis
abertas, e confirmar que a tela de Configurações permanece.

## Bug 2 — "Não foi possível vincular: invalid input value for enum app_role: 'gerente'"

Confirmado no banco: as funções `vincular_alias_com_backfill` e
`list_empreendimentos_nao_resolvidos` checam
`has_role(auth.uid(), 'gerente')`, mas o papel "gerente" não existe no sistema —
os papéis válidos são `admin, gestor, corretor, backoffice, rh, diretor`.
O valor inválido derruba a função antes mesmo de avaliar o `admin`, por isso nem
o CEO consegue vincular.

Correção (migration, apenas troca da checagem de permissão):

- Substituir `'gerente'` por `'gestor'` e incluir `'diretor'` nas duas funções,
  ficando: admin OU diretor OU gestor podem listar e vincular apelidos.
- Nenhuma outra lógica das funções é alterada (backfill, validações e inserts
  permanecem iguais).

Validação: como CEO, clicar em "Vincular" em "Casa Tua Porto Alegre - v3" e "- v4"
e confirmar o vínculo + o card de não resolvidos sumindo/atualizando.

## Detalhes técnicos

- Arquivos: `src/pages/AgendaVisitas.tsx`, `src/pages/ImoveisPage.tsx`.
- Migration: `CREATE OR REPLACE FUNCTION` das duas funções (sem DDL de tabela,
  sem mudança de assinatura, grants preservados).
