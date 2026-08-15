# Botão "Atualizar" da página LIA · Uhome — feedback visual

O botão já funciona: ele recarrega todas as consultas da página (estados, últimas mensagens, conversas de hoje, conversa aberta, follow-ups, templates e leads do pipeline). O que falta é sinal visual de que algo aconteceu.

## O que muda

- Ao clicar, o ícone circular passa a girar e o botão fica desabilitado.
- Quando todas as consultas terminam de recarregar, o giro para e o botão volta ao normal.
- Nada muda nos dados, nas abas, nas regras ou no backend.

## Técnico

- Arquivo tocado: `src/pages/admin/LiaHub.tsx` (somente).
- Estado local `atualizando`; `onClick` vira async: `await qc.invalidateQueries({ queryKey: ["lia-hub"] })` dentro de try/finally.
- Ícone `RefreshCw` recebe `animate-spin` condicional; `disabled={atualizando}` no `Button`.

## Validação

Abrir /admin/lia-hub, clicar em Atualizar e conferir o giro durante o refetch e o retorno ao estado normal ao final.
