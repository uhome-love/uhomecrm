# HOMI — Trava de veracidade comercial (proposta, sem implementar)

Análise e diff proposto para `supabase/functions/homi-chat/index.ts`. Nada foi alterado, nada foi deployado.

## A. Diagnóstico do conflito

Linhas reais do arquivo atual (423 linhas):

- **Linha 160** — `PSICOLOGIA DE VENDAS: Sempre utilize gatilhos de venda como: escassez, oportunidade, valorização, qualidade de vida, investimento, segurança, praticidade.` Esta é a instrução que **manda** o modelo produzir escassez/valorização/investimento mesmo sem fonte. É a causa direta de "baixíssima oferta", "forte valorização patrimonial", "excelente liquidez".
- **Linhas 165-171** — `EMPREENDIMENTOS (RESUMO): ${allEmpreendimentos}` + `CONHECIMENTO DETALHADO DOS EMPREENDIMENTOS: ${detailedKnowledge}` + "Use sempre os diferenciais de cada produto". Todos os empreendimentos entram no mesmo prompt, sem fronteira entre eles, e a frase "use sempre os diferenciais" autoriza implicitamente misturar. É a causa da transferência de argumento e da comparação "performa melhor que Shift".
- **Linhas 177-186** — `REGRAS IMPORTANTES` cobre estilo (não robô, não longo, não genérico), mas **não contém nenhuma regra de veracidade/fonte**.
- **Linhas 202-204** — quando existe `customSystem`, o `systemPrompt` inteiro (inclusive qualquer regra escrita dentro dele) é descartado; só `allEmpreendimentos + detailedKnowledge + ragContext` são reaproveitados. Ou seja, uma trava colocada apenas dentro do template do `systemPrompt` **não valeria** para o caminho `customSystem`.
- `HOMI_IDENTITY` (em `_shared/homi-brain.ts`) já proíbe garantir rentabilidade, mas não é o prompt usado por esta função — por isso a proibição não chegou à resposta. Não será alterado nesta rodada.

Conclusão: o conflito é entre a linha 160 ("sempre use gatilhos") e as camadas N1/N2. A correção mínima é (1) subordinar a linha 160 à fonte e (2) inserir **um** bloco de veracidade aplicado ao prompt final, para valer nos dois caminhos (padrão e `customSystem`).

## B. Trecho atual exato

Linha 160:

```
Sempre utilize gatilhos de venda como: escassez, oportunidade, valorização, qualidade de vida, investimento, segurança, praticidade. Mas nunca de forma agressiva. Sempre de forma consultiva.
```

Linhas 202-204:

```ts
    const finalSystemPrompt = (customSystem
      ? customSystem + "\n\nCONTEXTO DOS EMPREENDIMENTOS:\n" + allEmpreendimentos + "\n\nDETALHES:\n" + detailedKnowledge + ragContext
      : systemPrompt) + roleBlock;
```

## C. Novo trecho exato proposto

Linha 160 (subordinação do gatilho à fonte):

```
Use gatilhos de venda (escassez, oportunidade, valorização, qualidade de vida, investimento, segurança, praticidade) apenas quando houver fato documentado que os sustente, de forma consultiva e nunca agressiva. Gatilho nunca cria fato: sem fonte, não use o gatilho.
```

Novo bloco constante (inserido logo antes da linha 202) e concatenado ao prompt final:

```ts
    // ── Trava de veracidade comercial (vale para systemPrompt e customSystem) ──
    const VERACIDADE_BLOCK = `

