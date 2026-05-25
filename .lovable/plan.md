## Diagnóstico do bug

A Jéssica preencheu **R$ 312.940** corretamente na aba **Imóvel** do drawer (`handleSaveImovel` usa `parseCurrencyToNumber` com máscara R$ — salvou `vgv_estimado = 312940` ✓).

O problema está no **popup "Contrato enviado"** (e no popup "Proposta enviada"), em `src/components/pipeline/NegocioDetailModal.tsx`:

```tsx
// linha 1084 — input cru, sem máscara de moeda
<Input type="number" value={contVgv} onChange={e => setContVgv(e.target.value)} placeholder="500000" />

// linha 364 — parseFloat direto
vgv_final: contVgv ? parseFloat(contVgv) : fullNeg.vgv_final,
```

Quando a Jéssica digitou o valor com ponto de milhar (`312.942`), `parseFloat("312.942")` interpretou o ponto como **decimal** → gravou **R$ 312,94** em `vgv_final`. Como todas as somas (vendas realizadas, KPIs do gerente, rankings, relatórios) usam `vgv_final ?? vgv_estimado`, esse R$ 312,94 substituiu o valor correto e zerou a venda nas somas.

**Confirmo a regra:** sim, o sistema deve sempre preservar o VGV **exato com centavos** — todas as views/RPCs já tratam `vgv_final` como `numeric` (preserva centavos). O bug é apenas no parse de entrada.

## Correção em 2 partes

### Parte 1 — Corrigir o dado da venda da Jéssica (UPDATE pontual)

```sql
UPDATE public.negocios
SET vgv_final = 312940
WHERE id = '7dfa579a-703a-42c6-8eb1-a01d0e10d3e8';
```

Valor alinhado ao `vgv_estimado = 312940` (R$ 312.940,00 — exatamente o que ela digitou na aba Imóvel).

### Parte 2 — Corrigir o bug nos popups (Proposta + Contrato)

Trocar os 2 inputs `type="number"` por inputs com máscara R$, exatamente como já é feito em `handleSaveImovel`:

**Arquivo:** `src/components/pipeline/NegocioDetailModal.tsx`

1. **Input do popup Proposta (linha 1058)** — usar `formatCurrencyInput` / `handleCurrencyChange`:
   ```tsx
   <Input
     value={formatCurrencyInput(propVgv)}
     onChange={e => setPropVgv(handleCurrencyChange(e.target.value))}
     placeholder="R$ 500.000,00"
     className="h-9 text-sm"
   />
   ```

2. **Input do popup Contrato (linha 1084)** — mesma máscara para `contVgv`.

3. **Submit handlers (linhas 344 e 364)** — trocar `parseFloat(x)` por `parseCurrencyToNumber(x)`:
   ```tsx
   vgv_estimado: propVgv ? parseCurrencyToNumber(propVgv) : fullNeg.vgv_estimado,
   // ...
   vgv_final: contVgv ? parseCurrencyToNumber(contVgv) : fullNeg.vgv_final,
   ```

Isso garante:
- Usuário enxerga sempre o valor formatado (R$ 312.940,00) enquanto digita.
- Backend recebe o número exato com centavos preservados.
- Mesma lógica/máscara da aba Imóvel — consistência total.

## Verificação pós-correção

1. SQL: `SELECT vgv_final FROM negocios WHERE id = '7dfa579a-...'` → `312940`.
2. UI `/vendas-realizadas` → o card da venda mostra **R$ 312.940**.
3. UI `/gerente/dashboard` → KPI vendas da Jéssica sobe ~R$ 312.627 (de 313 para 312.940).
4. UI `/ranking` → posição/VGV da Jéssica reflete o valor correto.
5. Testar abrir popup Contrato em outro negócio, digitar "1.250.000,50" → confirmar que salva `1250000.5` em `vgv_final`.

## Fora de escopo

- Auditar outros formulários de VGV no app (não há indício de bug fora desses 2 popups; o resto já usa `parseCurrencyToNumber`).
- Validação de valor mínimo (poderia ser adicionada depois para prevenir typos, mas não foi pedido agora).
