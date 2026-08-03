# Plano executivo integrado — HOMI / Uhome Sales

## 1. Resumo executivo (leigo)

Hoje o HOMI recebe, em toda pergunta, o dossiê de TODOS os empreendimentos dentro do prompt, e a busca na base de conhecimento é feita sem saber de qual produto se fala. Resultado: mistura de produto, prompt caro e respostas menos confiáveis. Além disso, existem hoje cinco telas/entradas de HOMI no código, mas só uma é a principal (`/homi`).

O plano faz quatro coisas: (a) o produto em foco passa a ser um dado explícito, não um palpite do texto; (b) só o dossiê do produto em foco entra no prompt, com um índice curto dos demais; (c) a busca traz sempre Método geral + módulo do produto (nunca filtro que apague o geral); (d) governança separando o que é perene, o que é volátil (preço, unidade, taxa — sempre do sistema) e o que é apoio. Tudo com testes, medição sem PII e rollback por pacote.

## 2. Fatos confirmados (SHA `8c54aff9202c49490b329c7c8cccf93981e3f2ec`)

- `supabase/functions/homi-chat/index.ts` L34: body aceita `messages, empreendimento, stream, system, enableTools, perfil`.
- L41-46: `loadEnterpriseKnowledge` → `allEmpreendimentos` (lista) e `detailedKnowledge` = `formatForAssistant` de TODOS os registros, concatenado.
- L88-97: RAG principal com `limit: 10`, `threshold: 0.3`, `empreendimento: null`.
- L~180-190: prompt injeta `EMPREENDIMENTOS (RESUMO)` + `CONHECIMENTO DETALHADO DOS EMPREENDIMENTOS` integralmente.
- L~207-215: `customSystem` monta caminho alternativo com os mesmos blocos completos.
- L~230: `VERACIDADE_COMERCIAL_BLOCK` aplicado ao prompt padrão e ao `customSystem` — trava vigente.
- L56-90: A2 (montarQueryBusca) presente e ativa; heurística textual, não determinística.
- `_shared/homi-brain.ts` L79-106: `searchKnowledge(supabase, query, {limit, threshold, empreendimento, sourceTypes})` → RPC `buscar_conhecimento`.
- `_shared/materiais-context.ts`: busca própria de materiais, embeddings `google/gemini-embedding-001` (motor diferente do brain, que usa `openai/text-embedding-3-small`).
- RPC real `buscar_conhecimento`: `WHERE ... AND (filter_empreendimento IS NULL OR hd.empreendimento = filter_empreendimento)`, `ORDER BY hd.priority DESC, similarity DESC LIMIT match_count`. Confirmado: filtro isolado remove tudo que tem `empreendimento IS NULL`.
- Base indexada hoje: documento 6 docs (1 com prio 10 / 107 chunks; 1 prio 9 / 40; 3 prio 5 / 189; 1 prio 0 / 47), empreendimento 69 docs prio 7, material 42 prio 4, academia 20 prio 6, imóvel 178 prio 3, script 1 prio 5.
- Documentos com `empreendimento IS NULL`: todos de `documento` (5 de 6), `academia` (20) e `imovel` (178).
- Chave de nome divergente: `homi_documents.empreendimento` usa os 69 nomes canônicos; `empreendimento_overrides` tem 12 registros com nomes de outro padrão ("Las Casas", "Vértice - Las Casas", "Átrio - ABF", "Melnick Day" em três variantes). Não há hoje chave comum garantida entre as duas fontes.
- Chamadores: `HomiContext.sendMessage` envia `{messages, enableTools:true, stream:false, perfil}`; `HomiChat.tsx` envia só `messages`; `HomiObjectionHelper` envia `{messages, mode:"arena_objection"}` e coloca `selectedEmp` apenas dentro do texto do prompt.
- Rotas reais (`src/config/pageRegistry.ts` L169-172, L224-227): `/homi` (HomiWorkspace, principal, com `/homi/c/:threadId`), `/homi-assistente`, `/homi-gerente`, `/homi-ceo`, `/backoffice/homi-ana`.
- Persistência: `homi_conversations` gravada em `HomiContext.saveConversation` (colunas `user_id, tipo, titulo, mensagens`) e também, em duplicidade, dentro de `HomiChat.tsx`. Não há coluna de produto em foco.
- `HomiPanel`/balão flutuante: `AppLayout` L327 confirma que o balão foi removido; a conversa vive em `/homi`.

## 3. Correções de premissas anteriores

- "Todos os detalhes dos produtos entram no prompt": confirmado, e vale também no caminho `customSystem`.
- O `empreendimento` do body hoje só influencia materiais — confirmado; ele NÃO chega à RPC.
- Premissa a corrigir: não basta passar `empreendimento` para a RPC. A chave textual entre `homi_documents.empreendimento` e `empreendimento_overrides` diverge; qualquer contrato precisa resolver nome → canônico antes.
- `HomiObjectionHelper` espera SSE, mas o backend só streama fora de `enableTools`; com `mode` desconhecido ele cai no caminho padrão. Comportamento a validar em teste, não afirmado como bug.
- Ignorada, conforme instrução, a sugestão anterior de `method:UhomeGeneral`.

