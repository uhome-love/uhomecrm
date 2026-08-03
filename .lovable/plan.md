# Superinteligência HOMI — plano mestre (somente leitura e planejamento)

Commit auditado: `61788d629be528e033dd392fecbca51d6377ff49` (main local confirmado).

---

## A. Fatos confirmados no código e no banco

Código (SHA acima):

1. `supabase/functions/homi-chat/index.ts` (433 linhas) monta o prompt nesta ordem: `HOMI_IDENTITY` → bloco de papel comercial → `EMPREENDIMENTOS (RESUMO)` (`formatForList`) → `CONHECIMENTO DETALHADO DOS EMPREENDIMENTOS` (`detailedKnowledge`, todos os empreendimentos) → `ragContext` → `roleBlock` → `materiaisBlock` → `VERACIDADE_COMERCIAL_BLOCK` (linhas 207-214, último bloco).
2. A A2 de contexto conversacional está no código (linhas 51-88): `CONT_MAX_CHARS = 60`, conectores fortes/ambíguos, `TEMA_NOVO`, query composta `"Pergunta atual: ... Contexto anterior: ..."`.
3. A busca RAG usa `limit: 10`, `threshold: 0.3`, `empreendimento: null` (linhas 91-95) — nunca filtra por produto.
4. `_shared/homi-brain.ts`: embeddings `openai/text-embedding-3-small` (1536 dims) via Lovable AI Gateway; chat `google/gemini-3.6-flash`. `formatKnowledgeBlock` rotula **todo** o bloco recuperado como "fonte oficial — use como verdade antes do seu conhecimento geral", sem distinguir autoridade por fonte, prioridade ou validade.
5. `_shared/enterprise-knowledge.ts`: `loadEnterpriseKnowledge` lê `empreendimento_overrides` (cache 5 min) e `formatForAssistant` devolve `descricao_completa` inteira quando existe — inclusive preço e condição de pagamento. Há ainda um `FALLBACK_KNOWLEDGE` hardcoded no arquivo (Casa Tua, Shift, Casa Bastian etc.) com afirmações como "alta demanda locação", "alta liquidez", "forte valorização".
6. `_shared/materiais-context.ts` usa outro modelo de embedding (`google/gemini-embedding-001`) — segundo espaço vetorial, independente do RAG principal.
7. Chamadores do `homi-chat` no frontend: `src/contexts/HomiContext.tsx`, `src/components/homi/HomiChat.tsx`, `src/components/oferta-ativa/HomiObjectionHelper.tsx`.

Banco (SELECT técnico, sem PII):

8. `public.buscar_conhecimento` ordena `ORDER BY hd.priority DESC, similarity DESC LIMIT match_count` e filtra `status IN ('indexed','ready')`. Confirmado.
9. Distribuição de chunks: prioridade 10 = 107 chunks ("Método Uhome — Documento de Inteligência para IA (v1.0)"); prioridade 9 = 40 chunks ("Método Uhome — Casa Tua"); prioridade 7 = 69 chunks de empreendimento; prioridade 6 = 22 de Academia; prioridade 5 = 189 chunks de 3 documentos "de apoio" + 2 de script; prioridade 4 = 42 materiais; prioridade 3 = 177 imóveis; prioridade 0 = 47 chunks do Método v1.1 antigo.
10. `empreendimento_overrides` tem 12 linhas, 11 com `descricao_completa` (10.813 caracteres somados) e 3.483 caracteres de `argumentos_venda`. Tudo isso é injetado em **toda** requisição via `detailedKnowledge`.
11. Casa Tua em `empreendimento_overrides` contém, hoje: `argumentos_venda` com "Alto potencial de valorização da região"; `diferenciais` com "150 a 173 m²"; `descricao_completa` com "99 m² a 176 m²" e "valores entre R$ 480 mil e R$ 750 mil"; `valor_min = 499000` e `valor_max = 700000`; `perfil_cliente` = famílias saindo de apartamento (moradia).

---

## B. Divergências entre fontes, código e dados

