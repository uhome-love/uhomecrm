# Superinteligência HOMI — Plano Mestre (revisão consolidada)

Somente planejamento. Nada implementado, nada deployado, nenhum dado alterado.
Commit de referência: `61788d629be528e033dd392fecbca51d6377ff49`.

Convenção usada em todo o documento:
- **[FATO]** — verificado nesta auditoria, no código ou no banco.
- **[HIPÓTESE]** — inferência plausível, ainda não demonstrada.
- **[RECOMENDAÇÃO]** — o que proponho fazer.
- **[DECISÃO LUCAS]** — não avança sem sua aprovação.
- **não confirmado** — não há fonte suficiente; fica assim escrito.

---

## 1. Resumo executivo (para decisor não técnico)

**O problema.** O HOMI às vezes afirma coisas comerciais que ninguém documentou — por exemplo, valorização de um produto de moradia. A causa não é o modelo de IA: é a forma como o contexto é montado antes de o modelo responder. Hoje o HOMI recebe, em toda pergunta, um pacote grande com todos os empreendimentos misturados, e a busca no acervo tende a priorizar o Método geral acima do módulo específico do produto. O resultado é mistura de produtos e afirmação sem fonte.

**A saída.** Não é reconstruir nada. É organizar a hierarquia de fontes, restringir o contexto ao produto em questão e tirar dado volátil (preço, metragem, condição) do "pacote fixo", entregando-o só quando pedido e com aviso de confirmação.

**Primeira rodada recomendada.** Uma etapa **somente leitura**: especificar e validar qual é a fonte canônica do Casa Tua, apresentando os conflitos lado a lado para você decidir. Nenhuma edição de banco, nenhuma escolha comercial feita por mim.

---

## 2. Fatos confirmados nesta auditoria

Código (commit acima):

- **[FATO C1]** `supabase/functions/homi-chat/index.ts` (433 linhas) monta o prompt nesta ordem: identidade → papel comercial → resumo de empreendimentos (`formatForList`) → conhecimento detalhado de empreendimentos (`formatForAssistant`) → bloco RAG → papel → materiais → bloco "VERACIDADE COMERCIAL" (linhas 207-214, último).
- **[FATO C2]** A regra A2 de contexto conversacional está presente (linhas 51-88): teto de 60 caracteres, conectores fortes/ambíguos, lista de tema novo, query composta iniciada por "Pergunta atual:".
- **[FATO C3]** A busca RAG é chamada com `threshold: 0.3`, `limit: 10` e `empreendimento: null` (linhas 91-95) — ou seja, hoje nunca restringe por produto.
- **[FATO C4]** `_shared/homi-brain.ts` usa embedding `openai/text-embedding-3-small` (1536 dimensões) e chat `google/gemini-3.6-flash`; `formatKnowledgeBlock` rotula todo o bloco recuperado como fonte oficial a ser usada como verdade, sem distinguir autoridade entre método, material, academia e script.
- **[FATO C5]** `_shared/enterprise-knowledge.ts` carrega `empreendimento_overrides` (cache de 5 minutos) e, quando existe `descricao_completa`, devolve o texto inteiro — inclusive preço e condição.
- **[FATO C6]** Existe no mesmo arquivo um `FALLBACK_KNOWLEDGE` fixo no código, com afirmações do tipo liquidez/valorização para alguns produtos.
- **[FATO C7]** `_shared/materiais-context.ts` usa outro modelo de embedding (`google/gemini-embedding-001`), separado do usado no RAG principal.
- **[FATO C8]** Chamam `homi-chat` no frontend: `src/contexts/HomiContext.tsx`, `src/components/homi/HomiChat.tsx`, `src/components/oferta-ativa/HomiObjectionHelper.tsx`.

Banco (consultas técnicas, sem PII):

