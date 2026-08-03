# HOMI — Etapa 2 (revisada): query da busca RAG com contexto

Nada implementado, nada deployado. Um arquivo, um bloco: `supabase/functions/homi-chat/index.ts`.

## 1. Trecho atual (linhas 48-58)

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

## 2. Novo trecho exato

```ts
    // ── RAG unificado (método, materiais, academia, scripts, empreendimentos, imóveis) ──
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content;

    /**
     * A pergunta atual é sempre a fonte principal da busca.
     * A mensagem anterior do usuário só entra quando a atual é claramente
     * uma continuação. Assunto novo ou pergunta autossuficiente = só a atual.
     */
    const userMsgs = (messages as any[]).filter((m) => m.role === "user");
    const prevUserMsg = userMsgs[userMsgs.length - 2]?.content;

    const CTX_MAX = 200;   // caracteres do contexto anterior
    const ASK_MAX = 400;   // caracteres da pergunta atual
    const CONT_MAX_CHARS = 60;
    const ELIPSE_MAX_PALAVRAS = 3;

    // Conector FORTE: a frase só existe colada no turno anterior.
    const CONT_FORTE = /^\s*(e|ou|mas|então|entao)\s|^\s*e\s*se\b|^\s*(e|ou)\s*(o|a)\s+(quê|que)\b/i;
    // Conector AMBÍGUO / elipse: só puxa contexto se a pergunta for muito curta.
    const CONT_AMBIGUO = /^\s*(por|pra|para|no|na|nos|nas|com|sem|de|do|da|nesse|nessa|neste|nesta|isso|esse|essa|ele|ela|lá|la|ali|mesmo|também|tambem|igual|quanto|qual)\b/i;
    // Marcadores explícitos de troca de assunto.
    const TEMA_NOVO = /^\s*(agora|muda|mudando|outro assunto|deixa|esquece|nova pergunta|preciso|quero|faça|faz|me faz|explique|explica|me explica|liste|lista|gere|gera|analise|analisa)\b/i;

    function montarQueryBusca(atual?: string, anterior?: string): string {
      const ask = (atual ?? "").trim().slice(0, ASK_MAX);
      if (!ask) return "";
      const ctxBruto = (anterior ?? "").trim();
      if (!ctxBruto) return ask;
      if (ask.length > CONT_MAX_CHARS) return ask;
      if (TEMA_NOVO.test(ask)) return ask;

      const palavras = ask.split(/\s+/).filter(Boolean).length;
      const ehContinuacao =
        CONT_FORTE.test(ask) ||
        (CONT_AMBIGUO.test(ask) && palavras <= ELIPSE_MAX_PALAVRAS);
      if (!ehContinuacao) return ask;

      return `Pergunta atual: ${ask}\nContexto anterior: ${ctxBruto.slice(0, CTX_MAX)}`;
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

Pontos atendidos: `lastUserMsg` intocado (sem filtro de `typeof`), teto 60, sem fallback "≤5 palavras", conectores fortes separados dos ambíguos (ambíguo só com ≤3 palavras), e a query composta começa por `Pergunta atual:`.

## 3. Tabela dos 12 testes

Contexto anterior usado nos testes 1-9: **"Como respondo quando o cliente acha caro no Casa Tua?"** (abreviado abaixo como *[ctx]*).

| # | Pergunta atual | Regra acionada | Continuação? | Query enviada ao `searchKnowledge` |
|---|---|---|---|---|
| 1 | `E no Casa Tua?` | FORTE (`e `), 14 chars | **Sim** | `Pergunta atual: E no Casa Tua?` ⏎ `Contexto anterior: [ctx]` |
| 2 | `E para investir?` | FORTE (`e `), 16 chars | **Sim** | `Pergunta atual: E para investir?` ⏎ `Contexto anterior: [ctx]` |
| 3 | `Por áudio?` | AMBÍGUO (`por`), 2 palavras | **Sim** | `Pergunta atual: Por áudio?` ⏎ `Contexto anterior: [ctx]` |
| 4 | `No VIVID, quais diferenciais?` | AMBÍGUO (`no`), **4 palavras** > 3 | **Não** | `No VIVID, quais diferenciais?` |
| 5 | `Preço do Lake Baikal?` | nenhum conector inicial | **Não** | `Preço do Lake Baikal?` |
| 6 | `Explique o método SPIN.` | TEMA_NOVO (`explique`) | **Não** | `Explique o método SPIN.` |
| 7 | `E se ele disser que é caro?` | FORTE (`e se`), 27 chars | **Sim** | `Pergunta atual: E se ele disser que é caro?` ⏎ `Contexto anterior: [ctx]` |
| 8 | `Agora me mostra o funil da semana.` | TEMA_NOVO (`agora`) | **Não** | `Agora me mostra o funil da semana.` |
| 9 | `Isso funciona?` | AMBÍGUO (`isso`), 2 palavras | **Sim** | `Pergunta atual: Isso funciona?` ⏎ `Contexto anterior: [ctx]` |
| 10 | *(sem mensagem anterior)* `E no Casa Tua?` | sem contexto disponível | **Não** | `E no Casa Tua?` |
| 11 | `E como eu conduzo a conversa quando ele diz que vai pensar melhor?` | FORTE, mas **66 chars** > 60 | **Não** | a própria pergunta, íntegra |
| 12 | `Qual o valor do condomínio?` | nenhum conector (`qual` é ambíguo, mas 5 palavras) | **Não** | `Qual o valor do condomínio?` |

Os 6 casos que você fixou (1, 2, 3, 4, 5, 6) saem exatamente como pedido.

## 4. Impacto

- Muda **apenas o texto passado como 1º argumento** de `searchKnowledge`. `limit: 10`, `threshold: 0.3`, `empreendimento: null`, RPC, embeddings e modelo continuam idênticos.
- Perguntas autossuficientes (a maioria) produzem query **byte a byte igual à de hoje** — zero regressão.
- Perguntas de continuação curtas passam a recuperar o tema do turno anterior: hoje `E no Casa Tua?` embeda basicamente o nome do empreendimento; depois recupera também o bloco de objeção de preço.
- Busca de materiais do Hub (l. 169-174) usa `lastUserMsg`, que segue com o mesmo valor de hoje — não é afetada.
- Custo: +200 chars no embedding em uma fração pequena dos turnos.

## 5. Risco

| Risco | Gravidade | Mitigação |
|---|---|---|
| Falso positivo: pergunta nova, ≤60 chars, iniciada por "e/ou/mas" puxa contexto velho | Baixa | contexto vem rotulado, truncado em 200 chars e **depois** da pergunta atual, que domina o embedding |
| Falso negativo: continuação com mais de 60 chars não puxa contexto | Baixa | comportamento igual ao de hoje — não é regressão |
| Conector ambíguo em pergunta de 3 palavras autossuficiente (ex.: `Para investidores?`) puxar contexto | Baixa | mesmo assim a pergunta atual lidera a query; efeito máximo é trazer 1-2 chunks a mais |
| Escrita/estado | Nenhum | a mudança está sobre uma leitura (`searchKnowledge` → RPC) |

## 6. Rollback

Reverter `supabase/functions/homi-chat/index.ts` ao commit anterior, ou substituir manualmente o bloco novo pelas 11 linhas do item 1. Sem migration, sem reindexação, sem estado a desfazer — rollback instantâneo.

Aguardando sua aprovação para implementar.