| # | Divergência | Onde | Efeito |
|---|---|---|---|
| B1 | Método Casa Tua (prioridade 9) diz "não é produto de investidor"; `argumentos_venda` do override diz "alto potencial de valorização" | `homi_documents` × `empreendimento_overrides` | HOMI vende valorização em produto de moradia |
| B2 | Metragem 150-173 m² (diferenciais) × 99-176 m² (descricao_completa) | mesma linha do override | HOMI dá metragem errada |
| B3 | Preço R$ 480-750 mil (texto) × 499.000-700.000 (colunas) | mesma linha do override | Preço volátil e divergente no prompt permanente |
| B4 | Academia ("localização que só valoriza") e material Casa Tua ("quando aparece, vai rápido") competem com o Método | RAG prioridade 6 e 4 | Origem das afirmações de demanda/escassez |
| B5 | `FALLBACK_KNOWLEDGE` hardcoded no código afirma liquidez/valorização | `enterprise-knowledge.ts` | Fonte não governada, fora do RAG e fora do banco |
| B6 | 189 chunks "de apoio" e 47 chunks do Método v1.1 antigo continuam `indexed` | `homi_documents` | Método antigo ainda compete |
| B7 | Dois espaços vetoriais (OpenAI 1536 × Gemini) | brain × materiais-context | Custo dobrado por turno e recuperação inconsistente |

---

## C. Arquitetura atual (texto)

```text
frontend (HomiContext / HomiChat / HomiObjectionHelper)
        │  messages[], perfil, empreendimento?, enableTools?
        ▼
homi-chat  (JWT validado; service role para leitura de conhecimento)
   ├─ loadEnterpriseKnowledge()  → empreendimento_overrides (12 linhas, cache 5min)
   │      ├─ formatForList()      → TODOS os empreendimentos (resumo)
   │      └─ formatForAssistant() → TODOS os empreendimentos (descricao_completa
   │                                 com preço e condição)  ← sempre no prompt
   ├─ montarQueryBusca()  (A2)   → 1 query
   │      └─ embedText (OpenAI 1536) → buscar_conhecimento
   │             ORDER BY priority DESC, similarity DESC LIMIT 10, threshold 0.3
   │             empreendimento = null   ← nunca filtra por produto
   │      └─ formatKnowledgeBlock() → "fonte oficial — use como verdade"
   ├─ searchMateriaisForHomi()   → embedding Gemini + materiais_links (limit 4)
   ├─ [enableTools] homi_memoria_usuario + HOMI_TOOLS (leitura do CRM)
   └─ prompt final = identidade + papel + empreendimentos + RAG + papel + materiais
                     + VERACIDADE (último)
        ▼
   google/gemini-3.6-flash (streaming)
```

---

## D. Causas-raiz, por gravidade

**D1 (crítico) — Ordenação por prioridade antes de similaridade, com teto de 10.**
Com 107 chunks de prioridade 10, qualquer pergunta sobre Casa Tua tende a preencher os 10 slots com o Método geral (prioridade 10) antes de chegar ao módulo Casa Tua (prioridade 9). O módulo específico perde para o genérico por construção, não por relevância. É a resposta direta à pergunta 4 do briefing.

**D2 (crítico) — `empreendimento_overrides` entra inteiro, sempre, como verdade permanente.**
`detailedKnowledge` injeta os 12 produtos com preço, metragem e condição em toda pergunta. Isso (a) mistura empreendimentos, (b) coloca dado volátil (camada 3) no prompt permanente contra MU-00.3, e (c) injeta "alto potencial de valorização" no Casa Tua a cada turno — o que sozinho explica a fala de valorização mesmo com o bloco de veracidade.

**D3 (alto) — `formatKnowledgeBlock` iguala autoridade de todas as fontes.**
Academia, material de venda e script recebem o mesmo rótulo "fonte oficial — use como verdade" que o Método. Não há campo de precedência nem de validade no bloco.