## 4. Arquitetura atual

```text
HomiWorkspace (/homi) ──> HomiContext.sendMessage ──┐
HomiChat.tsx (legado)  ─────────────────────────────┤ POST homi-chat
HomiObjectionHelper (OA) ───────────────────────────┘
                                   │
        ┌──────────────────────────┴───────────────────────────┐
        │ detailedKnowledge = TODOS os produtos (sempre)        │
        │ RAG: buscar_conhecimento(empreendimento=null, top 10) │
        │ materiais: motor de embedding separado                │
        │ + HOMI_IDENTITY + VERACIDADE + roleBlock              │
        └───────────────────────────────────────────────────────┘
```

## 5. Arquitetura-alvo mínima

```text
Chamador ──> body { messages, perfil, produtoFoco? }
                       │ resolve/valida produtoFoco (canônico)
                       ▼
     ┌────────── composição do prompt ───────────┐
     │ SEMPRE: HOMI_IDENTITY + N1/N2 + veracidade │
     │ SEMPRE: índice curto de todos os produtos  │
     │ SE foco: dossiê só do produto em foco      │
     └────────────────────────────────────────────┘
                       │
     recuperação em duas trilhas (uma chamada cada):
     T1 geral  = buscar_conhecimento(emp=null)      → Método/Academia
     T2 produto= buscar_conhecimento(emp=<canônico>) → módulo do produto
                 merge, dedupe, corte por orçamento
```

## 6. Matriz dos chamadores reais

| Chamador | Rota/uso | Envia hoje | Status | Ação |
|---|---|---|---|---|
| `HomiContext.sendMessage` (via `/homi`, `HomiPageButton`, `PipelineLeadDetail`) | principal | messages, enableTools, stream, perfil | ATIVO | recebe contrato de produto em foco |
| `HomiChat.tsx` | usado por `HomiAssistant` (`/homi-assistente`) e `HomiPanel` | messages | LEGADO | congelar; não evoluir |
| `HomiObjectionHelper` | Oferta Ativa (`DialingModeWithScript`) | messages, mode | ATIVO secundário | passar `produtoFoco` estruturado |
| `HomiCeoChat` / `HomiGerencialChat` | `/homi-ceo`, `/homi-gerente` | — | legado paralelo | fora do escopo desta rodada |

## 7. Contrato de produto em foco

- **Fonte**: campo novo e opcional no body (`produto_foco: { nome: string } | null`). Nunca inferido por regex no backend.
- **Precedência** (mais forte primeiro): 1) seleção explícita do usuário na tela; 2) lead aberto (empreendimento do lead) quando o chat é aberto a partir dele; 3) contexto de tela dedicada a um produto; 4) nenhum foco.
- **Validação**: backend resolve o texto contra a lista canônica; se não resolver, trata como ausente, registra sinal `produto_foco_invalido` e segue sem foco. Nunca erro para o usuário, nunca chute.
- **Ausência**: comportamento atual preservado (índice curto + RAG geral); sem dossiê completo de todos.
- **Troca**: nova seleção substitui o foco a partir do próximo turno; o histórico não é reescrito.
- **Limpeza**: nova conversa começa sem foco; "limpar foco" é ação explícita.
- **Persistência**: recomendação = persistir o foco por conversa (campo em `homi_conversations`) para que reabrir a thread não perca o contexto. Se Lucas preferir não migrar tabela agora, alternativa sem persistência: o foco vive só na sessão e some ao recarregar — funcional, porém pior em mobile.

## 8. Contrato de conhecimento e precedência

Camadas: **C1 Método/geral** (perene, `empreendimento IS NULL`) · **C2 módulo do produto** (perene do produto) · **C3 volátil** (preço, unidade, taxa, prazo, fase — sempre do sistema, nunca de memória nem de dossiê antigo) · **C4 apoio** (materiais, academia, scripts).

Precedência de resposta: dado do sistema > C1/C2 > memória da conversa > nada inventado. C4 nunca vence C1/C2. Conteúdo com data vencida (ex.: evento de março/2026) não pode gerar urgência nem condição comercial; vira apoio histórico.

Recuperação: nunca filtro isolado por empreendimento. Sempre duas trilhas somadas, com cota mínima garantida para C1 para que o Método não seja deslocado pelos 107 chunks de prioridade alta nem pelos módulos de produto.

## 9. Roadmap (4 pacotes)

**P1 — Foco determinístico + dossiê enxuto (frontend + backend, mesmo PR)**
Objetivo: parar de injetar todos os produtos e passar o foco de forma explícita. Arquivos: `homi-chat/index.ts`, `_shared/enterprise-knowledge.ts`, `HomiContext.tsx`, composer do workspace, `HomiObjectionHelper.tsx`. Sem migration. Benefício: menos mistura de produto, prompt menor. Risco: perder contexto em perguntas comparativas → mitigado pelo índice curto sempre presente. Testes: níveis 2 e 3 da matriz. Rollback: flag de composição volta ao dossiê completo. Autorização: Lucas.