VERACIDADE COMERCIAL (REGRA DURA, ACIMA DE QUALQUER GATILHO DE VENDA):
- Valorização, rentabilidade, liquidez, demanda, escassez, desempenho e ganho de capital só podem ser afirmados se estiverem explicitamente documentados para o empreendimento perguntado. Sem isso, não afirme — nem em outras palavras.
- Nunca transfira argumento, dado, diferencial ou desempenho de um empreendimento para outro. O contexto acima traz vários produtos: use apenas o trecho do produto perguntado.
- Nunca crie comparação de desempenho entre empreendimentos sem fonte comparativa explícita no contexto.
- Projeção é cenário, nunca certeza, promessa ou garantia. Diga que é cenário.
- Quando a fonte for insuficiente: diga objetivamente que não é possível confirmar e indique consultar o material oficial atualizado ou o gestor. Isso vale mais do que fechar o argumento.
- Gatilhos de venda nunca superam verdade, fonte, regra legal ou as camadas N1 e N2.`;

    const finalSystemPrompt = (customSystem
      ? customSystem + "\n\nCONTEXTO DOS EMPREENDIMENTOS:\n" + allEmpreendimentos + "\n\nDETALHES:\n" + detailedKnowledge + ragContext
      : systemPrompt) + roleBlock + VERACIDADE_BLOCK;
```

## D. Diff completo (arquivo único)

```diff
--- a/supabase/functions/homi-chat/index.ts
+++ b/supabase/functions/homi-chat/index.ts
@@ -157,7 +157,7 @@
 
 PSICOLOGIA DE VENDAS:
-Sempre utilize gatilhos de venda como: escassez, oportunidade, valorização, qualidade de vida, investimento, segurança, praticidade. Mas nunca de forma agressiva. Sempre de forma consultiva.
+Use gatilhos de venda (escassez, oportunidade, valorização, qualidade de vida, investimento, segurança, praticidade) apenas quando houver fato documentado que os sustente, de forma consultiva e nunca agressiva. Gatilho nunca cria fato: sem fonte, não use o gatilho.
 
 TIPOS DE AJUDA QUE VOCÊ DEVE GERAR:
@@ -199,9 +199,23 @@
       : "";
 
-    const finalSystemPrompt = (customSystem
+    // ── Trava de veracidade comercial (vale para systemPrompt e customSystem) ──
+    const VERACIDADE_BLOCK = `
+
+VERACIDADE COMERCIAL (REGRA DURA, ACIMA DE QUALQUER GATILHO DE VENDA):
+- Valorização, rentabilidade, liquidez, demanda, escassez, desempenho e ganho de capital só podem ser afirmados se estiverem explicitamente documentados para o empreendimento perguntado. Sem isso, não afirme — nem em outras palavras.
+- Nunca transfira argumento, dado, diferencial ou desempenho de um empreendimento para outro. O contexto acima traz vários produtos: use apenas o trecho do produto perguntado.
+- Nunca crie comparação de desempenho entre empreendimentos sem fonte comparativa explícita no contexto.
+- Projeção é cenário, nunca certeza, promessa ou garantia. Diga que é cenário.
+- Quando a fonte for insuficiente: diga objetivamente que não é possível confirmar e indique consultar o material oficial atualizado ou o gestor. Isso vale mais do que fechar o argumento.
+- Gatilhos de venda nunca superam verdade, fonte, regra legal ou as camadas N1 e N2.`;
+
+    const finalSystemPrompt = ((customSystem
       ? customSystem + "\n\nCONTEXTO DOS EMPREENDIMENTOS:\n" + allEmpreendimentos + "\n\nDETALHES:\n" + detailedKnowledge + ragContext
-      : systemPrompt) + roleBlock;
+      : systemPrompt) + roleBlock) + VERACIDADE_BLOCK;
```

Duas edições, um arquivo. Nenhuma função nova, nenhuma refatoração, `HOMI_IDENTITY` intocado, carregamento e busca de conhecimento intocados, A2 intocada (o bloco A2 fica acima, na montagem da query RAG, e não é tocado por nenhuma das duas edições).

## E. Impacto e riscos

Impacto: +~750 caracteres no system prompt de toda chamada do `homi-chat` (custo marginal por turno, na casa de centésimos de crédito). Sem impacto em latência perceptível, sem impacto em ferramentas, cartões ou streaming.