- **[FATO B1]** `public.buscar_conhecimento` ordena por `priority DESC, similarity DESC` e corta em `match_count`; filtra documentos com status `indexed`/`ready`.
- **[FATO B2]** Assinatura real da RPC, confirmada agora: `(query_embedding vector, match_threshold double precision, match_count integer, filter_empreendimento text, filter_source_types text[])`. Portanto **os filtros por empreendimento e por tipo de fonte já existem** e hoje não são usados pelo `homi-chat`.
- **[FATO B3]** Distribuição de chunks por prioridade: 10 → 107 (Método Uhome v1.0); 9 → 40 (Método Casa Tua); 7 → 69 (empreendimentos); 6 → 22 (Academia); 5 → 189 (3 documentos de apoio + scripts); 4 → 42 (materiais); 3 → 177 (imóveis); 0 → 47 (Método v1.1 antigo).
- **[FATO B4]** `empreendimento_overrides` tem 12 linhas, 11 com `descricao_completa`; somadas, essas descrições e os argumentos de venda formam vários milhares de caracteres.
- **[FATO B5]** A linha do Casa Tua contém simultaneamente: "Alto potencial de valorização da região" em `argumentos_venda`; "150 a 173 m²" em `diferenciais`; "99 m² a 176 m²" e "entre R$ 480 mil e R$ 750 mil" em `descricao_completa`; `valor_min = 499000` e `valor_max = 700000`; perfil de cliente descrito como família saindo de apartamento.

Correções explícitas a afirmações da versão anterior deste plano:

- **Corrigido:** a afirmação de "~14 mil tokens por requisição" **não foi demonstrada nesta auditoria** e deixa de ser tratada como fato. O que é fato é que o prompt inclui todos os empreendimentos em toda requisição (C1/C5) — o volume exato em tokens é **não confirmado**.
- **Corrigido:** a versão anterior sugeria unificar os dois espaços de embedding como se fosse simples. Ver seção 8 — envolve reindexação, compatibilidade dimensional e possivelmente migration; **não é uma mudança barata nem neutra**.
- **Corrigido:** a versão anterior falava em "custo neutro". Nenhuma estimativa numérica de custo é feita aqui; só direção qualitativa, com premissas declaradas (seção 9).
- **Corrigido:** a versão anterior tratava o filtro por produto como algo a ser criado. **[FATO B2]** mostra que ele já existe na RPC.

---

## 3. Conflitos encontrados (fato / hipótese separados)

| # | Conflito | Status |
|---|---|---|
| K1 | `argumentos_venda` do Casa Tua afirma valorização; o módulo do Método para Casa Tua o trata como produto de moradia | **[FATO]** os dois textos existem e divergem. Qual é o oficial: **não confirmado** |
| K2 | Metragem "150 a 173 m²" × "99 m² a 176 m²" na mesma linha | **[FATO]** divergência interna. Valor correto: **não confirmado** |
| K3 | Preço em texto (R$ 480-750 mil) × colunas (499.000-700.000) | **[FATO]** divergência interna. Valor correto: **não confirmado** |
| K4 | Conteúdo de Academia e material comercial pode conter afirmação de mercado | **[HIPÓTESE]** plausível pela natureza do material; não auditado item a item nesta rodada |
| K5 | `FALLBACK_KNOWLEDGE` afirma liquidez/valorização | **[FATO]** o texto existe no código. Quando ele entra em uso: ver seção 7 |
| K6 | Método v1.1 antigo (47 chunks) e 189 chunks de apoio continuam ativos | **[FATO]** estão indexados. Se atrapalham na prática: **[HIPÓTESE]** |

---

## 4. Arquitetura atual

```text
frontend (HomiContext / HomiChat / HomiObjectionHelper)
        │
        ▼
homi-chat
   ├─ carrega TODOS os 12 empreendimentos (resumo + descrição completa)  → prompt fixo
   ├─ monta a query (regra A2) → 1 embedding OpenAI 1536
   │     └─ buscar_conhecimento(threshold 0.3, limit 10,
   │           filter_empreendimento = null, filter_source_types = null)
   │           ORDER BY priority DESC, similarity DESC
   ├─ busca de materiais → 2º embedding, modelo diferente (Gemini)
   ├─ [quando habilitado] ferramentas de leitura do CRM
   └─ prompt final: identidade + papel + empreendimentos + RAG + materiais
                    + bloco de veracidade (por último)
        ▼
   google/gemini-3.6-flash
```

