# HOMI — MAPA DE EVOLUÇÃO SEGURA

Levantamento read-only. Nenhum arquivo alterado, nenhuma migration, nenhum código criado. Tudo abaixo veio de leitura do código e de consultas de leitura ao banco de produção agora.

Escopo respeitado: nada de pipeline, etapas, substatus, roleta, distribuição, WhatsApp, tarefas, visitas, negócios, contratos, automações, RLS ou tabelas existentes. Só inteligência do HOMI.

---

## 1. Arquitetura atual

### Frontend

| Peça | Arquivo | Papel |
|---|---|---|
| Roteamento de papel → função | `src/contexts/HomiContext.tsx` (l. 83-88) | Cérebro único: `corretor`, `gestor` e `ceo` **todos** apontam para `homi-chat` |
| Chat do pop-up / workspace | `src/components/homi/HomiChat.tsx` (l. 16) | `POST {EDGE_BASE_URL}/functions/v1/homi-chat` |
| Chat CEO (legado, ainda vivo) | `src/components/homi/HomiCeoChat.tsx` (l. 15) | aponta para `homi-ceo`, **fora** do cérebro único — divergência |
| Tela cheia | `src/pages/HomiWorkspace.tsx` (235 l.) + `workspace/{MessageList,Composer,ThreadSidebar,ThinkingIndicator,BriefingCard,PainelVivo}.tsx` | UI de threads |
| Ações confirmáveis (undo) | `src/hooks/useHomiActions.ts` | executa no front o que a função só *prepara* |
| Threads / memória / briefing / alertas | `src/hooks/useHomiThreads.ts`, `useHomiMemoria.ts`, `useHomiBriefing.ts`, `useHomiAlerts.ts` | |
| Atalhos por página | `src/lib/homiContextos.ts` | prompts sugeridos por rota |
| Outro consumidor | `src/components/oferta-ativa/HomiObjectionHelper.tsx` | chama `homi-chat` com `system` customizado |

### Edge Functions

`homi-chat` (383 l.) é a principal. Existem ainda `homi-ana`, `homi-assistant`, `homi-briefing`, `homi-ceo`, `homi-copilot`, `homi-focus-suggestion`, `homi-follow-up-message`, `homi-gerencial`, `homi-next-task-suggestion`, `homi-personalizar-mensagem`, `homi-reindex`, `homi-suggest-empreendimento-match`. **Só `homi-chat` usa o cérebro único**; as demais têm prompt próprio (`homi-ana` monta o seu em `buildSystemPrompt()` sobre `enterprise-knowledge.ts`).

### Núcleo compartilhado — `supabase/functions/_shared/homi-brain.ts` (191 l.)

- Modelo de chat: `google/gemini-3.6-flash` (`HOMI_CHAT_MODEL`); `HOMI_REASONING_MODEL = google/gemini-3.1-pro-preview` está **declarado e nunca usado**.
- Embeddings: `openai/text-embedding-3-small`, 1536 dims, via Lovable AI Gateway.
- `searchKnowledge()`: 1 embedding da query → RPC `buscar_conhecimento`. Default interno `threshold 0.35 / limit 8`, mas `homi-chat` chama com **`threshold 0.3`, `limit 10`, `empreendimento: null`, sem `sourceTypes`**.
- `formatKnowledgeBlock()`: monta o bloco citável, expõe `[MU-xx.x]` quando presente.
- `HOMI_IDENTITY`: identidade + 7 etapas do Método + precedência MU-00.2 + 3 camadas MU-00.3 + níveis N1–N4 + as 7 linhas vermelhas N1 + LGPD + frases proibidas + formato de mensagem. **Já está tudo aqui, hardcoded no arquivo.**

### Prompt efetivo de `homi-chat` (index.ts l. 60-262)

Empilhado nesta ordem: `HOMI_IDENTITY` → bloco comercial hardcoded → **um funil de 7 etapas inventado** ("Lead novo / Primeiro contato / Qualificação / Interesse / Visita / Proposta / Fechamento") que **não é o funil do CRM** → estilo "2 a 5 linhas, máx ~80 palavras" → lista completa de empreendimentos → conhecimento detalhado de **todos** os empreendimentos → `ragContext` → bloco de papel (`roleBlock`) → bloco de materiais → (se `enableTools`) memória + ~50 linhas de regras de copiloto, incluindo 125 bairros de POA em texto puro.