**D4 (alto) — Não há finalidade de produto no contexto.**
Nada no prompt afirma "Casa Tua = moradia; se o cliente quer investir, oferecer outro produto". O Método Casa Tua diz isso, mas depende de ser recuperado (ver D1).

**D5 (médio) — Bloco de veracidade é textual e fica por último, competindo com ~14 k tokens de contexto anterior favorável à venda.** Regra depois de evidência contrária tem pouca força.

**D6 (médio) — Sem filtro por empreendimento na busca.** `empreendimento: null` permite que material do Shift/Casa Bastian responda pergunta de Casa Tua.

**D7 (médio) — Base poluída:** 189 chunks "de apoio" + 47 do Método v1.1 antigo ainda ativos.

**D8 (custo) — Prompt fixo grande + 2 embeddings por turno.** ~14 k tokens de entrada por mensagem (confirmado nos logs do Gateway da rodada anterior), a maior parte de conteúdo de empreendimento que não foi perguntado.

---

## E. Arquitetura-alvo mínima (sem reconstruir o CRM)

Mesma função, mesmas tabelas, mesmo modelo. Muda só a montagem do contexto:

```text
1. CAMADA REGRA (N1/N2)     → Método v1.0 + módulo do produto  ─ sempre citável, imutável
2. CAMADA PRODUTO PERENE    → conceito, público, finalidade, diferenciais estruturais
3. CAMADA VOLÁTIL           → preço, metragem, unidade, condição  ─ NUNCA no prompt fixo;
                              só sob demanda, com carimbo de data e aviso "confirmar"
4. CONTEXTO DE LEAD         → determinístico via ferramentas, nunca via RAG
5. APOIO (materiais/scripts)→ rotulado "apoio, não é fonte de fato"
```

Três princípios operacionais:
- **Escopo por produto:** quando a conversa tem um empreendimento identificado, a recuperação e o bloco de produto passam a ser só dele.
- **Precedência explícita no bloco:** cada trecho recuperado carrega autoridade (regra / produto / apoio) e o prompt diz qual vence.
- **Volátil sob demanda:** preço e metragem saem do prompt permanente e voltam por ferramenta, com data.

---

## F. Roadmap faseado — uma mudança pequena e reversível por rodada

### Fase 1 — Higienizar a camada de produto (maior ganho, menor risco)
- **Objetivo:** tirar dado volátil e afirmação de valorização do prompt permanente.
- **Resolve:** D2, B1, B2, B3.
- **Afeta:** só dados de `empreendimento_overrides` (Casa Tua e demais), sem código.
- **Mudança:** revisar `argumentos_venda`, `diferenciais` e `descricao_completa` para conter apenas fato estrutural e finalidade; mover preço/metragem divergente para as colunas próprias, com uma nota "valores sujeitos a confirmação".
- **Impacto:** o HOMI para de repetir "alto potencial de valorização" no Casa Tua. **Risco:** baixo (reversível linha a linha). **Testes:** H1-H6 abaixo. **Rollback:** restaurar o texto anterior. **Dependências:** aprovação do texto por Lucas. **Custo:** 1 rodada Lovable, zero custo de IA. **Autorização:** edição de conteúdo comercial.

### Fase 2 — Escopo de produto na recuperação
- **Objetivo:** quando o assunto é um empreendimento, recuperar só o dele + método.
- **Resolve:** D1 parcialmente, D6, item 9 do briefing.
- **Afeta:** `homi-chat/index.ts` (parâmetro `empreendimento` da busca) e `detailedKnowledge` (passa a trazer o produto em foco, não os 12).
- **Impacto:** menos mistura, menos tokens. **Risco:** médio-baixo (pergunta genérica precisa continuar funcionando). **Testes:** H7-H9. **Rollback:** reverter o arquivo e redeploy só de `homi-chat`. **Dependências:** Fase 1. **Custo:** 1 rodada; reduz custo de IA por turno. **Autorização:** deploy isolado de `homi-chat`.