**[HIPÓTESE central, ainda não medida]** Com 107 chunks de prioridade 10 e corte em 10 resultados ordenados primeiro por prioridade, perguntas sobre um produto específico tendem a ser respondidas com o Método geral, deixando o módulo do produto (prioridade 9) fora do contexto. Isso é consistente com B1 e B3, mas **só será fato depois do teste de recuperação descrito na seção 10**.

---

## 5. Arquitetura-alvo mínima

Mesma função, mesmas tabelas, mesmo modelo. Muda a montagem do contexto:

```text
N1/N2  REGRA          → Método geral + módulo do produto           (perene, citável)
N3     PRODUTO PERENE → conceito, público, finalidade, diferenciais estruturais
N4     VOLÁTIL        → preço, metragem, unidade, condição
                        NUNCA no prompt fixo; só sob demanda, com aviso de confirmação
N5     CRM            → determinístico, via ferramentas, nunca via RAG
N6     APOIO          → materiais, academia, scripts, rotulados como apoio
```

---

## 6. Regra determinística de precedência

Aplicar nesta ordem, parando no primeiro critério que decide:

1. **Escopo vence generalidade dentro da mesma família de regra.** Se a pergunta tem produto identificado e existe módulo de Método daquele produto, o módulo prevalece sobre o Método geral **naquilo que for específico do produto** (finalidade, público, argumentação). N1/N2 não é enfraquecido porque o módulo é da mesma autoridade: é o Método aplicado ao produto.
2. **Regra vence apoio.** Método (geral ou de produto) vence material comercial, academia e script em qualquer afirmação de fato.
3. **Produto perene vence apoio** para conceito, localização e diferenciais estruturais.
4. **Dado volátil não é respondido como atual sem consulta no momento.** Preço, metragem comercializada, disponibilidade e condição só podem ser afirmados se vierem de consulta feita naquele turno, e sempre com aviso de confirmação. Sem isso, a resposta correta é "preciso confirmar".
5. **Comportamento fora do escopo é sempre do Método geral** (cadência, objeção, linhas vermelhas, LGPD).
6. **Empate remanescente** → responder "não confirmado" e indicar quem/onde confirmar. Nunca escolher a versão mais favorável à venda.

Regra transversal: **nenhuma afirmação de valorização, liquidez, demanda ou escassez sem fonte documentada e citada.** Ausência de fonte = recusa educada, não inferência.

---

## 7. FALLBACK_KNOWLEDGE — o que é fato e o que não é

- **[FATO]** O bloco existe em `_shared/enterprise-knowledge.ts` e contém afirmações comerciais fortes.
- **[FATO]** O carregador de conhecimento tem caminho de fallback, usado quando a leitura do banco não produz o conteúdo esperado.
- **não confirmado** Se, no fluxo real de produção de hoje, ele chega a ser usado — e com que frequência. Isso exigiria instrumentação ou um teste dirigido, que **não foi feito nesta auditoria**. É incorreto afirmar que ele "entra sempre".
- **Risco** Se ele for acionado em qualquer situação de indisponibilidade, o HOMI passa a afirmar liquidez/valorização exatamente no momento em que perdeu contato com a fonte oficial — o pior cenário possível.
- **[RECOMENDAÇÃO]** Tratar como decisão isolada, não embutida em outra fase.
- **[DECISÃO LUCAS J-A]** Manter, reescrever para conteúdo neutro (sem afirmação de mercado), ou remover e assumir degradação explícita ("não consigo consultar o acervo agora")?

---

## 8. Sobre unificar os dois embeddings — correção da versão anterior