### Base de conhecimento (medido agora)

- `homi_documents`: `title, category, subcategory, empreendimento, file_url, file_type, content, chunk_count, status, source_type, source_id, source_url, priority, created_by, created_at, updated_at`. **Não existe coluna de versão nem de vigência.**
- `homi_chunks`: `document_id, content, embedding, metadata jsonb, created_at`. **`metadata` está livre** — é a porta aditiva sem migration.
- 695 chunks. Última indexação 31/07. Prioridades definidas em `homi-reindex`: método IA v1.0 = 10, Casa Tua = 9, empreendimento = 7, academia = 6, script = 5, apoios do método = 5, material = 4, imóvel = padrão.
- RPC `buscar_conhecimento`: `SECURITY DEFINER`, filtra `hd.status IN ('indexed','ready')`, ordena `priority DESC, similarity DESC`, aceita `filter_empreendimento` e `filter_source_types` — **ambos já existem e não são usados pelo `homi-chat`**.

### Ferramentas (22, em `homi-chat/homi-tools.ts`, 1690 l.)

`lembrar`, `ver_pendencias`, `buscar_imovel`, `fila_execucao`, `visitas_a_confirmar`, `visitas_pendentes_resultado`, `briefing_do_dia`, `criar_tarefa`, `criar_visita`, `resumo_lead`, `anotar_lead`, `contexto_lead`, `registrar_resultado`, `leads_esfriando`, `preparar_visita`, `meu_dia`, `leads_parados_diagnostico`, `followup_em_lote`, `relatorio_metricas`, `desempenho_time`, `risco_meta`, `diagnostico_corretor`. Executadas com **`userClient` (JWT do usuário)** — a permissão é a RLS. Escrita real acontece no front, com confirmação (`useHomiActions`).

---

## 2. Fluxo atual de uma pergunta

```text
usuário digita  →  HomiContext (escolhe homi-chat p/ qualquer papel)
   →  POST /functions/v1/homi-chat  { messages, perfil, empreendimento?, enableTools, system? }
   →  valida JWT (getClaims)
   →  service client: loadEnterpriseKnowledge (cache 5 min) → lista + detalhe de TODOS empreendimentos
   →  pega SÓ a última mensagem do usuário  →  1 embedding  →  buscar_conhecimento (0.3 / 10, sem filtro)
   →  monta system: IDENTITY + bloco comercial + funil inventado + estilo curto + empreendimentos + RAG + papel + materiais
   →  se enableTools: + memória do usuário + regras do copiloto  →  loop de até 4 iterações com 22 tools
   →  gemini-3.6-flash  →  streaming SSE (ou JSON com actions/results)
```

### Onde quebra hoje

| Risco | Onde, exatamente |
|---|---|
| **Perda de contexto** | `index.ts` l. 49: o RAG usa **só a última mensagem**. "E no Casa Tua?" busca literalmente por "E no Casa Tua?", sem o assunto anterior. |
| **Mistura de empreendimentos** | `empreendimento: null` na busca (l. 55) + `detailedKnowledge` injeta **todos os 69 empreendimentos** no prompt de toda pergunta. Nada impede o modelo de cruzar diferencial de um com preço de outro. |
| **Recuperação irrelevante** | threshold 0.3 é muito permissivo e `sourceTypes` nunca é usado: uma pergunta de método pode voltar com ficha de imóvel. Ordenação por `priority DESC` antes de `similarity` faz um chunk de prioridade 10 pouco relevante empurrar para fora um chunk de prioridade 4 muito relevante. |
| **Informação desatualizada** | Base parada desde 31/07. `homi_documents` não tem vigência: chunk de preço/condição de julho volta hoje como verdade. O `formatKnowledgeBlock` **pede** para não inventar preço, mas não impede citar preço congelado — é diferente. |
| **Sem filtro por etapa** | Não existe nenhum. O funil no prompt (l. 75-82) é **fictício** e não corresponde às 11 etapas reais do CRM, então nem por texto o modelo acerta a conduta da etapa. |
| **Sem filtro por permissão no conhecimento** | Tools usam JWT (ok). Mas `buscar_conhecimento` é `SECURITY DEFINER` e `homi_chunks`/`homi_documents` têm `SELECT USING (true)` para todo autenticado. Hoje o conteúdo é método — no dia em que entrar tabela de preço ou comissão, todo corretor lê. |
| **Divergência de cérebro** | `HomiCeoChat.tsx` ainda chama `homi-ceo`, que não passa por `homi-brain`. Duas personalidades. |