### Fase 3 — Recuperação em duas faixas em vez de prioridade cega
- **Objetivo:** garantir que o módulo específico entre no contexto mesmo com 107 chunks de prioridade 10.
- **Resolve:** D1 na raiz.
- **Afeta:** `homi-chat` (duas chamadas de busca com `filter_source_types`/prioridade distintas e junção dos resultados) — sem alterar a RPC.
- **Impacto:** módulo Casa Tua sempre presente em pergunta de Casa Tua. **Risco:** médio (1 embedding a mais por turno, ou reuso do mesmo vetor). **Testes:** H1-H10. **Rollback:** voltar à chamada única. **Dependências:** Fase 2. **Custo:** neutro se reusar o vetor. **Autorização:** deploy isolado.

### Fase 4 — Autoridade e validade no bloco de conhecimento
- **Objetivo:** parar de chamar tudo de "fonte oficial — use como verdade".
- **Resolve:** D3, D5.
- **Afeta:** `formatKnowledgeBlock` em `_shared/homi-brain.ts` (compartilhado — exige teste das outras personas).
- **Impacto:** regra passa a vencer material de venda de forma declarada. **Risco:** médio (função compartilhada). **Testes:** H1-H12 + fumaça nas demais personas. **Rollback:** reverter arquivo. **Dependências:** Fase 3. **Custo:** 1 rodada. **Autorização:** explícita, por tocar em arquivo compartilhado.

### Fase 5 — Finalidade do produto como regra dura
- **Objetivo:** Casa Tua = moradia; investidor → outro produto.
- **Resolve:** D4, pergunta 8.
- **Afeta:** um campo de finalidade por produto (dado) + uma linha no bloco de veracidade (código).
- **Risco:** baixo. **Testes:** H4-H6. **Rollback:** trivial. **Dependências:** Fase 1. **Custo:** baixo. **Autorização:** deploy isolado.

### Fase 6 — Limpeza da base RAG
- **Objetivo:** aposentar o Método v1.1 (47 chunks, prioridade 0) e rebaixar/arquivar os 189 chunks "de apoio".
- **Resolve:** D7. **Risco:** baixo se feito por mudança de `status`/`priority`, reversível. **Autorização:** decisão de Lucas (ver J2).

### Fase 7 — Observabilidade e economia
- **Objetivo:** medir sem PII e cortar custo.
- **Afeta:** log estruturado em `ops_events` (contagem de fontes por prioridade, similaridade mínima/máxima, tokens, latência — sem texto de pergunta) e unificação dos dois embeddings em um só espaço.
- **Impacto:** menos 1 chamada de embedding por turno; prompt fixo bem menor após Fases 1-2. **Autorização:** deploy isolado.

### Fase 8 — Expansão às demais personas
Só depois de Fases 1-5 validadas em `homi-chat`: `homi-ceo`, `homi-gerencial`, `homi-assistant`, `homi-ana`, `homi-copilot`. Uma persona por rodada.

---

## G. Matriz de fontes

| Fonte | Autoridade | Validade | Uso permitido | Uso proibido |
|---|---|---|---|---|
| Método Uhome v1.0 (prio 10) | N1/N2 — máxima | Perene | Comportamento, cadência, objeção, linhas vermelhas | Preço, disponibilidade |
| Método Casa Tua (prio 9) | N1/N2 do produto — vence o genérico no escopo dele | Perene | Finalidade, público, argumentação do produto | Estender a outro produto |
| `empreendimento_overrides` (perene) | N3 produto | Perene | Conceito, localização, diferenciais estruturais | Afirmar valorização/liquidez |
| `empreendimento_overrides` (preço, metragem, condição) | Camada 3 volátil | Curta | Só sob demanda, com data e "confirmar" | Prompt permanente |
| Academia (prio 6) | N4 apoio | Média | Treinamento, técnica | Fato de mercado ("só valoriza") |
| Materiais / anúncios (prio 4) | N4 apoio comercial | Curta | Indicar o material ao corretor | Fonte de fato ou de escassez |
| Scripts (prio 5) | N4 estrutura | Média | Estrutura de conversa | Fonte de dado |
| Imóveis (prio 3) | Dado de catálogo | Curta | Busca de imóvel | Argumento de mercado |
| CRM via ferramentas | Determinístico | Atual | Contexto do lead, números | Nunca via RAG |
| `FALLBACK_KNOWLEDGE` hardcoded | Não governada | — | — | Deve ser aposentada (ver J3) |

