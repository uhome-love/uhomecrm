# HOMI — Etapa 2: proposta exata da mudança #1 (query da busca)

Nada foi alterado, nada foi deployado. Abaixo está o diff exato para revisão.

## 1. Arquivo alterado

**Um único arquivo:** `supabase/functions/homi-chat/index.ts`

Nenhum outro arquivo é tocado. `homi-brain.ts`, `homi-tools.ts`, o prompt, `HOMI_IDENTITY`, o modelo, threshold, limit, a RPC, embeddings, banco, RLS, frontend e as demais Edge Functions ficam **idênticos**.

## 2. Trecho atual (linhas 48-58)

```ts
    // ── RAG unificado (método, materiais, academia, scripts, empreendimentos, imóveis) ──
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content;
    let ragContext = "";
    if (lastUserMsg) {
      const chunks = await searchKnowledge(supabase, lastUserMsg, {
        limit: 10,
        threshold: 0.3,
        empreendimento: null,
      });
      ragContext = formatKnowledgeBlock(chunks);
    }
```

`lastUserMsg` continua sendo usado mais abaixo (linhas 169-174, busca de materiais). **Não mexo nele** — só acrescento uma variável nova para a busca de conhecimento.

## 3. Trecho proposto

```ts
    // ── RAG unificado (método, materiais, academia, scripts, empreendimentos, imóveis) ──
    const userTurns = (messages as any[]).filter((m) => m.role === "user" && typeof m.content === "string");
    const lastUserMsg = userTurns[userTurns.length - 1]?.content;
    const prevUserMsg = userTurns[userTurns.length - 2]?.content;

    /**
     * A pergunta atual é sempre a fonte principal da busca.
     * A mensagem anterior só entra quando a atual é claramente uma continuação
     * (curta, ou aberta por conector de continuidade). Assunto novo = só a atual.
     */
    const CTX_MAX = 200;   // caracteres do contexto anterior
    const ASK_MAX = 400;   // caracteres da pergunta atual
    const CONT_INICIO = /^\s*(e\s|e$|ai\s|aí\s|no\s|na\s|pra\s|para\s|por\s|com\s|sem\s|tem\s|teria\s|e se\b|nesse\b|nessa\b|neste\b|nesta\b|isso\b|esse\b|essa\b|ele\b|ela\b|lá\b|ali\b|mesmo\b|tambem\b|também\b|outra\b|outro\b|qual deles\b|quanto\b)/i;
    const TEMA_NOVO = /^\s*(agora|muda|mudando|outro assunto|deixa|esquece|nova pergunta|preciso de|faça|faz|me faz|me da|me dá|quero)\b/i;

    function montarQueryBusca(atual?: string, anterior?: string): string {
      const ask = (atual ?? "").trim().slice(0, ASK_MAX);
      if (!ask) return "";
      const palavras = ask.split(/\s+/).length;
      const ehContinuacao =
        !!anterior &&
        ask.length <= 80 &&
        !TEMA_NOVO.test(ask) &&
        (CONT_INICIO.test(ask) || palavras <= 5);
      if (!ehContinuacao) return ask;
      const ctx = anterior!.trim().slice(0, CTX_MAX);
      return `Contexto anterior: ${ctx}\nPergunta atual: ${ask}`;
    }

    const ragQuery = montarQueryBusca(lastUserMsg, prevUserMsg);
    let ragContext = "";
    if (ragQuery) {
      const chunks = await searchKnowledge(supabase, ragQuery, {
        limit: 10,
        threshold: 0.3,
        empreendimento: null,
      });
      ragContext = formatKnowledgeBlock(chunks);
    }
```

Diferença efetiva: **muda apenas o texto passado como 1º argumento de `searchKnowledge`**. `limit`, `threshold` e `empreendimento` permanecem exatamente como estão.

## 4. Regra usada, em português

A mensagem anterior só é anexada quando **todas** estas condições valem:

1. existe uma mensagem anterior **do próprio usuário, no chat atual** (nunca histórico de outra thread, nunca mensagem do assistente, nunca dado de lead);
2. a pergunta atual tem **no máximo 80 caracteres**;
3. a pergunta atual **não** abre com marcador de troca de assunto ("agora", "quero", "faça", "preciso de", "outro assunto"…);
4. a pergunta atual **abre com conector de continuidade** ("e…", "por…", "nesse…", "tem outra…") **ou** tem **até 5 palavras**.

Fora disso, a busca usa **só a pergunta atual** — comportamento idêntico ao de hoje.