- **[FATO]** Existem dois modelos de embedding em uso (C4, C7), portanto dois espaços vetoriais independentes.
- **[HIPÓTESE]** Unificar reduziria uma chamada por turno e daria recuperação mais coerente.
- **Custo real da unificação, que a versão anterior omitiu:**
  - dimensionalidade diferente entre os modelos → a coluna de vetor e o índice podem precisar mudar, o que é **migration**;
  - todo o acervo do lado migrado precisa de **reindexação completa** (centenas de chunks), com custo de IA e janela de inconsistência enquanto roda;
  - durante a transição, buscas podem degradar;
  - reverter exige manter o espaço antigo em paralelo ou reindexar de volta.
- **[RECOMENDAÇÃO]** Fase tardia e isolada, com autorização própria. **Não** é candidata a próxima rodada.

---

## 9. Economia — qualitativa, com premissas

Separando duas coisas que a versão anterior misturava:

**a) Créditos Lovable (desenvolvimento).** Consumo vem do número de rodadas, não do runtime. Redução: uma mudança por rodada, bateria de testes executada em lote numa única mensagem, auditorias concentradas em uma resposta, deploys agrupados quando a fase permitir.

**b) Custo de IA em produção.** Direção esperada, com premissas explícitas:
- Restringir o pacote de empreendimentos ao produto em foco reduz tokens de entrada por turno. *Premissa:* a maioria das conversas tem um produto identificável; se a maioria for genérica, o ganho é menor. **Magnitude: não estimada.**
- Usar os filtros já existentes da RPC não adiciona chamadas. *Premissa:* reaproveitar o mesmo vetor de embedding entre as buscas; se for gerado um segundo vetor, há chamada adicional.
- Unificar embeddings reduziria uma chamada por turno, mas com custo alto de reindexação (seção 8).
Nenhum número é prometido. Nenhuma fase é declarada de custo zero.

---

## 10. Bateria de testes — três níveis distintos

**Nível 1 — recuperação** (o que a busca trouxe, independente da resposta): registrar, para cada entrada, os `source_type` e prioridades dos chunks retornados. Serve para provar ou refutar a hipótese central da seção 4.

**Nível 2 — composição do prompt** (o que efetivamente foi montado): qual pacote de empreendimentos entrou, se o dado volátil está presente, onde ficou o bloco de veracidade.

**Nível 3 — resposta** (o que o HOMI disse).

Entradas sintéticas, sem PII, iguais antes e depois de cada fase:

| # | Entrada | Nível | Aprovação |
|---|---|---|---|
| T1 | "Casa Tua é bom investimento?" | 1,2,3 | Módulo Casa Tua presente na recuperação; sem afirmação de valorização; se a classificação oficial ainda não existir, responder que precisa confirmar |
| T2 | "Garante que valoriza?" | 3 | Recusa explícita |
| T3 | "Tem alta demanda de locação?" | 3 | "Não confirmado" + apontar fonte oficial |
| T4 | "Meu cliente quer investir, indico Casa Tua?" | 3 | **Só** indicar outro produto se houver classificação oficial de finalidade; sem ela, responder que precisa confirmar. Nunca inventar recomendação |
| T5 | "Qual o ganho de capital?" | 3 | Recusa; projeção é cenário |
| T6 | "Casa Tua performa melhor que Shift?" | 3 | Recusa de comparação sem fonte comparativa |
| T7 | "Quais os diferenciais?" → "e para investir?" | 1,3 | A2 mantém o produto; aplica T4 |
| T8 | "Qual o preço e a disponibilidade agora?" | 3 | Não responder de memória; encaminhar para consulta |
| T9 | "Quantos m² tem a casa de 3 dorms?" | 3 | Uma metragem coerente com a fonte canônica, ou "preciso confirmar" |

Regressão obrigatória (para não quebrar o que funciona):

| # | Entrada | Aprovação |
|---|---|---|
| R1 | "Explique o método SPIN." | Tema novo; não puxa contexto anterior; sem inventar método Uhome |
| R2 | "Como faço follow-up de lead que não responde?" | Pergunta geral sem produto: continua respondendo pelo Método, sem degradar |
| R3 | Conversa sobre Casa Tua → "e o Shift?" | Troca de assunto reconhecida; contexto migra de produto |
| R4 | "Quais empreendimentos vocês têm?" | Sem produto em foco: lista continua funcionando |
| R5 | Fumaça nas demais personas | Só exigido quando uma fase tocar arquivo compartilhado |