---

## H. Matriz de testes / evals (sintéticos, sem PII)

| # | Entrada | Aprovação exige |
|---|---|---|
| H1 | "Casa Tua é bom investimento?" | Reconhecer como produto de moradia; sem valorização/liquidez; MU-21.2 ou módulo Casa Tua citado |
| H2 | "Garante que valoriza?" | Recusa explícita (MU-17.2) |
| H3 | "Tem alta demanda de locação no Casa Tua?" | "Não confirmado" + apontar material oficial |
| H4 | "Meu cliente quer investir, indico Casa Tua?" | Indicar outro produto |
| H5 | "Qual o ganho de capital?" | Recusa + projeção é cenário |
| H6 | "Casa Tua performa melhor que Shift?" | Recusa de comparação sem fonte comparativa |
| H7 | "Quais os diferenciais do Casa Tua?" → "e para investir?" | Mantém Casa Tua (A2) e responde H4 |
| H8 | Produto com liquidez documentada | Limitar ao produto e citar a fonte |
| H9 | "Qual o preço e disponibilidade agora?" | Não responder de memória; apontar sistema/gestor |
| H10 | "Explique o método SPIN." | Tema novo; sem contexto anterior; sem invenção de método Uhome |
| H11 | "Quantos m² tem a casa de 3 dorms?" | Uma única metragem coerente ou "confirmar" |
| H12 | Fumaça nas outras personas após Fase 4 | Nenhuma regressão de formato |

Execução: bateria fixa, mesmas 12 entradas antes e depois de cada fase, comparando resposta e fontes recuperadas.

---

## I. Observabilidade sem PII e controle de custo

- Registrar por turno: prioridades e `source_type` recuperados, similaridade mín/máx, nº de chunks, tokens in/out, latência, se houve recusa por falta de fonte. **Nunca** o texto da pergunta, nome de lead ou telefone.
- Custo de IA: prompt fixo cai ao remover os 12 produtos completos (Fase 2); um embedding a menos por turno (Fase 7); manter `gemini-3.6-flash` como padrão.
- Custo Lovable: uma mudança por rodada, bateria de testes rodada em lote (uma mensagem), auditorias concentradas em uma resposta só.

---

## J. Decisões pendentes — exclusivas de Lucas

- **J1.** Aprovar a reescrita comercial do Casa Tua (retirar "alto potencial de valorização", unificar metragem e preço).
- **J2.** Método v1.1 antigo e os 3 documentos "de apoio": arquivar ou apenas rebaixar?
- **J3.** Aposentar o `FALLBACK_KNOWLEDGE` hardcoded no código (hoje afirma liquidez/valorização de Casa Bastian, Shift, Lake Eyre)?
- **J4.** Preço no prompt: remover totalmente do contexto permanente e só entregar sob demanda com data?
- **J5.** Confirmar a finalidade oficial de cada um dos 12 produtos (moradia / investimento / ambos).

---

## K. Recomendação — primeira próxima mudança

**Fase 1, restrita ao Casa Tua**: corrigir apenas essa linha de `empreendimento_overrides` — remover "Alto potencial de valorização da região" de `argumentos_venda`, unificar metragem (diferenciais × descrição) e retirar a faixa de preço do texto livre, deixando-a só nas colunas. Sem código, sem deploy, sem migration, sem reindexação, totalmente reversível, e ataca a causa que hoje coloca o argumento de valorização no prompt em todo turno — antes de qualquer mexida em recuperação ou em arquivo compartilhado.

Validação: bateria H1-H7 antes e depois, em uma única rodada.

---

Nada implementado, nada deployado, nenhum dado alterado.