## 5. Limites de tamanho e segurança do contexto

| Item | Valor |
|---|---|
| Contexto anterior | 200 caracteres (truncado) |
| Pergunta atual | 400 caracteres (truncado) |
| Query máxima | ~640 caracteres |
| Mensagens consideradas | **2**, ambas do usuário, ambas do chat atual |
| Histórico completo | nunca concatenado |
| Dados de lead / PII | não entram — a função só lê o array `messages` que o próprio usuário digitou, exatamente como hoje |
| Separação | rótulos explícitos `Contexto anterior:` / `Pergunta atual:` |
| Tema antigo dominar pergunta nova | impedido pelo teto de 80 caracteres + regex de tema novo: pergunta completa nunca puxa contexto |

## 6. Casos de teste — resultado esperado

| # | Anterior | Atual | Continuação? | Query enviada ao `searchKnowledge` |
|---|---|---|---|---|
| 1 | "Como respondo quando o cliente acha caro?" | "E no Casa Tua?" | **Sim** (14 chars, abre com "E ") | `Contexto anterior: Como respondo quando o cliente acha caro?` + `Pergunta atual: E no Casa Tua?` → recupera objeção de preço **e** Casa Tua |
| 2 | "Qual argumento funciona melhor nesse empreendimento?" | "E para investir?" | **Sim** (16 chars, "E ") | mantém o empreendimento do turno anterior + finalidade investimento |
| 3 | "Como confirmar uma visita?" | "Faça uma análise do meu funil desta semana." | **Não** (43 chars, abre com "Faça" = tema novo, 8 palavras) | só `Faça uma análise do meu funil desta semana.` |
| 4 | — | "Como faço follow-up de um lead que não respondeu?" | **Não** (não há anterior) | só a mensagem atual — comportamento de hoje, intacto |
| 5 | "Me dê três mensagens para uma objeção de localização." | "Por áudio?" | **Sim** (10 chars, "Por ", 2 palavras) | objeção de localização + adaptação para áudio |
| 6 | "Fale sobre o Casa Tua." | "Agora quero analisar os contratos parados." | **Não** (abre com "Agora" = tema novo) | **Casa Tua não entra** na query |

Os 6 casos passam pela regra proposta sem exceção manual.

### Antes x depois, na prática

- **Caso 1 hoje:** a query é literalmente `E no Casa Tua?` — o embedding disso é quase só o nome do empreendimento; volta ficha do Casa Tua e nada sobre objeção de preço. **Depois:** volta bloco do Método sobre ancoragem/objeção de preço + ficha do Casa Tua.
- **Caso 3 hoje e depois:** idêntico. Nenhuma regressão possível em pergunta completa.

## 7. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Falso positivo: pergunta nova, curta e começando com conector puxa contexto velho | Baixa | contexto entra rotulado e truncado em 200 chars; a pergunta atual continua dominando o embedding |
| Falso negativo: continuação longa (>80 chars) não puxa contexto | Baixa | comportamento **igual ao de hoje** — não é regressão |
| Query maior encarece embedding | Desprezível | +200 chars em uma fração das perguntas; mesmo modelo, mesma chamada |
| Afetar a busca de materiais do Hub | Nenhum | `lastUserMsg` segue existindo com o mesmo valor; o bloco de materiais (l. 169-174) não é tocado |

Não há risco de escrita: a mudança está em cima de uma leitura (`searchKnowledge` → RPC `STABLE`).

## 8. Rollback exato

Reverter `supabase/functions/homi-chat/index.ts` para o commit anterior — ou, manualmente, trocar o bloco novo de volta pelas 11 linhas do item 2. Sem banco, sem migration, sem reindexação, sem estado a desfazer. Rollback instantâneo.

## 9. Confirmação de escopo

- 1 arquivo, 1 bloco, ~25 linhas, aditivas.
- Prompt, `HOMI_IDENTITY`, modelo, threshold, limit, RPC, embeddings, ferramentas, banco, documentos, chunks, RLS, CRM, frontend, ações e outras Edge Functions: **inalterados**.
- Nenhum deploy, nenhuma publicação. Aguardando sua aprovação para implementar.

## 10. Pergunta antes de implementar

O teto de **80 caracteres** é o único parâmetro discutível. Se quiser um gatilho mais conservador, baixo para 60 (aí "E para investir?" e "Por áudio?" continuam passando, mas frases médias nunca puxam contexto). Confirma 80 ou prefere 60?