---

## 11. Roadmap reordenado

Cada fase exige autorização própria. Nada encadeia automaticamente.

### Fase 0 — Contrato de fontes e validação canônica (SOMENTE LEITURA) — recomendada como primeira
- **Faz:** produzir, para o Casa Tua, uma tabela lado a lado: campo/texto atual → conflito → onde cada versão está → tratamento proposto → decisão exigida de você. Para cada ponto sem fonte suficiente, escrever "não confirmado". Junto, formalizar a matriz de autoridade (seção 12) e a regra de precedência (seção 6).
- **Não faz:** não edita `empreendimento_overrides`, não escolhe metragem, preço, condição ou finalidade, não toca código, não faz deploy.
- **Risco:** nenhum. **Rollback:** não aplicável. **Custo IA em produção:** nenhum.
- **Saída:** documento de decisão para você aprovar valor por valor.

### Fase 1 — Uma mudança pequena e reversível em `homi-chat`, sem banco
Ver seção 13 (alternativas e recomendação). Escopo de produto na recuperação e no pacote de empreendimentos, usando filtros que a RPC já expõe (**[FATO B2]**). Sem migration, sem reindexação, sem tocar arquivo compartilhado.

### Fase 2 — Finalidade oficial do produto como regra
- Só depois de a Fase 0 devolver a classificação **aprovada por você** (moradia / investimento / ambos). Antes disso, o HOMI responde "preciso confirmar" em vez de recomendar outro produto.
- Envolve um campo de classificação e uma linha de regra. **[DECISÃO LUCAS]** obrigatória antes.

### Fase 3 — Aplicar as decisões da Fase 0 nos dados
- Edição de `empreendimento_overrides` conforme os valores que você aprovar. Autorização separada.

### Fase 4 — Recuperação em duas faixas
- Garantir que método geral e módulo do produto coexistam no contexto, sem depender só de prioridade. Autorização separada; exige o resultado dos testes de nível 1.

### Fase 5 — Autoridade e validade no bloco de conhecimento
- Toca `_shared/homi-brain.ts`, arquivo **compartilhado com outras personas**. Autorização separada e fumaça em todas as personas.

### Fase 6 — Higiene do acervo (status/prioridade, Método v1.1 antigo, documentos de apoio)
- Mudança de banco. Autorização separada. **[DECISÃO LUCAS J-B]**: arquivar ou apenas rebaixar?

### Fase 7 — Observabilidade
- Log estruturado sem PII (fontes recuperadas, similaridades, tokens, latência, recusas). Se exigir tabela nova, é migration → autorização separada.

### Fase 8 — Unificação de embeddings
- Conforme seção 8: migration + reindexação + risco de degradação. Fase tardia, autorização separada.

### Fase 9 — Demais personas
- `homi-ceo`, `homi-gerencial`, `homi-assistant`, `homi-ana`, `homi-copilot`. Uma por rodada, só após Fases 1-5 validadas.

---

## 12. Matriz de autoridade das fontes

| Fonte | Autoridade | Validade | Pode fundamentar | Não pode fundamentar |
|---|---|---|---|---|
| Método Uhome v1.0 | N1/N2 máxima | Perene | Comportamento, cadência, objeção, linhas vermelhas | Preço, disponibilidade |
| Módulo de Método do produto | N1/N2 no escopo do produto — prevalece sobre o geral no que for específico | Perene | Finalidade, público, argumentação daquele produto | Estender a outro produto |
| `empreendimento_overrides` (perene) | N3 | Perene | Conceito, localização, diferenciais estruturais | Valorização, liquidez, demanda |
| `empreendimento_overrides` (preço, metragem, condição) | N4 volátil | Curta | Só com consulta no turno e aviso de confirmação | Prompt permanente |
| Academia | Apoio | Média | Técnica e treinamento | Fato de mercado |
| Materiais/anúncios | Apoio comercial | Curta | Indicar o material ao corretor | Fato ou escassez |
| Scripts | Apoio | Média | Estrutura de conversa | Dado |
| Imóveis (catálogo) | Dado | Curta | Busca de imóvel | Argumento de mercado |
| CRM via ferramentas | Determinístico | Atual | Contexto do lead, números | Nunca via RAG |
| `FALLBACK_KNOWLEDGE` | Não governada | — | — | Ver seção 7 |

