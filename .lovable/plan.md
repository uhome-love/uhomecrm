# Permitir N compradores na Intermediação

Hoje a página `/intermediacao` só permite 1 ou 2 compradores. A geração do contrato (preview e documento .docx) **já sabe iterar sobre uma lista de compradores** — o limite de 2 existe apenas em dois pontos: a UI da página e o schema de validação da edge function. Uma aquisição pode ter 3+ compradores, então vamos remover essa trava.

## O que muda

### 1. `src/pages/IntermediacaoPage.tsx` (principal)
Trocar os dois estados fixos (`comprador1`, `comprador2` + boolean `usarComprador2`) por uma **lista dinâmica** de compradores:

- Estado único `compradores: CompradorForm[]`, iniciando com 1 comprador.
- Botão "Adicionar comprador" que anexa um novo formulário em branco (sem limite de 2; pode-se manter um teto alto de segurança, ex. 6).
- Cada comprador além do primeiro ganha botão de remover (lixeira). Rótulos "Comprador 1", "Comprador 2", "Comprador 3"… aparecem quando há mais de um.
- Renderizar a lista com `.map()` usando o componente `CompradorFields` já existente.
- **Validação** (`handleGerar`): validar cada comprador da lista em loop, com rótulo dinâmico ("comprador 2", "comprador 3"…).
- **Payload**: `compradores` passa a ser a lista inteira normalizada; `comprador: compradores[0]` continua para compatibilidade.
- **Edição/carregar histórico**: ao abrir uma intermediação existente, mapear `p.compradores` (array) inteiro para o estado; fallback para `[p.comprador]` em payloads antigos.

### 2. `supabase/functions/gerar-intermediacao/index.ts`
- Alterar o schema `compradores: z.array(CompradorSchema).min(1).max(2)` para remover o teto de 2 (ex.: `.max(6)` ou sem `.max`). O restante já itera corretamente (qualificação, blocos de assinatura, nome do arquivo, histórico).

## O que NÃO muda
- `ContratoIntermediacao.tsx` (preview) já renderiza `data.compradores` via array — nenhuma alteração necessária.
- Blocos de assinatura, qualificação e nome de arquivo na edge function já percorrem a lista.

## Validação (após implementar)
1. Typecheck dos arquivos alterados.
2. No preview `/intermediacao`: adicionar 3 compradores, preencher, e conferir que a prévia do contrato lista os três na qualificação e nos blocos de assinatura.
3. Gerar o documento e confirmar que não há erro de validação da edge function e que os 3 compradores aparecem.
4. Abrir uma intermediação do histórico com 2 compradores e confirmar que carrega corretamente (compatibilidade).

## Detalhe técnico
- Edge function precisa de redeploy após a alteração do schema (feito automaticamente no fluxo de deploy).
- Sem migration de banco: `intermediacoes.payload` é JSON e já guarda o array; `comprador_nome` já é montado via `join(" e ")` sobre a lista.
