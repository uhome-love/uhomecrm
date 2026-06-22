## Objetivo

Três ajustes no fluxo `/intermediacao` (página `IntermediacaoPage.tsx` + edge function `gerar-intermediacao`):

1. Corrigir o valor da linha **ZemoBank** para incluir **todos** os credores (inclusive a UHome).
2. Adicionar **campos editáveis para as duas testemunhas**, com atalhos para Carolina (pré-preenchida) e para os gerentes (Junior, Gabriel, Bruno).
3. Conferência de bugs em todos os campos.

Nenhuma mudança de tabela/RLS/Storage. Apenas frontend + edge function.

---

## 1. ZemoBank com todos os valores

Hoje o cálculo do Zemo filtra a UHome de fora:

```text
zemoCred = credores.filter(c => !c.isUhome)   // ❌ exclui a UHome
```

A ZemoBank é quem recebe o total da corretagem, então a linha deve somar **todos** os credores.

- **Edge function** (`calcular`, linhas ~117-121): trocar o filtro por todos os credores → `zemo.total = totalGeral` e `zemo.parcelas = totalLinha`.
- **Frontend** (`calcularCredores`, linhas ~102-108): mesma correção para o preview bater com o documento.

Resultado: a linha ZemoBank passa a exibir o valor total da comissão (igual à linha "Total" da tabela de comissão).

---

## 2. Campos de testemunhas

Hoje as testemunhas são fixas no código (`TEST1` = Gabriel Vieira, `TEST2` = Carolina). Vamos torná-las editáveis.

**Frontend — novo card "Testemunhas"** (antes do botão Gerar):
- Dois blocos (Testemunha 1 e Testemunha 2), cada um com **Nome** e **E-mail** editáveis.
- Cada bloco tem um `Select` "Preencher rapidamente" com as opções:
  - **Carolina de Camargo Madruga** — `carolina@uhome.com.br` (fixa).
  - Os gerentes/corretores carregados de `get_corretores_intermediacao` (já trazem nome + e-mail), o que cobre Junior, Gabriel e Bruno — assim, quando a venda não for de um gerente, o outro pode entrar como testemunha.
- Selecionar uma opção preenche nome/e-mail, mas os campos continuam editáveis manualmente.
- **Padrão inicial:** Testemunha 2 já vem com Carolina pré-preenchida; Testemunha 1 vazia.
- Validação: exigir nome+e-mail das duas testemunhas no `handleGerar`.

**Edge function:**
- Adicionar `testemunhas` ao `BodySchema` (array de 2 itens `{ nome, email }`, ou objeto `t1`/`t2`).
- Substituir o uso de `TEST1`/`TEST2` (linhas ~335-337) pelos valores recebidos no payload. Manter `TEST2` (Carolina) apenas como fallback caso venha vazio.

---

## 3. Conferência de bugs (todos os campos)

Revisão campo a campo; correções previstas:

- **Soma de percentuais > 100%:** hoje `pctUhome` é silenciosamente zerado (`Math.max(0, ...)`). Adicionar aviso visual/validação quando corretores + Gabrielle + Diretoria ultrapassarem 100%.
- **Soma das parcelas ≠ valor total da corretagem:** adicionar aviso (não bloqueante) quando o somatório das parcelas divergir do valor total informado, evitando documento com valores inconsistentes.
- **Regime de bens (PF casado):** confirmar que o campo só é enviado quando `estadoCivil === "casado(a)"` (já condicionado na UI) e que não vaza valor antigo ao trocar o estado civil.
- **Campos PJ x PF:** garantir que ao alternar tipo de pessoa os campos do outro tipo não sejam enviados indevidamente no texto de qualificação.
- **Parcelas:** validação de vencimento e valor já existe; confirmar formatação de moeda/`num()` em valores com separador de milhar.
- **Testemunhas:** validar preenchimento conforme item 2.

Cada ajuste será testado gerando uma intermediação de teste e conferindo o `.docx` (linha ZemoBank somando tudo + bloco de testemunhas correto) e o preview na tela.

---

## Arquivos alterados

- `src/pages/IntermediacaoPage.tsx` — correção do Zemo no preview, novo card de testemunhas, validações.
- `supabase/functions/gerar-intermediacao/index.ts` — correção do Zemo no cálculo, schema + render das testemunhas.

Sem migrations, sem mudança em tabela/Storage/RLS.