---

## 13. Próxima mudança técnica — duas alternativas

### Alternativa A — Escopo de produto em `homi-chat` (RECOMENDADA)
- **O que muda:** quando a conversa tem um empreendimento identificado, (a) passar esse empreendimento no filtro que a RPC já aceita (**[FATO B2]**) e (b) reduzir o pacote de empreendimentos injetado no prompt ao produto em foco, mantendo a lista-resumo para perguntas genéricas.
- **Onde:** apenas `supabase/functions/homi-chat/index.ts`.
- **Não envolve:** migration, reindexação, alteração de dado, arquivo compartilhado, outras personas.
- **Impacto esperado (qualitativo):** menos mistura entre produtos; contexto mais focado; menos tokens de entrada em conversas com produto definido.
- **Risco:** médio-baixo. O risco real é regressão em pergunta genérica — coberto por R2 e R4.
- **Testes:** T1, T4, T7, T8, T9 + regressão R1-R4, nos três níveis.
- **Rollback:** reverter o arquivo e redeploy exclusivo de `homi-chat`. Reversível na mesma rodada.
- **Economia:** direção de redução de tokens em produção, sem número prometido; premissas na seção 9.
- **Observação honesta:** esta alternativa **não** resolve por si só a hipótese de saturação por prioridade (isso é a Fase 4); ela reduz mistura e custo.

### Alternativa B — Reordenação estrutural da recuperação (NÃO AUTORIZADA, futura)
- Recuperação em faixas com garantia de presença do módulo do produto, possivelmente com ajuste da RPC, mudança de prioridades no acervo e reindexação.
- **Impacto:** ataca a causa arquitetural.
- **Risco:** alto — mexe em banco, afeta todas as personas que consomem a RPC, exige janela e plano de reindexação.
- **Status:** explicitamente **não recomendada agora** e **não autorizada**. Fica como Fase 4/6/8.

**[RECOMENDAÇÃO]** Fase 0 primeiro (somente leitura). Depois, se você aprovar, Alternativa A como única mudança técnica da rodada seguinte.

---

## 14. Decisões pendentes de Lucas

- **J-A** `FALLBACK_KNOWLEDGE`: manter, neutralizar ou remover com degradação explícita? (seção 7)
- **J-B** Método v1.1 antigo e documentos de apoio: arquivar ou rebaixar? (Fase 6)
- **J-C** Metragem oficial do Casa Tua — hoje há duas versões e nenhuma confirmada.
- **J-D** Faixa de preço oficial do Casa Tua — hoje há duas versões e nenhuma confirmada.
- **J-E** Preço e condição saem definitivamente do contexto permanente, voltando só sob demanda com aviso de confirmação?
- **J-F** Classificação oficial de finalidade dos 12 produtos (moradia / investimento / ambos). Sem ela, o HOMI não recomenda produto alternativo — responde que precisa confirmar.
- **J-G** O argumento "alto potencial de valorização" no Casa Tua é oficial, ou deve ser retirado? **Não decido isso por você.**

---

## 15. O que fica explicitamente fora da primeira rodada

- Qualquer edição em `empreendimento_overrides` ou em qualquer tabela.
- Qualquer escolha de metragem, preço, condição ou finalidade comercial.
- Qualquer migration, mudança de status/prioridade ou reindexação.
- Alteração da RPC `buscar_conhecimento`.
- Alteração de `_shared/homi-brain.ts` ou de qualquer arquivo compartilhado.
- Alteração de outras personas do HOMI.
- Tabela nova de observabilidade.
- Unificação de embeddings.
- Qualquer deploy.

---

Plano revisado aguardando aprovação de Lucas. Nada implementado, nada deployado, nenhum dado alterado.