**P2 — Recuperação em duas trilhas + resolução de nome canônico**
Objetivo: trazer Método + módulo do produto sem filtro destrutivo, e resolver a divergência de nomes entre `homi_documents` e `empreendimento_overrides`. Arquivos: `_shared/homi-brain.ts`, `homi-chat/index.ts`; possivelmente um mapa de aliases (preferir reaproveitar `empreendimento_aliases`/`empreendimentos_canonicos` já existentes em vez de criar tabela). Depende de P1. Risco: duplicidade de chunks → dedupe por `id`. Rollback: voltar a uma trilha.

**P3 — Governança de fontes (perene/volátil/apoio/vencido)**
Objetivo: rotular e ordenar as fontes; impedir que volátil e conteúdo vencido virem afirmação. Toca `formatKnowledgeBlock`, prioridades e status em `homi_documents`. Envolve mudança de dados → PR separado, com inventário antes/depois. Rollback: restaurar prioridades registradas.

**P4 — Evals e observabilidade sem PII**
Objetivo: medir qualidade e custo. Log estruturado por turno: tem foco (sim/não), foco válido, nº de chunks por camada, tamanho do prompt em tokens, ferramentas chamadas, latência. Sem texto de pergunta, sem nome de lead, sem dado pessoal. Suíte de evals rodada antes e depois de cada deploy.

## 10. Agrupamento em PRs

- **PR1 = P1** (frontend + backend inseparáveis: o backend só ganha foco se o frontend enviar).
- **PR2 = P2 + P4** (recuperação e sua medição andam juntas com segurança).
- **PR3 = P3** isolado, porque altera dados e não só código.
Não juntar P3 com P1/P2: mudança de dados e de código no mesmo PR impede isolar a causa de uma regressão.

## 11. Matriz de testes (3 níveis)

| Caso | N1 recuperação | N2 prompt | N3 resposta |
|---|---|---|---|
| Sem produto | C1 presente | índice curto, sem dossiê completo | responde geral, sem citar produto errado |
| Produto explícito | C1+C2 | dossiê só do foco | argumentos só do foco |
| Produto inválido | igual a "sem produto" | sinal de inválido | sem erro visível |
| Troca de produto | C2 novo | dossiê novo | não vaza o anterior |
| Conversa carregada | foco restaurado (se P persistência) | idem | coerente após reload |
| Casa Tua → investimento | C2 Casa Tua | — | recusa valorização sem fonte |
| Garantia/aprovação de crédito | — | N1 presente | recusa (linha vermelha) |
| Preço atual | — | regra C3 | remete ao sistema, não afirma |
| SPIN / pergunta de método | C1 não deslocado | Método presente | responde com o Método |
| Ferramentas (buscar_imovel, meu_dia) | — | bloco copiloto intacto | chama a ferramenta |
| Gestor/CEO | — | roleBlock presente | linguagem de liderança |
| Oferta Ativa (objeção) | C2 do `selectedEmp` | foco estruturado | resposta curta do produto certo |
| Regressão A2 | continuação puxa contexto; tema novo não | — | comportamento idêntico ao atual |

## 12. Deploy controlado e sinais de rollback

Ordem: PR1 → observar → PR2 → observar → PR3. Cada pacote atrás de um interruptor de composição que devolve o comportamento anterior sem novo deploy. Sinais de rollback: queda na taxa de resposta com fonte citada, aumento de recusas indevidas, sumiço de respostas de Método, aumento de erro/latência no gateway, ou qualquer caso vermelho na matriz de testes.

## 13. Decisões de Lucas (5)

1. Persistir o produto em foco por conversa (migration mínima) ou manter só na sessão?
2. Precedência confirmada: seleção explícita > lead aberto > tela > nenhum?
3. Sem foco, manter o índice curto de todos (recomendado) ou não citar produto algum?
4. P3 pode alterar prioridade/status de documentos vencidos (ex.: evento de março/2026) ou só rotular?
5. `HomiChat.tsx` / `/homi-assistente` ficam congelados como legado nesta rodada?

## 14. Recomendação final

APROVAR PLANO PARA PREPARAR IMPLEMENTAÇÃO — condicionado às decisões 1 a 3.

## 15. Primeira solicitação futura de implementação

Pacote PR1 completo em uma rodada: campo `produto_foco` no body; resolução/validação canônica no backend; `detailedKnowledge` limitado ao foco com índice curto sempre presente; envio do foco por `HomiContext` (seleção explícita + lead aberto) e por `HomiObjectionHelper`; interruptor de composição; suíte de testes N2/N3 dos casos da matriz. Nada de migration, nada de mudança de dados. Sem diff e sem execução agora.
