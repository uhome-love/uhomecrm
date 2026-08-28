# Card de negócio diz "última atividade há 51d" com atividade de hoje

## O que está acontecendo (confirmado nos dados)

O lead Larissa Schreinert tem atividade registrada **hoje** (28/08, 10:50 BRT — WhatsApp), e o carimbo de toque do lead está atualizado (`ultimo_toque_at = 28/08`).

Mesmo assim o card mostra "última atividade · há 51d". O 51 vem de outra coisa: a **data da última troca de etapa** (08/07/2026), que é exatamente 51 dias atrás.

Ou seja: o rótulo diz "última atividade", mas o número exibido é "dias parado na etapa". Não é problema de dado — é o campo errado sendo lido.

## Correção proposta

No board de Negócios, calcular o "há Xd" a partir da **última atividade real** do lead (mesma régua do card do Pipeline), com fallback só quando não houver atividade:

- Leads: usar `ultimo_toque_at` → e só se estiver vazio cair para distribuição/criação.
- Negócios: usar o toque do lead vinculado em vez da data de atualização do registro do negócio.
- Manter o comportamento atual para negócios ganhos (mostra "assinado · data").
- Consequência: as cores de alerta (âmbar 7d / vermelho 14d) passam a refletir tempo sem contato de verdade.

Nenhuma mudança de banco e nenhuma migration.

## Validação

- Abrir o card da Larissa no board de Negócios: deve mostrar "há 0d" (atividade de hoje).
- Conferir 2–3 outros cards contra a aba História do lead.
- Conferir que negócio ganho continua exibindo "assinado · dd/MM".

## Detalhes técnicos

- Arquivo: `src/hooks/useNegociosBoard.ts`.
  - Linha ~194: `diasDe(stage_changed_at ?? updated_at)` → `diasDe(ultimo_toque_at ?? distribuido_em ?? created_at)`.
  - Linha ~239: `diasDe(n.updated_at)` → dias do `ultimo_toque_at` do lead vinculado, com fallback para `n.updated_at`.
- Exibição em `src/components/pipeline/NegociosBoardInline.tsx` (linha 602) não muda.