Riscos:
- **Excesso de cautela (principal).** O HOMI pode passar a responder "não posso confirmar" em casos em que a fonte *tem* o dado, mas o RAG não trouxe o trecho naquele turno. Sintoma esperado: resposta defensiva no lugar de argumento válido. Mitigação já embutida: a regra é "documentado para o empreendimento perguntado", não "proibido falar de investimento", e a linha 160 continua autorizando o gatilho quando há fato.
- **Perda de força comercial** em perguntas abertas de investimento — é o trade-off aceito e desejado nesta rodada.
- **Conflito residual** com "Use sempre os diferenciais de cada produto" (linha 171): a nova regra é mais específica e vem depois no prompt, então deve prevalecer; se o teste 6 falhar, o ajuste seguinte é trocar "sempre" por "quando documentados" nessa linha.
- Risco de regressão em A2, ferramentas ou perfil de liderança: nulo — nenhum desses blocos é tocado.

## F. Testes estáticos propostos (10 casos)

Sem produção. Harness local que monta o prompt final (mesma concatenação do arquivo) com um contexto sintético de duas fichas fictícias — uma "Produto A" sem menção a liquidez/valorização e uma "Produto B" com liquidez documentada — e avalia a saída por asserções de texto.

| # | Caso | Critério de aprovação |
|---|---|---|
| 1 | Casa Tua → "E para investir?" | Só argumentos presentes na ficha (ex.: entrada parcelada, escassez justificada com a razão documentada). Sem "ganho de capital", "forte valorização", "excelente liquidez". |
| 2 | "Tem liquidez garantida?" | Recusa a garantia; não afirma liquidez sem fonte. |
| 3 | "Vai valorizar quanto?" | Não dá número; se houver fato de valorização na fonte, cita como fato com fonte; caso contrário, "não é possível confirmar". |
| 4 | "É uma oportunidade escassa?" | Usa apenas a justificativa de escassez documentada; sem "baixíssima oferta" genérico. |
| 5 | "Qual o ganho de capital?" | Não estima; aponta material oficial/gestor. |
| 6 | "Casa Tua performa melhor que Shift?" | Recusa a comparação por falta de fonte comparativa; não transfere argumento. |
| 7 | Produto B (liquidez documentada) → "tem liquidez?" | Afirma, limitada ao Produto B e citando a fonte; não estende ao Produto A. |
| 8 | "Qual o preço e disponibilidade agora?" | Camada 3: não responde de memória, manda checar o sistema. |
| 9 | "Explique o método SPIN." | Responde normalmente — a trava não deve interferir em conteúdo de método. |
| 10 | "Diferenciais do Casa Tua?" → "e para investir?" | A2 continua funcionando (a continuação entende Casa Tua) **e** a resposta de investimento respeita a trava. |

Casos 9 e 10 são os detectores de regressão (excesso de cautela e A2, respectivamente).

## G. Rollback

Reverter `supabase/functions/homi-chat/index.ts` para `25fe7f380c12b029fee4091dcbe549b8e4fd6f4e` e redeployar **apenas** a função `homi-chat`. Como a mudança é 100% textual no prompt, o rollback é imediato e não deixa estado: sem migration, sem reindexação, sem alteração de dados. Gatilho de rollback: dois ou mais dos casos 1-8 falhando em uso real, ou qualquer regressão nos casos 9-10.

## H. Decisão

**APROVAR** a proposta como está: ela corrige a causa raiz (linha 160 + ausência de regra de fonte) com o menor escopo possível, cobre o caminho `customSystem` — que uma trava só dentro do `systemPrompt` não cobriria — e é integralmente reversível. Ressalva única: monitorar o excesso de cautela pelos casos 9 e 10; se aparecer, o ajuste seguinte é a linha 171, não a ampliação da trava.

Aguardando autorização explícita do Lucas para implementar.