---

## 3. Como alimentar o HOMI sem tocar no CRM

A boa notícia: **a estrutura para isso já existe** e não precisa de migration.

| Conteúdo | Onde fica | Como versionar | Liga/desliga |
|---|---|---|---|
| **Método Uhome** | `homi_documents` `source_type='documento'`, `priority 10`, arquivo-fonte em `supabase/functions/homi-reindex/metodo/*.txt` | novo arquivo `metodo-uhome-ia-v1.1.txt` como documento **novo**; o v1.0 fica com `status='arquivado'` | `status` — a RPC só lê `indexed`/`ready` |
| **Regras N1–N4** | hoje em `HOMI_IDENTITY` (código). N1 **deve continuar no código**, não no RAG: regra de lei não pode depender de busca semântica trazer o chunk certo | git | git |
| **Empreendimentos** | `source_type='empreendimento'`, `priority 7`, `empreendimento` preenchido | um documento por empreendimento, substituído por reindex | `status` |
| **Técnicas comerciais** | `source_type='script'` ou `'material'`, `priority` 4-5 — sempre **abaixo** de método e produto | documento novo por versão | `status` |
| **Casos de teste** | arquivo no repositório (`supabase/functions/_shared/__tests__/`), **nunca** no RAG | git | git |

Três regras para o conteúdo novo não estragar a resposta atual:

1. **Camada 3 nunca entra na base.** Preço, unidade disponível, taxa, prazo de obra e condição do mês são voláteis — o documento indexado registra a *estrutura* ("o Casa Tua tem tabela mensal"), não o número. Se o texto tem número, ele entra com `metadata.vigencia`.
2. **`metadata` de `homi_chunks` é jsonb e está vazio.** Dá para gravar `{ fonte, vigencia, versao }` na ingestão **sem migration nenhuma** — e o `formatKnowledgeBlock` passa a marcar o chunk como volátil ou a descartá-lo. Aditivo puro.
3. **Prioridade é o freio.** Conteúdo novo entra com prioridade baixa, é observado, e só sobe depois de passar nos testes. Nada entra direto em 10.

---

## 4. Matriz de alterações (ordem de risco crescente)

| # | Melhoria | Arquivos | Banco | Risco | Teste | Rollback |
|---|---|---|---|---|---|---|
| 1 | Query de busca = últimas 2-3 mensagens em vez de só a última | `homi-chat/index.ts` (1 linha, l. 49) | — | **Mínimo** | 5 perguntas de follow-up ("e no Casa Tua?") | reverter 1 linha |
| 2 | Subir threshold 0.3 → 0.4 e limit 10 → 12 | `homi-chat/index.ts` l. 52-56 | — | Mínimo | comparar 10 respostas antes/depois | reverter constantes |
| 3 | Marcar chunk sem `vigencia` como "pode estar desatualizado" no bloco | `_shared/homi-brain.ts` (`formatKnowledgeBlock`) | — | Baixo | perguntar preço → resposta manda confirmar | reverter função |
| 4 | Substituir o funil fictício pelas etapas reais do CRM **no texto do prompt** | `homi-chat/index.ts` l. 75-82 | — | Baixo (só texto) | perguntar "em que etapa está esse lead" | reverter bloco |
| 5 | Passar `empreendimento` para `searchKnowledge` quando o front já sabe qual é | `homi-chat/index.ts` l. 55 | — | Baixo | pergunta sobre 1 produto não traz outro | reverter 1 linha |
| 6 | Injetar detalhe **só** dos empreendimentos citados, não dos 69 | `homi-chat/index.ts` l. 43-46 | — | Médio (muda muito o prompt) | bateria de 15 perguntas de produto | reverter bloco |
| 7 | Resposta adaptativa (troca o teto de 80 palavras) | `homi-chat/index.ts` l. 102-107 | — | Médio (muda percepção) | 10 perguntas simples + 5 estratégicas | reverter bloco |
| 8 | Gravar `{fonte, vigencia, versao}` em `homi_chunks.metadata` na ingestão | `homi-reindex/index.ts` | escrita em coluna jsonb já existente | Médio | reindexar 1 documento e conferir | reindexar sem o campo |
| 9 | `HomiCeoChat` passar a usar `homi-chat` | `HomiCeoChat.tsx` (1 linha) | — | Médio | validar 5 perguntas de CEO | reverter 1 linha |
| 10 | Restringir leitura de `homi_chunks` por `source_type` | — | **migration + RLS** | Alto | — | fora do escopo desta etapa |

