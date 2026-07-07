# Melhorias na página de Intermediação

## 1. Campos de moeda pré-formatados (R$ / BRL)

Hoje os campos **VGV**, **Valor total da corretagem** e **Valor das parcelas** são texto livre. A função interna `num()` inclusive falha quando o usuário digita "R$ ..." (o prefixo quebra o `parseFloat`).

Mudança:
- Aplicar máscara de moeda brasileira nos 3 campos, formatando enquanto o usuário digita (ex.: digitar `900000` vira `R$ 900.000,00`).
- Reaproveitar os utilitários já existentes no projeto (`formatCurrencyInput`, `handleCurrencyChange`, `parseCurrencyToNumber` em `src/utils/currencyFormat.ts`) — sem criar código novo de formatação.
- Garantir que o cálculo em tempo real e o envio para geração usem o número correto (via `parseCurrencyToNumber`), corrigindo o bug atual do prefixo "R$".

## 2. Taxas padrão

- **Gabrielle**: alterar o padrão de `15%` para `10%`.
- **Diretoria**: alterar o padrão de `10%` para `5%`.
- Continuam editáveis manualmente; muda apenas o valor inicial.

## 3. Editar uma intermediação depois de gerada

Hoje, se algo precisa ser alterado, é necessário preencher tudo de novo — o histórico só guarda um resumo, não os dados completos.

Mudança:
- Guardar o **conteúdo completo do formulário** (comprador, imóvel, corretores, comissão, parcelas, testemunhas, data) junto ao registro da intermediação.
- No **Histórico**, adicionar um botão **"Editar"** ao lado de Download/Apagar. Ao clicar:
  - Os dados são recarregados na aba "Gerar Intermediação".
  - O usuário ajusta o que precisar e gera novamente o documento atualizado.
- O documento continua sendo `.docx` (editável no Word), mas agora também dá para regerar direto pelo sistema com os dados preservados.

```text
Histórico
 ┌───────────────────────────────────────────────┐
 │ Cliente X · Empreendimento Y   [Editar][⬇][🗑] │
 └───────────────────────────────────────────────┘
        │ clica "Editar"
        ▼
 Aba "Gerar" preenchida com todos os dados → ajusta → Gerar
```

## 4. Melhorias gerais identificadas

- **Máscaras de CPF/CNPJ/RG/telefone/CEP**: aplicar formatação automática nos campos de documento e contato (comprador e corretores), reduzindo erro de digitação no contrato.
- **Correção do bug de valor**: como descrito no item 1, valores com "R$" hoje podem ser interpretados como zero — será corrigido.
- **Percentuais**: adicionar sufixo `%` visual e impedir valores negativos nos campos de comissão.
- **Feedback de soma**: já existe aviso quando parcelas divergem do total e quando % passa de 100% — manter e deixar mais visível.

## Detalhes técnicos

- `src/pages/IntermediacaoPage.tsx`:
  - Trocar `num()` por `parseCurrencyToNumber` nos campos monetários; usar `formatCurrencyInput`/`handleCurrencyChange` no `onChange`/`value`.
  - Ajustar defaults `pctGabrielle="10"`, `pctDiretoria="5"`.
  - Adicionar handler de "Editar" que popula todos os estados a partir do payload salvo e muda para a aba "gerar".
- Migração de banco: adicionar coluna `payload jsonb` em `public.intermediacoes` (com os GRANTs já existentes mantidos).
- `supabase/functions/gerar-intermediacao/index.ts`: incluir `payload: body` no `insert` do histórico.
- `HistoricoTab`: incluir `payload` no select e o botão "Editar" via callback para o componente pai.

Nenhuma alteração de layout estrutural — apenas formatação de campos, defaults e o fluxo de edição.