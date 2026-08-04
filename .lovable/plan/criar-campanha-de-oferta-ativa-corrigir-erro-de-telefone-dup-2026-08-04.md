# Criar campanha de Oferta Ativa: corrigir erro de telefone duplicado + prazo indeterminado

## 1. O erro "duplicate key ... idx_oa_leads_unique_phone_active"

O banco tem uma trava: o mesmo telefone não pode estar em duas campanhas de Oferta Ativa ao mesmo tempo (nos estados na fila / em cooldown / aproveitado). A criação da campanha hoje só evita telefones que estão em campanhas **liberadas e ainda dentro do prazo** — e faz essa comparação pelos **8 últimos dígitos**, enquanto a trava do banco compara o **telefone inteiro**.

Verificado na base agora:
- 3.278 leads de Oferta Ativa estão nesses estados em campanhas **pendentes ou já expiradas** — invisíveis para o filtro atual, mas ainda ocupando a trava.
- 8 telefones estão duplicados dentro da própria Base Única, ou seja, a mesma criação pode tentar inserir o mesmo número duas vezes.

Qualquer um dos dois estoura o erro e a campanha inteira falha.

### Correção
Atualizar as funções `criar_campanha_da_base_v2` e `preview_campanha_da_base_v2` (para o número do preview bater com o que realmente será criado):
- Passar a excluir telefones que já estão ocupados em **qualquer** campanha (independentemente de a lista estar liberada, pendente ou expirada), comparando pelo telefone completo — exatamente o mesmo critério da trava do banco.
- Deduplicar a seleção por telefone antes de inserir (um registro por número).
- Como cinto de segurança, `ON CONFLICT DO NOTHING` na inserção, para nunca mais derrubar a criação inteira por causa de um número.

Resultado: a campanha é criada sempre; números já em uso simplesmente não entram, e o total mostrado reflete o que entrou de fato.

## 2. Prazo indeterminado

Hoje a campanha exige uma data de expiração. Vamos permitir campanha **sem prazo**:
- Novo botão/opção "Sem prazo (indeterminado)" ao lado dos atalhos 24h / 3 dias / 7 dias no passo "2 · Campanha". Ao marcar, o campo de data é desabilitado e a campanha é gravada sem data de expiração.
- O banco já aceita campanha sem prazo (`expira_em` nulo) e as regras de visibilidade e o encerramento automático já tratam "sem prazo" como sempre ativa — nenhuma mudança de banco é necessária para isso.
- Encerramento manual continua disponível na aba Campanhas.

## Detalhes técnicos

- Uma migration com `CREATE OR REPLACE FUNCTION` para `criar_campanha_da_base_v2` e `preview_campanha_da_base_v2`: CTE `oa` passa a ler `oferta_ativa_leads` por `telefone_normalizado` completo sem filtrar por status da lista; `sel` ganha `DISTINCT ON (telefone_normalizado)`; `INSERT ... ON CONFLICT DO NOTHING`.
- Frontend: `PassoIdentidade.tsx` (campo `expira` aceita string vazia + atalho "Sem prazo"), `CriarCampanhaDialog.tsx` (envia `expira_em: null` quando vazio) e o tipo em `useBaseLeads.ts` (`expira_em: string | null`).
- Validação: criar uma campanha real com o mesmo filtro que falhou e confirmar que ela é criada, mais uma campanha sem prazo aparecendo como ativa para os corretores.