Itens 1 a 9: **nenhuma migration, nenhuma alteração no CRM operacional, nenhuma escrita de dado.** O item 10 fica registrado e não é proposto agora.

---

## 5. Versionamento e rollback

| O que preservar | Como |
|---|---|
| Prompt atual | está em git (`homi-chat/index.ts`, `homi-brain.ts`) — rollback = reverter o arquivo |
| Config do RAG | as constantes vivem em 2 lugares (`homi-brain` default e a chamada em `homi-chat`). Proposta: consolidar num objeto `RAG_CONFIG` exportado — um único ponto para voltar atrás |
| Documentos ativos | `homi_documents.status` é o interruptor. Antes de ativar conteúdo novo, anotar quais IDs estavam `indexed`; rollback = devolver o status |
| Função de busca | `buscar_conhecimento` **não deve ser alterada**. Qualquer mudança de comportamento acontece nos parâmetros da chamada, não na RPC |
| Modelo atual | `HOMI_CHAT_MODEL` em uma constante única |
| Comportamento atual | bateria de perguntas gravada como caso de teste antes de cada mudança |

Regra de ouro: **uma mudança por vez, com uma bateria fixa de perguntas rodada antes e depois.** Rollback nunca depende de banco nos itens 1 a 7 e 9.

---

## 6. Testes recomendados (determinísticos, sem depender do modelo)

1. Pergunta de follow-up mantém o assunto da conversa na query de busca.
2. Pergunta sobre um empreendimento não retorna chunk de outro.
3. Chunk sem `vigencia` chega marcado como volátil.
4. Chunk com prioridade alta e similaridade baixa não expulsa chunk relevante.
5. Pergunta de preço/disponibilidade produz "confirmar no CRM", nunca número da base.
6. Corretor não recebe dado de lead de outro (já garantido por RLS nas tools — vira teste de regressão).
7. Nenhuma resposta cita frase da lista de frases proibidas (MU-02.3).

---

## 7. Primeira mudança recomendada — só esta

**Query de busca com contexto de conversa** (`homi-chat/index.ts`, l. 49).

Hoje: `const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content`.
Passa a: concatenar as **duas últimas mensagens do usuário** (truncadas) como texto da busca.

Por que é a primeira:
- é literalmente **uma linha**;
- não toca no CRM, em ação nenhuma, e não escreve nada;
- não muda o prompt, não muda o modelo, não muda a base;
- é o defeito que mais aparece na prática ("e no Casa Tua?" volta genérico);
- rollback = desfazer uma linha;
- testável sozinho: mesma pergunta de follow-up, antes e depois, comparando os chunks retornados.

Nada além disso nesta primeira rodada.

---

## 8. Dúvidas antes de implementar

1. **`HomiCeoChat` ainda usa `homi-ceo`** (prompt separado do cérebro único). Unifico numa próxima rodada ou o CEO deve manter comportamento próprio de propósito?
2. **Base parada desde 31/07.** Reindexar tudo agora é seguro do seu lado, ou você prefere primeiro revisar o que está indexado (695 chunks) antes de qualquer reindexação?
3. **Regras N1–N4**: confirmo que elas ficam **no código** (`HOMI_IDENTITY`) e não no RAG? Colocá-las no RAG significa que uma linha vermelha depende da busca trazer o chunk certo — eu não recomendo.
4. **Funil no prompt está fictício** (7 etapas que não existem). Corrijo só o texto para as etapas reais, sem tocar em nada de pipeline?
5. **Você vai mandar conteúdo novo aqui no chat?** Se sim, ele entra como documento com prioridade baixa e sobe só depois dos testes — confirma esse critério?
